import { NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';
import { requireDirector } from '@/lib/auth';

let dbInitialized = false;

export async function POST(request) {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }

  try {
    const body = await request.json();

    // Director identity may come as director_telegram_id to avoid clash with target
    const authBody = {
      username: body.username,
      phone: body.phone,
      telegram_id: body.director_telegram_id ?? body.auth_telegram_id ?? null,
    };
    const auth = await requireDirector(authBody);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const targetId = body.target_telegram_id ?? body.telegram_id;
    const { telegram_username, role, branch_id } = body;

    if (!targetId) {
      return NextResponse.json({ ok: false, error: 'Telegram User ID is required' }, { status: 400 });
    }

    if (!['director', 'manager', 'driver'].includes(role)) {
      return NextResponse.json({ ok: false, error: 'Invalid role' }, { status: 400 });
    }

    const db = getDb();
    await db.execute(
      'INSERT OR REPLACE INTO user_access (telegram_id, telegram_username, role, branch_id) VALUES (?, ?, ?, ?)',
      [
        Number(targetId),
        telegram_username ? String(telegram_username).trim().replace(/^@/, '') : null,
        role,
        role === 'manager' ? Number(branch_id) : null,
      ]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Grant access API error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
