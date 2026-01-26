import type { DataSourcesConfig } from '@/types';

let hasRun = false;

async function loadDataSourcesConfig(): Promise<DataSourcesConfig> {
  const [fs, path, yaml] = await Promise.all([
    import('fs/promises'),
    import('path'),
    import('yaml'),
  ]);

  const configPath = path.resolve(process.cwd(), 'config', 'data_sources.yaml');
  const configContent = await fs.readFile(configPath, 'utf-8');
  const config: DataSourcesConfig = yaml.parse(configContent);

  const projectRoot = path.resolve(path.dirname(configPath), '..');
  config.root_directory = path.resolve(projectRoot, config.root_directory);

  return config;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

export async function autoLoadOnBoot(): Promise<void> {
  if (hasRun) return;
  hasRun = true;

  try {
    console.log('[boot] autoLoadOnBoot: starting');
    const [vectorStoreModule, sqlStoreModule] = await Promise.all([
      import('@/lib/services/vectorStoreService'),
      import('@/lib/services/sqlStoreService'),
    ]);

    const vectorStore = new vectorStoreModule.VectorStoreService();
    const sqlStore = new sqlStoreModule.SQLStoreService();

    const isEmpty = await vectorStore.isEmpty();
    if (!isEmpty) {
      console.log('[boot] autoLoadOnBoot: skipped (vector store not empty)');
      return;
    }

    const statuses = await sqlStore.listStatuses();
    const hasLoading = statuses.some(s => s.status === 'loading');

    // If something already indicates loading, don't auto-load again.
    if (hasLoading) {
      console.log('[boot] autoLoadOnBoot: skipped (status=loading present)');
      return;
    }

    const { DataLoaderService, LoadInProgressError } = await import('@/lib/services/dataLoaderService');

    const config = await loadDataSourcesConfig();
    const vectorStoreService = new vectorStoreModule.VectorStoreService();
    const sqlStoreService = new sqlStoreModule.SQLStoreService();
    const dataLoader = new DataLoaderService(config, vectorStoreService, sqlStoreService);

    try {
      await withTimeout(
        dataLoader.load('all'),
        5 * 60 * 1000,
        'Auto-load timed out'
      );
    } catch (error) {
      if (error instanceof LoadInProgressError) {
        console.log('[boot] autoLoadOnBoot: skipped (load already in progress)');
        return;
      }
      throw error;
    }

    console.log('[boot] autoLoadOnBoot: completed');
  } catch (error) {
    console.error('Auto-load on boot failed:', error);
  }
}
