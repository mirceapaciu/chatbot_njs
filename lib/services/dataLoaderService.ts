import { Document, LoadStats, DataSourcesConfig, DataSourceConfig, DataFileConfig } from '@/types';
import { VectorStoreService } from './vectorStoreService';
import { SQLStoreService } from './sqlStoreService';
import { embeddingService } from './embeddingService';
import { loadCoordinator } from './loadCoordinator';
import Papa from 'papaparse';
import path from 'path';
import fs from 'fs/promises';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { CHUNK_OVERLAP, CHUNK_SIZE } from '../config';

export type LoadPolicy = 'missing_only' | 'all';

export class LoadInProgressError extends Error {
  constructor(message: string = 'A knowledge DB load is already in progress') {
    super(message);
    this.name = 'LoadInProgressError';
  }
}

export class DataLoaderService {
  private config: DataSourcesConfig;
  private vectorStore: VectorStoreService;
  private sqlStore: SQLStoreService;

  private async yieldToEventLoop(): Promise<void> {
    await new Promise<void>(resolve => {
      // setImmediate is Node-specific; fall back to setTimeout for broader compatibility.
      if (typeof setImmediate === 'function') {
        setImmediate(resolve);
      } else {
        setTimeout(resolve, 0);
      }
    });
  }

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
              'Not yet loaded',
              file.url
            );
          } else if (!existing.url && file.url) {
            await this.sqlStore.updateStatus(
              source.id,
              file.name,
              target,
              existing.status,
              existing.message,
              file.url
            );
          }
        }

        // Yield between files to keep the server responsive during long init.
        await this.yieldToEventLoop();
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
    const release = loadCoordinator.tryAcquire();
    if (!release) {
      throw new LoadInProgressError();
    }

    const stats: LoadStats = {
      loaded: [],
      skipped: [],
      failed: {},
    };

    try {
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

          // Yield between files so other requests can be served.
          await this.yieldToEventLoop();
        }
      }

      return stats;
    } finally {
      release();
    }
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
    const chunks = this.chunkText(content, CHUNK_SIZE, CHUNK_OVERLAP);

    await this.sqlStore.updateStatus(
      source.id,
      file.name,
      'vector',
      'loading',
      `Loading 0/${chunks.length}`
    );

    // Create documents with metadata
    const documents: Document[] = [];
    
    const progressStep = Math.max(1, Math.floor(chunks.length / 20));

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

      // Cooperative yield during long embedding loops.
      if ((i + 1) % 2 === 0) {
        await this.yieldToEventLoop();
      }

      if ((i + 1) % progressStep === 0 || i === chunks.length - 1) {
        const progressMessage = `Loading ${i + 1}/${chunks.length}`;
        console.log(`Processed ${i + 1}/${chunks.length} chunks for ${file.name}`);
        await this.sqlStore.updateStatus(
          source.id,
          file.name,
          'vector',
          'loading',
          progressMessage
        );

        // Yield after progress updates as well.
        await this.yieldToEventLoop();
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
    await this.sqlStore.updateStatus(
      source.id,
      file.name,
      'sql',
      'loading',
      'Loading 0/1'
    );

    const csvContent = await fs.readFile(filePath, 'utf-8');

    // Parse CSV
    type CsvRow = Record<string, string | number | null | undefined>;
    const parseResult = await new Promise<Papa.ParseResult<CsvRow>>((resolve) => {
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
      .map((row: CsvRow) => {
        const refAreaCodeRaw = row['REF_AREA'] ?? row['LOCATION'] ?? '';
        const refAreaNameRaw = row['Reference area'] ?? row['Country'] ?? row['REF_AREA'] ?? '';
        const ref_area_code = String(refAreaCodeRaw).trim();
        const ref_area_name = String(refAreaNameRaw).trim();
        const time_period = this.parseDate(String(row['TIME_PERIOD'] ?? row['Time'] ?? ''));
        const inflation_pct = parseFloat(String(row['OBS_VALUE'] ?? row['Value'] ?? 0)) || 0;
        return { ref_area_code, ref_area_name, time_period, inflation_pct };
      })
      .filter(row => row.ref_area_code.length > 0 && row.ref_area_name.length > 0 && row.time_period.length > 0);

    // Deduplicate by ref_area_code and time_period (keep last occurrence)
    const uniqueData = new Map<string, typeof cpiData[0]>();
    cpiData.forEach(row => {
      const key = `${row.ref_area_code}|${row.time_period}`;
      uniqueData.set(key, row);
    });
    const deduplicatedData = Array.from(uniqueData.values());

    // Insert into database
    await this.sqlStore.insertCPIData(deduplicatedData);

    await this.sqlStore.updateStatus(
      source.id,
      file.name,
      'sql',
      'loading',
      'Loading 1/1'
    );

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
  private chunkText(text: string, chunkSize: number = CHUNK_SIZE, overlap: number = CHUNK_OVERLAP): string[] {
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

    // pdf-parse can be CPU heavy; yield before/after to reduce perceived blocking.
    await this.yieldToEventLoop();
    const parsed = await pdfParse(pdfBuffer);
    await this.yieldToEventLoop();
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
