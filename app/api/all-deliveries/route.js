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
    
    // Director username verification (hardcoded for grxt777 or set via env if needed)
    const directorUsername = process.env.DIRECTOR_USERNAME || 'grxt777';
    if (!username || username.toLowerCase() !== directorUsername.toLowerCase()) {
      return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 });
    }

    const db = getDb();
    
    // Fetch all deliveries
    const res = await db.execute(
      'SELECT * FROM deliveries ORDER BY id DESC LIMIT 100'
    );

    // Fetch stats
    const statsRes = await db.execute(
      'SELECT status, COUNT(*) as count FROM deliveries GROUP BY status'
    );

    const stats = { confirmed: 0, rejected: 0, pending: 0, total: 0 };
    statsRes.rows.forEach(r => {
      if (r.status === 'confirmed') stats.confirmed = Number(r.count);
      if (r.status === 'rejected') stats.rejected = Number(r.count);
      if (r.status === 'pending') stats.pending = Number(r.count);
    });
    stats.total = stats.confirmed + stats.rejected + stats.pending;

    const statusEmoji = { pending: '⏳', confirmed: '✅', rejected: '❌' };
    const typeEmoji = { pickup: '📦', delivery: '🚚' };

    const deliveries = res.rows.map(d => ({
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
      distance: Math.round(d.distance),
      created_at: d.created_at,
      confirmed_at: d.confirmed_at,
      confirmed_by_name: d.confirmed_by_name,
    }));

    return NextResponse.json({ ok: true, stats, deliveries });
  } catch (error) {
    console.error('All deliveries API error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
