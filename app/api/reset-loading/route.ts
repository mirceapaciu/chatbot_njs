import { NextResponse } from 'next/server';
import { SQLStoreService } from '@/lib/services/sqlStoreService';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const sqlStore = new SQLStoreService();
    await sqlStore.resetLoadingStatuses();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Reset loading API error:', error);
    return NextResponse.json(
      { error: 'Failed to reset loading statuses' },
      { status: 500 }
    );
  }
}
