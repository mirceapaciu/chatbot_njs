import { NextResponse } from 'next/server';
import { VectorStoreService } from '@/lib/services/vectorStoreService';
import { SQLStoreService } from '@/lib/services/sqlStoreService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const vectorStore = new VectorStoreService();
    const sqlStore = new SQLStoreService();
    
    const isEmpty = await vectorStore.isEmpty();
    const count = await vectorStore.getDocumentCount();

    // Check if any SQL data is loaded
    const statuses = await sqlStore.listStatuses();
    const sqlLoaded = statuses.some(s => s.target === 'sql' && s.status === 'loaded');
    return NextResponse.json({ 
      isEmpty,
      documentCount: count,
      sqlLoaded,
      isLoaded: !isEmpty || sqlLoaded,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    });
  } catch (error) {
    console.error('Vector store status API error:', error);
    return NextResponse.json(
      { error: 'Failed to check vector store status' },
      { status: 500 }
    );
  }
}
