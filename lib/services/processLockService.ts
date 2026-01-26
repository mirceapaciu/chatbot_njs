import { getSupabaseAdmin } from '@/lib/supabase';
import { startServerInstance } from '@/lib/services/serverInstanceService';

// This service implements a distributed process lock using the database.
// It allows only one server instance to hold the lock for a given process name at a time.

export type ReleaseFn = () => Promise<void>;

function isConflictError(error: unknown): boolean {
  const anyErr = error as { code?: string; status?: number; message?: string } | null;
  if (!anyErr) return false;
  return (
    anyErr.code === '23505' || // PostgreSQL SQLSTATE error code for unique constraint violation 
    anyErr.status === 409 ||
    (typeof anyErr.message === 'string' && anyErr.message.toLowerCase().includes('duplicate key'))
  );
}

export class ProcessLockService {
  private supabase;

  constructor() {
    this.supabase = getSupabaseAdmin();
  }

  /**
   * Attempts to acquire a lock for a named process across server instances.
   *
   * Implementation: insert a single row into `t_process_status` where `process_name` is the PK.
   * If the row already exists, the process is considered locked.
   */
  async tryAcquire(processName: string): Promise<ReleaseFn | null> {
    const serverInstanceId = await startServerInstance();

    const { error } = await this.supabase
      .from('t_process_status')
      .insert({
        process_name: processName,
        server_instance: serverInstanceId,
        status: 'running',
        modify_time: new Date().toISOString(),
      });

    if (error) {
      if (isConflictError(error)) {
        return null;
      }
      throw new Error(`Failed to acquire process lock (${processName}): ${error.message}`);
    }

    return async () => {
      const { error: releaseError } = await this.supabase
        .from('t_process_status')
        .delete()
        .eq('process_name', processName)
        .eq('server_instance', serverInstanceId);

      if (releaseError) {
        throw new Error(`Failed to release process lock (${processName}): ${releaseError.message}`);
      }
    };
  }
}
