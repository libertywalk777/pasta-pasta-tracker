import { NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';

let dbInitialized = false;

export async function POST(request) {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }

  try {
    const { branch_id } = await request.json();
    if (branch_id === undefined) {
      return NextResponse.json({ ok: false, error: 'Missing branch_id' }, { status: 400 });
    }

    const db = getDb();
    const res = await db.execute(
      'SELECT * FROM deliveries WHERE branch_id = ? ORDER BY id DESC LIMIT 30',
      [Number(branch_id)]
    );

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

    return NextResponse.json({ ok: true, deliveries });
  } catch (error) {
    console.error('Branch deliveries API error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
