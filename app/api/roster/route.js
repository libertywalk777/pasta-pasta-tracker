import { NextResponse } from 'next/server';
import { BRANCHES, FACTORY, DRIVERS, DIRECTORS } from '@/lib/branches';
import { requireDirector } from '@/lib/auth';
import { getDb, initDb } from '@/lib/db';

let dbInitialized = false;

/**
 * POST /api/roster
 * Director-only. Static who-is-who + dynamic user_access ACL.
 */
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

    const people = [];

    for (const d of DIRECTORS) {
      people.push({
        kind: 'static',
        role: 'director',
        name: d.label || 'Директор',
        username: d.username || null,
        phone: d.phone || null,
        branch_id: null,
        branch_name: null,
        responsibility: 'Полный доступ: дашборд, роли, все филиалы, live-трекинг',
      });
    }

    for (const d of DRIVERS) {
      people.push({
        kind: 'static',
        role: 'driver',
        name: d.name || 'Развозчик',
        username: d.username || null,
        phone: d.phone || null,
        branch_id: null,
        branch_name: null,
        responsibility: 'Забор с фабрики и доставка на филиалы (гео-отметки + live GPS)',
      });
    }

    people.push({
      kind: 'static',
      role: 'manager',
      name: FACTORY.manager_username ? `@${FACTORY.manager_username}` : 'Управ фабрики',
      username: FACTORY.manager_username || null,
      phone: FACTORY.manager_phone || null,
      branch_id: FACTORY.id,
      branch_name: FACTORY.name,
      responsibility: `Подтверждение забора с фабрики (${FACTORY.address})`,
    });

    for (const b of BRANCHES) {
      people.push({
        kind: 'static',
        role: 'manager',
        name: b.manager_username ? `@${b.manager_username}` : b.name,
        username: b.manager_username || null,
        phone: b.manager_phone || null,
        branch_id: b.id,
        branch_name: b.name,
        responsibility: `Подтверждение доставок на ${b.name} (${b.address})`,
      });
    }

    let accessList = [];
    try {
      const db = getDb();
      const res = await db.execute('SELECT * FROM user_access ORDER BY telegram_id DESC');
      accessList = (res.rows || []).map((r) => {
        const br =
          BRANCHES.find((x) => x.id === Number(r.branch_id)) ||
          (Number(r.branch_id) === 0 ? FACTORY : null);
        return {
          kind: 'acl',
          telegram_id: r.telegram_id,
          username: r.telegram_username,
          role: r.role,
          branch_id: r.branch_id,
          branch_name: br?.name || null,
          responsibility:
            r.role === 'director'
              ? 'Выданный доступ директора'
              : r.role === 'driver'
                ? 'Выданный доступ развозчика'
                : `Управляющий: ${br?.name || 'филиал'}`,
        };
      });
    } catch (e) {
      console.warn('roster ACL load failed:', e.message);
    }

    return NextResponse.json({
      ok: true,
      people,
      accessList,
      branches: BRANCHES,
      factory: FACTORY,
      drivers: DRIVERS,
      directors: DIRECTORS,
    });
  } catch (error) {
    console.error('roster API error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
