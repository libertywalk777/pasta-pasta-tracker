import { NextResponse } from 'next/server';
import { BRANCHES, FACTORY } from '@/lib/branches';
import { haversine } from '@/lib/geo';
import { getDb, initDb } from '@/lib/db';
import { notifyManager } from '@/lib/bot';
import { nowLocal } from '@/lib/time';

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
    const defaultMax = Number(process.env.MAX_DISTANCE_METERS || 300);
    // Per-branch override (e.g. SeoulMun = 1000m), else global default
    const maxDist = Number(
      target.max_distance_meters != null ? target.max_distance_meters : defaultMax
    );

    if (distance > maxDist) {
      return NextResponse.json({
        ok: false,
        error: 'too_far',
        distance: Math.round(distance),
        max: maxDist,
        message: `Вы слишком далеко (${Math.round(distance)} м). Допустимо: ${maxDist} м`,
      });
    }

    // Asia/Tashkent wall clock (UTC+5) — not UTC
    const now = nowLocal();
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

    // 2) MUST await group/manager notify on Vercel — fire-and-forget gets frozen after response
    let notify = { ok: false };
    try {
      await notifyManager(deliveryId, target.id);
      notify = { ok: true };
    } catch (e) {
      console.error('Notify failed:', e?.message || e);
      notify = { ok: false, error: e?.message || String(e) };
    }

    return NextResponse.json({
      ok: true,
      delivery_id: deliveryId,
      distance: Math.round(distance),
      branch_name: target.name,
      status: 'pending',
      type: deliveryType,
      created_at: now,
      max_distance: maxDist,
      notified: notify.ok,
      notify_error: notify.ok ? null : notify.error || null,
    });
  } catch (error) {
    console.error('Deliver API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
