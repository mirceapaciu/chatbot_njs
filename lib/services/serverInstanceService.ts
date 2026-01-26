import { getSupabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

const GLOBAL_KEY = '__chatbot_server_instance__';

type GlobalState = {
  serverInstanceId: string;
  started: boolean;
  heartbeatTimer: NodeJS.Timeout | null;
  shutdownHookInstalled: boolean;
};

function getGlobalState(): GlobalState {
  const anyGlobal = globalThis as unknown as Record<string, unknown>;
  const existing = anyGlobal[GLOBAL_KEY] as GlobalState | undefined;
  if (existing) return existing;

  const state: GlobalState = {
    serverInstanceId: generateServerInstanceId(),
    started: false,
    heartbeatTimer: null,
    shutdownHookInstalled: false,
  };

  anyGlobal[GLOBAL_KEY] = state;
  return state;
}

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function getHeartbeatIntervalSeconds(): number {
  // Configurable via env; default chosen to be reasonable for dev.
  return (
    parsePositiveInt(process.env.SERVER_HEARTBEAT_INTERVAL_SECONDS) ?? 60
  );
}

export function getServerInstanceId(): string {
  return getGlobalState().serverInstanceId;
}

function generateServerInstanceId(): string {
  const envId = process.env.SERVER_INSTANCE_ID;
  if (envId && envId.trim().length > 0) {
    return envId.trim();
  }

  try {
    return crypto.randomUUID();
  } catch {
    // Fallback for older runtimes.
    return `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

async function upsertServerInstanceModifyTime(serverInstanceId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('t_server_instance')
    .upsert({
      server_instance: serverInstanceId,
      modify_time: new Date().toISOString(),
    });

  if (error) {
    throw new Error(`Failed to upsert server instance heartbeat: ${error.message}`);
  }
}

export async function stopServerInstance(): Promise<void> {
  const state = getGlobalState();

  if (state.heartbeatTimer) {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = null;
  }

  if (!state.started) return;

  const supabase = getSupabaseAdmin();

  // Best-effort cleanup.
  await supabase
    .from('t_process_status')
    .delete()
    .eq('server_instance', state.serverInstanceId);

  await supabase
    .from('t_server_instance')
    .delete()
    .eq('server_instance', state.serverInstanceId);

  state.started = false;
}

function installShutdownHooksOnce(): void {
  const state = getGlobalState();
  if (state.shutdownHookInstalled) return;
  state.shutdownHookInstalled = true;

  const shutdown = async (signal: string) => {
    try {
      console.log(`[boot] server instance shutdown (${signal})`);
      await stopServerInstance();
    } catch (error) {
      console.error('[boot] failed to cleanup server instance on shutdown:', error);
    }
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('beforeExit', () => void shutdown('beforeExit'));
}

export async function startServerInstance(): Promise<string> {
  const state = getGlobalState();
  if (state.started) return state.serverInstanceId;

  installShutdownHooksOnce();

  await upsertServerInstanceModifyTime(state.serverInstanceId);

  const intervalSeconds = getHeartbeatIntervalSeconds();
  state.heartbeatTimer = setInterval(() => {
    void upsertServerInstanceModifyTime(state.serverInstanceId).catch(error => {
      console.error('[heartbeat] failed:', error);
    });
  }, intervalSeconds * 1000);

  state.started = true;
  return state.serverInstanceId;
}

let hasRunOnBoot = false;

export async function startServerInstanceOnBoot(): Promise<void> {
  if (hasRunOnBoot) return;
  hasRunOnBoot = true;

  try {
    const id = await startServerInstance();
    console.log(`[boot] server instance registered: ${id}`);
  } catch (error) {
    console.error('[boot] server instance registration failed:', error);
  }
}
