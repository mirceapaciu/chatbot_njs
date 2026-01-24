import { NextRequest, NextResponse } from 'next/server';
import { VectorStoreService } from '@/lib/services/vectorStoreService';
import { SQLStoreService } from '@/lib/services/sqlStoreService';
import { loadCoordinator } from '@/lib/services/loadCoordinator';
import { statusCleanupOnBoot } from '@/lib/services/statusCleanup';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

void statusCleanupOnBoot();

async function loadDataSourcesConfig() {
  const [fs, path, yaml] = await Promise.all([
    import('fs/promises'),
    import('path'),
    import('yaml'),
  ]);

  const configPath = path.resolve(process.cwd(), 'config', 'data_sources.yaml');
  const configContent = await fs.readFile(configPath, 'utf-8');
  const config = yaml.parse(configContent);
  const projectRoot = path.resolve(path.dirname(configPath), '..');
  config.root_directory = path.resolve(projectRoot, config.root_directory);
  return config;
}

export async function GET(request: NextRequest) {
  try {
    const vectorStore = new VectorStoreService();
    const sqlStore = new SQLStoreService();
    
    const isEmpty = await vectorStore.isEmpty();
    const count = await vectorStore.getDocumentCount();

    // Check if any SQL data is loaded
    const statuses = await sqlStore.listStatuses();
    const sqlLoaded = statuses.some(s => s.target === 'sql' && s.status === 'loaded');
    const hasLoading = statuses.some(s => s.status === 'loading');
    const hasLoaded = statuses.some(s => s.status === 'loaded');

    if (isEmpty && !hasLoading && !hasLoaded) {
      void (async () => {
        const release = loadCoordinator.tryAcquire();
        if (!release) {
          return;
        }

        try {
          const [{ DataLoaderService }, { VectorStoreService }, { SQLStoreService }] =
            await Promise.all([
              import('@/lib/services/dataLoaderService'),
              import('@/lib/services/vectorStoreService'),
              import('@/lib/services/sqlStoreService'),
            ]);

          const config = await loadDataSourcesConfig();
          const vectorStoreService = new VectorStoreService();
          const sqlStoreService = new SQLStoreService();
          const dataLoader = new DataLoaderService(config, vectorStoreService, sqlStoreService);

          await dataLoader.load('all');
        } catch (error) {
          console.error('Auto-load failed:', error);
        } finally {
          release();
        }
      })();
    }

    return NextResponse.json({ 
      isEmpty,
      documentCount: count,
      sqlLoaded,
      isLoaded: !isEmpty || sqlLoaded,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    });
  } catch (error) {
    console.error('Vector store status API error:', error);
    return NextResponse.json(
      { error: 'Failed to check vector store status' },
      { status: 500 }
    );
  }
}
