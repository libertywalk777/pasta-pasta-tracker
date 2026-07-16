import { NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';
import { resolveIdentity, normalizePhone } from '@/lib/branches';

let dbInitialized = false;

export async function POST(request) {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const telegram_id = body.telegram_id ? Number(body.telegram_id) : null;
    const username = body.username ? String(body.username).replace(/^@/, '') : '';
    const phone = body.phone ? normalizePhone(body.phone) : '';

    const db = getDb();
    let userAccess = null;

    // 1) Explicit ACL from DB (director-granted) — highest priority
    if (telegram_id) {
      const res = await db.execute(
        'SELECT * FROM user_access WHERE telegram_id = ?',
        [telegram_id]
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

    if (userAccess) {
      return NextResponse.json({
        ok: true,
        role: userAccess.role,
        branch_id: userAccess.branch_id,
        matched_by: 'db',
        phone: phone || null,
        username: username || null,
      });
    }

    // 2) Auto role by phone (preferred) → username → default driver
    const identity = resolveIdentity({ phone, username });

    return NextResponse.json({
      ok: true,
      role: identity.role,
      branch_id: identity.branch_id,
      matched_by: identity.matched_by,
      label: identity.label,
      phone: identity.phone || null,
      username: username || null,
      needs_phone: !phone && identity.matched_by === 'default' && !username,
    });
  } catch (error) {
    console.error('Get user role API error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
