import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  try {
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Reset loading API error:', error);
    return NextResponse.json(
      { error: 'Failed to reset loading statuses' },
      { status: 500 }
    );
  }
}
