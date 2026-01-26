import { autoLoadOnBoot } from '@/lib/services/autoLoadOnBoot';
import { startServerInstanceOnBoot } from '@/lib/services/serverInstanceService';
import { statusCleanupOnBoot } from '@/lib/services/statusCleanup';

export const runtime = 'nodejs';

export async function register(): Promise<void> {
  // Run once per server process (per cold start in serverless).
  console.log('[boot] instrumentation.register()');
  void startServerInstanceOnBoot();
  void statusCleanupOnBoot();
  // Defer heavy work so the server can start responding first.
  setTimeout(() => {
    void autoLoadOnBoot();
  }, 1000);
}
