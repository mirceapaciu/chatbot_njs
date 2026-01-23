import { Document, LoadStats, DataSourcesConfig, DataSourceConfig, DataFileConfig } from '@/types';
import { VectorStoreService } from './vectorStoreService';
import { SQLStoreService } from './sqlStoreService';
import { embeddingService } from './embeddingService';
import Papa from 'papaparse';
import path from 'path';
import fs from 'fs/promises';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export type LoadPolicy = 'missing_only' | 'all';

export class DataLoaderService {
  private config: DataSourcesConfig;
  private vectorStore: VectorStoreService;
  private sqlStore: SQLStoreService;

  constructor(
    config: DataSourcesConfig,
    vectorStore: VectorStoreService,
    sqlStore: SQLStoreService
  ) {
    this.config = config;
    this.vectorStore = vectorStore;
    this.sqlStore = sqlStore;
  }

  /**
   * Initialize file statuses in the database
   */
  private async initializeFileStatuses(): Promise<void> {
    for (const source of this.config.sources) {
      for (const file of source.files) {
        const targets = this.getTargetsForFile(file);
        
        for (const target of targets) {
          const existing = await this.sqlStore.getStatus(
            source.id,
            file.name,
            target
          );
          
          if (!existing) {
            await this.sqlStore.updateStatus(
              source.id,
              file.name,
              target,
              'not_loaded',
              'Not yet loaded'
            );
          }
        }
      }
    }
  }

  /**
   * Determine which storage targets (vector/sql) are needed for a file
   */
  private getTargetsForFile(file: DataFileConfig): ('vector' | 'sql')[] {
    if (file.type === 'table') {
      return ['sql'];
    }
    return ['vector'];
  }

  /**
   * Load data based on the specified policy
   */
  async load(policy: LoadPolicy): Promise<LoadStats> {
    const stats: LoadStats = {
      loaded: [],
      skipped: [],
      failed: {},
    };

    await this.initializeFileStatuses();

    if (policy === 'all') {
      await this.vectorStore.reset();
      await this.sqlStore.resetStatuses(['vector', 'sql']);
    }

    for (const source of this.config.sources) {
      for (const file of source.files) {
        const fileId = `${source.id}/${file.name}`;
        
        try {
          const shouldProcess = await this.shouldProcessFile(source, file, policy);
          
          if (!shouldProcess) {
            stats.skipped.push(fileId);
            continue;
          }

          const filePath = this.getFilePath(source, file);
          
          // Check if file exists
          try {
            await fs.access(filePath);
          } catch {
            throw new Error(`File not found: ${filePath}`);
          }

          if (file.type === 'pdf' || file.type === 'text') {
            await this.loadTextFile(source, file, filePath);
          } else if (file.type === 'table') {
            await this.loadTableFile(source, file, filePath);
          }

          stats.loaded.push(fileId);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          stats.failed[fileId] = errorMsg;
          console.error(`Failed to load ${fileId}:`, errorMsg);

          // Update status to failed
          const targets = this.getTargetsForFile(file);
          for (const target of targets) {
            await this.sqlStore.updateStatus(
              source.id,
              file.name,
              target,
              'failed',
              errorMsg
            );
          }
        }
      }
    }

    return stats;
  }

  /**
   * Check if a file should be processed based on the policy
   */
  private async shouldProcessFile(
    source: DataSourceConfig,
    file: DataFileConfig,
    policy: LoadPolicy
  ): Promise<boolean> {
    if (policy === 'all') {
      return true;
    }

    // For missing_only policy, check if file is already loaded
    const targets = this.getTargetsForFile(file);
    
    for (const target of targets) {
      const status = await this.sqlStore.getStatus(source.id, file.name, target);
      if (!status || status.status !== 'loaded') {
        return true;
      }
    }

    return false;
  }

  /**
   * Get the absolute file path for a data file
   */
  private getFilePath(source: DataSourceConfig, file: DataFileConfig): string {
    const rootDir = path.isAbsolute(this.config.root_directory)
      ? this.config.root_directory
      : path.resolve(process.cwd(), this.config.root_directory);
    return path.join(rootDir, source.id, file.name);
  }

