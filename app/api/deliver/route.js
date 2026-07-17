import { NextResponse } from 'next/server';
import { BRANCHES, FACTORY } from '@/lib/branches';
import { haversine } from '@/lib/geo';
import { getDb, initDb } from '@/lib/db';
import { notifyManager } from '@/lib/bot';

let dbInitialized = false;

export async function POST(request) {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }

  try {
    const body = await request.json();
    const { driver_id, driver_name, branch_id, lat, lng, type } = body;

    if (!driver_id || branch_id == null || lat == null || lng == null) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
    }

    const deliveryType = type || 'delivery';
    const target =
      deliveryType === 'pickup' ? FACTORY : BRANCHES.find((b) => b.id === Number(branch_id));

    if (!target) {
      return NextResponse.json({ ok: false, error: 'Location not found' }, { status: 400 });
    }

    const distance = haversine(Number(lat), Number(lng), target.lat, target.lng);
    const maxDist = Number(process.env.MAX_DISTANCE_METERS || 300);

    if (distance > maxDist) {
      return NextResponse.json({
        ok: false,
        error: 'too_far',
        distance: Math.round(distance),
        max: maxDist,
        message: `Вы слишком далеко (${Math.round(distance)} м). Допустимо: ${maxDist} м`,
      });
    }

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const db = getDb();

    // 1) Always persist to Supabase first
    const res = await db.execute(
      `INSERT INTO deliveries (driver_id, driver_name, type, branch_id, branch_name, status, driver_lat, driver_lng, distance, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?) RETURNING id`,
      [
        Number(driver_id),
        driver_name || 'Развозчик',
        deliveryType,
        target.id,
        target.name,
        Number(lat),
        Number(lng),
        distance,
        now,
      ]
    );

    const deliveryId = Number(res.rows[0]?.id || 0);
    if (!deliveryId) {
      return NextResponse.json({ ok: false, error: 'Failed to save delivery' }, { status: 500 });
    }

    // 2) Notify manager + group about ANY new action (pickup / delivery)
    //    Group gets the event immediately; manager gets confirm buttons.
    notifyManager(deliveryId, target.id).catch((e) =>
      console.error('Notify failed:', e?.message || e)
    );

    return NextResponse.json({
      ok: true,
      delivery_id: deliveryId,
      distance: Math.round(distance),
      branch_name: target.name,
      status: 'pending',
      type: deliveryType,
      created_at: now,
    });
  } catch (error) {
    console.error('Deliver API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
