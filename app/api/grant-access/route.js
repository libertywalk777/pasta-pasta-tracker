import { NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';

let dbInitialized = false;

export async function POST(request) {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }

  try {
    const { username, telegram_id, telegram_username, role, branch_id } = await request.json();

    // Verify requesting user is Director
    if (!username || username.toLowerCase() !== 'grxt777') {
      return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 });
    }

    if (!telegram_id) {
      return NextResponse.json({ ok: false, error: 'Telegram User ID is required' }, { status: 400 });
    }

    if (!['director', 'manager', 'driver'].includes(role)) {
      return NextResponse.json({ ok: false, error: 'Invalid role' }, { status: 400 });
    }

    const db = getDb();
    await db.execute(
      'INSERT OR REPLACE INTO user_access (telegram_id, telegram_username, role, branch_id) VALUES (?, ?, ?, ?)',
      [
        Number(telegram_id),
        telegram_username ? telegram_username.trim() : null,
        role,
        role === 'manager' ? Number(branch_id) : null
      ]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Grant access API error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
