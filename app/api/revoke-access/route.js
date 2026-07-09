import { NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';

let dbInitialized = false;

export async function POST(request) {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }

  try {
    const { username, telegram_id } = await request.json();

    // Verify requesting user is Director
    if (!username || username.toLowerCase() !== 'grxt777') {
      return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 });
    }

    if (!telegram_id) {
      return NextResponse.json({ ok: false, error: 'Telegram User ID is required' }, { status: 400 });
    }

    const db = getDb();
    await db.execute('DELETE FROM user_access WHERE telegram_id = ?', [Number(telegram_id)]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Revoke access API error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
