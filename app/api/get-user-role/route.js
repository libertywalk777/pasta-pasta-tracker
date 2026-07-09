import { NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';
import { BRANCHES, FACTORY } from '@/lib/branches';

let dbInitialized = false;

export async function POST(request) {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }

  try {
    const { telegram_id, username } = await request.json();

    const db = getDb();
    let userAccess = null;

    // 1. Query the database first
    if (telegram_id) {
      const res = await db.execute(
        'SELECT * FROM user_access WHERE telegram_id = ?',
        [Number(telegram_id)]
      );
      if (res.rows.length > 0) userAccess = res.rows[0];
    }

    if (!userAccess && username) {
      const res = await db.execute(
        'SELECT * FROM user_access WHERE LOWER(telegram_username) = ?',
        [username.toLowerCase()]
      );
      if (res.rows.length > 0) userAccess = res.rows[0];
    }

    // 2. If a custom role exists, return it
    if (userAccess) {
      return NextResponse.json({
        ok: true,
        role: userAccess.role,
        branch_id: userAccess.branch_id
      });
    }

    // 3. Fallback to static checks
    const targetUsername = username ? username.toLowerCase() : '';
    
    // Director fallback
    if (targetUsername === 'grxt777') {
      return NextResponse.json({ ok: true, role: 'director', branch_id: null });
    }

    // Manager fallback
    const managedBranch = BRANCHES.find(b => b.manager_username?.toLowerCase() === targetUsername) || 
                          (FACTORY.manager_username?.toLowerCase() === targetUsername ? FACTORY : null);

    if (managedBranch) {
      return NextResponse.json({ ok: true, role: 'manager', branch_id: managedBranch.id });
    }

    // Default driver
    return NextResponse.json({ ok: true, role: 'driver', branch_id: null });
  } catch (error) {
    console.error('Get user role API error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
