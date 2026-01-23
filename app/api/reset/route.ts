import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const [{ VectorStoreService }, { SQLStoreService }] = await Promise.all([
      import('@/lib/services/vectorStoreService'),
      import('@/lib/services/sqlStoreService'),
    ]);

    const vectorStore = new VectorStoreService();
    const sqlStore = new SQLStoreService();

    await vectorStore.reset();
    await sqlStore.clearCPIData();
    await sqlStore.resetStatuses(['vector', 'sql']);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Reset API error:', error);
    return NextResponse.json(
      { error: 'Failed to delete all files', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
