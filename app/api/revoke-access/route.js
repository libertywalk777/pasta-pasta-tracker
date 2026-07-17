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
    const authBody = {
      username: body.username,
      phone: body.phone,
      telegram_id: body.director_telegram_id ?? body.auth_telegram_id ?? null,
    };
    const auth = await requireDirector(authBody);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const revokeId = body.target_telegram_id ?? body.telegram_id;
    if (!revokeId) {
      return NextResponse.json({ ok: false, error: 'Telegram User ID is required' }, { status: 400 });
    }

    const db = getDb();
    await db.execute('DELETE FROM user_access WHERE telegram_id = ?', [Number(revokeId)]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Revoke access API error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
