import { NextRequest, NextResponse } from 'next/server';
import type { DataSourcesConfig } from '@/types';
import type { LoadPolicy } from '@/lib/services/dataLoaderService';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { policy } = body as { policy: LoadPolicy };

    if (policy !== 'missing_only' && policy !== 'all') {
      return NextResponse.json(
        { error: 'Invalid policy. Must be "missing_only" or "all"' },
        { status: 400 }
      );
    }

    const [{ DataLoaderService, LoadInProgressError }, { VectorStoreService }, { SQLStoreService }, fs, path, yaml] =
      await Promise.all([
        import('@/lib/services/dataLoaderService'),
        import('@/lib/services/vectorStoreService'),
        import('@/lib/services/sqlStoreService'),
        import('fs/promises'),
        import('path'),
        import('yaml'),
      ]);

    // Load data sources config (project root)
    const configPath = path.resolve(process.cwd(), 'config', 'data_sources.yaml');
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config: DataSourcesConfig = yaml.parse(configContent);
    const projectRoot = path.resolve(path.dirname(configPath), '..');
    config.root_directory = path.resolve(projectRoot, config.root_directory);

    // Initialize services
    const vectorStore = new VectorStoreService();
    const sqlStore = new SQLStoreService();
    const dataLoader = new DataLoaderService(config, vectorStore, sqlStore);

    // Perform the load
    let stats;
    try {
      stats = await withTimeout(dataLoader.load(policy), 30 * 60 * 1000);
    } catch (error) {
      if (error instanceof LoadInProgressError) {
        return NextResponse.json(
          { error: error.message },
          { status: 409 }
        );
      }
      throw error;
    }

    // If at least one file failed to load, return 500
    if (Object.keys(stats.failed).length > 0) {
      return NextResponse.json(
        { error: 'Some files failed to load', stats },
        { status: 500 }
      );
    }

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Load API error:', error);
    return NextResponse.json(
      { error: 'Failed to load data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Load request timed out')), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}
