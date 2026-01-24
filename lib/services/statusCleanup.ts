import { SQLStoreService } from '@/lib/services/sqlStoreService';

let hasRun = false;

export async function statusCleanupOnBoot(): Promise<void> {
  if (hasRun) return;
  hasRun = true;

  try {
    const sqlStore = new SQLStoreService();
    await sqlStore.statusCleanup();
  } catch (error) {
    console.error('Status cleanup failed:', error);
  }
}
