import { NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';

let dbInitialized = false;

export async function POST(request) {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }

  try {
    const { username } = await request.json();

    // Verify requesting user is Director
    if (!username || username.toLowerCase() !== 'grxt777') {
      return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 });
    }

    const db = getDb();
    const res = await db.execute('SELECT * FROM user_access ORDER BY telegram_id DESC');
    
    return NextResponse.json({
      ok: true,
      accessList: res.rows
    });
  } catch (error) {
    console.error('Get access list API error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
