import { NextRequest, NextResponse } from 'next/server';
import { SQLStoreService } from '@/lib/services/sqlStoreService';

export async function GET(request: NextRequest) {
  try {
    const sqlStore = new SQLStoreService();
    const statuses = await sqlStore.listStatuses();

    return NextResponse.json({ statuses });
  } catch (error) {
    console.error('Status API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statuses' },
      { status: 500 }
    );
  }
}
