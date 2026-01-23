import { NextRequest, NextResponse } from 'next/server';
import { SQLStoreService } from '@/lib/services/sqlStoreService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const sqlStore = new SQLStoreService();
    const statuses = await sqlStore.listStatuses();

    return NextResponse.json({ statuses }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    });
  } catch (error) {
    console.error('Status API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statuses' },
      { status: 500 }
    );
  }
}