  /**
   * Load a text or PDF file into the vector store
   */
  private async loadTextFile(
    source: DataSourceConfig,
    file: DataFileConfig,
    filePath: string
  ): Promise<void> {
    console.log(`Loading text file: ${filePath}`);
    
    // Read file content
    const content = file.type === 'pdf'
      ? await this.extractPdfText(filePath)
      : await fs.readFile(filePath, 'utf-8');
    
    // Chunk the content (simplified version - you may want to use a proper chunking library)
    const chunks = this.chunkText(content, 1000);

    // Create documents with metadata
    const documents: Document[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await embeddingService.embedText(chunk);
      
      documents.push({
        content: chunk,
        embedding,
        metadata: {
          data_source_id: source.id,
          data_source_name: source.name,
          file_name: file.name,
          url: file.url,
          year: file.year,
          page_number: i + 1, // Simplified page tracking
          loaded_date: new Date().toISOString(),
        },
      });

      if ((i + 1) % 100 === 0) {
        console.log(`Processed ${i+1}/${chunks.length} chunks for ${file.name}`);
      }
    }

    // Add documents to vector store
    await this.vectorStore.addDocuments(documents);

    // Update status
    await this.sqlStore.updateStatus(
      source.id,
      file.name,
      'vector',
      'loaded',
      `Loaded ${documents.length} chunks`
    );
  }

  /**
   * Load a CSV file into the SQL store
   */
  private async loadTableFile(
    source: DataSourceConfig,
    file: DataFileConfig,
    filePath: string
  ): Promise<void> {
    const csvContent = await fs.readFile(filePath, 'utf-8');

    // Parse CSV
    const parseResult = await new Promise<Papa.ParseResult<any>>((resolve) => {
      Papa.parse(csvContent, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: resolve,
      });
    });

    if (parseResult.errors.length > 0) {
      throw new Error(`CSV parse errors: ${parseResult.errors.map(e => e.message).join(', ')}`);
    }

    // Process CPI data (customize based on your CSV structure)
    const cpiData = parseResult.data
      .map((row: any) => ({
        ref_area_code: row['REF_AREA'] || row['LOCATION'],
        ref_area_name: row['Reference area'] || row['Country'] || row['REF_AREA'],
        time_period: this.parseDate(row['TIME_PERIOD'] || row['Time']),
        inflation_pct: parseFloat(row['OBS_VALUE'] || row['Value']) || 0,
      }))
      .filter(row => row.ref_area_code && row.ref_area_name && row.time_period);

    // Deduplicate by ref_area_code and time_period (keep last occurrence)
    const uniqueData = new Map<string, typeof cpiData[0]>();
    cpiData.forEach(row => {
      const key = `${row.ref_area_code}|${row.time_period}`;
      uniqueData.set(key, row);
    });
    const deduplicatedData = Array.from(uniqueData.values());

    // Insert into database
    await this.sqlStore.insertCPIData(deduplicatedData);

    // Update status
    await this.sqlStore.updateStatus(
      source.id,
      file.name,
      'sql',
      'loaded',
      `Loaded ${deduplicatedData.length} unique rows (${cpiData.length} total)`
    );
  }

  /**
   * Simple text chunking with overlap
   */
  private chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start += chunkSize - overlap;
    }

    return chunks;
  }

  /**
   * Extract text from a PDF file
   */
  private async extractPdfText(filePath: string): Promise<string> {
    const pdfBuffer = await fs.readFile(filePath);
    const parsed = await pdfParse(pdfBuffer);
    return parsed.text || '';
  }

  /**
   * Parse date string to ISO format
   */
  private parseDate(dateStr: string): string {
    // Handle YYYY-MM format
    if (/^\d{4}-\d{2}$/.test(dateStr)) {
      return `${dateStr}-01`;
    }
    // Handle other formats as needed
    return dateStr;
  }
}
