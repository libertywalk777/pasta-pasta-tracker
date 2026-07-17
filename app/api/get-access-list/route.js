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
    const body = await request.json().catch(() => ({}));
    const auth = await requireDirector(body);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const db = getDb();
    const res = await db.execute('SELECT * FROM user_access ORDER BY telegram_id DESC');

    return NextResponse.json({
      ok: true,
      accessList: res.rows,
    });
  } catch (error) {
    console.error('Get access list API error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
