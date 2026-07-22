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

    // All events for director dashboard (newest first)
    const res = await db.execute(
      'SELECT * FROM deliveries ORDER BY id DESC LIMIT 100'
    );

    const statsRes = await db.execute(
      'SELECT status, COUNT(*) as count FROM deliveries GROUP BY status'
    );

    const stats = { confirmed: 0, rejected: 0, pending: 0, total: 0 };
    statsRes.rows.forEach((r) => {
      if (r.status === 'confirmed') stats.confirmed = Number(r.count);
      if (r.status === 'rejected') stats.rejected = Number(r.count);
      if (r.status === 'pending') stats.pending = Number(r.count);
    });
    stats.total = stats.confirmed + stats.rejected + stats.pending;

    // Today stats in Asia/Tashkent (stored created_at is local wall clock)
    const { todayLocal } = require('@/lib/time');
    const today = todayLocal();
    const todayRes = await db.execute(
      'SELECT status, COUNT(*) as cnt FROM deliveries WHERE created_at LIKE ? GROUP BY status',
      [`${today}%`]
    );
    const todayStats = { confirmed: 0, rejected: 0, pending: 0, total: 0 };
    todayRes.rows.forEach((r) => {
      const n = Number(r.cnt || r.count || 0);
      if (r.status === 'confirmed') todayStats.confirmed = n;
      if (r.status === 'rejected') todayStats.rejected = n;
      if (r.status === 'pending') todayStats.pending = n;
    });
    todayStats.total = todayStats.confirmed + todayStats.rejected + todayStats.pending;

    const statusEmoji = { pending: '⏳', confirmed: '✅', rejected: '❌' };
    const typeEmoji = { pickup: '📦', delivery: '🚚' };

    const deliveries = res.rows.map((d) => ({
      id: d.id,
      driver_id: d.driver_id,
      driver_name: d.driver_name,
      branch_id: d.branch_id,
      branch_name: d.branch_name,
      status: d.status,
      type: d.type,
      emoji: statusEmoji[d.status] || '❓',
      type_emoji: typeEmoji[d.type] || '📦',
      driver_lat: d.driver_lat,
      driver_lng: d.driver_lng,
      distance: Math.round(d.distance || 0),
      created_at: d.created_at,
      confirmed_at: d.confirmed_at,
      confirmed_by_name: d.confirmed_by_name,
    }));

    return NextResponse.json({
      ok: true,
      stats,
      todayStats,
      deliveries,
    });
  } catch (error) {
    console.error('All deliveries API error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
