import { NextResponse } from 'next/server';
import { SQLStoreService } from '@/lib/services/sqlStoreService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const sqlStore = new SQLStoreService();
    const dbLoadRunning = await sqlStore.isProcessRunning('db_load');

    return NextResponse.json(
      { dbLoadRunning },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error('Process status API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch process status' },
      { status: 500 }
    );
  }
}
