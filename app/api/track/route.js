import { NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';

let dbInitialized = false;

/**
 * POST /api/track
 * Body: { driver_id, driver_name?, phone?, lat, lng, accuracy?, speed?, heading? }
 * Saves a GPS point for live tracking (works while Mini App is open / background if OS allows).
 */
export async function POST(request) {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }

  try {
    const body = await request.json();
    const { driver_id, driver_name, phone, lat, lng, accuracy, speed, heading } = body;

    if (!driver_id || lat == null || lng == null) {
      return NextResponse.json(
        { ok: false, error: 'driver_id, lat, lng required' },
        { status: 400 }
      );
    }

    const la = Number(lat);
    const ln = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) {
      return NextResponse.json({ ok: false, error: 'Invalid coordinates' }, { status: 400 });
    }
    if (Math.abs(la) > 90 || Math.abs(ln) > 180) {
      return NextResponse.json({ ok: false, error: 'Coordinates out of range' }, { status: 400 });
    }

    const db = getDb();
    const res = await db.execute(
      `INSERT INTO driver_tracks (driver_id, driver_name, phone, lat, lng, accuracy, speed, heading)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(driver_id),
        driver_name || null,
        phone || null,
        la,
        ln,
        accuracy != null ? Number(accuracy) : null,
        speed != null ? Number(speed) : null,
        heading != null ? Number(heading) : null,
      ]
    );

    return NextResponse.json({
      ok: true,
      id: res.rows[0]?.id || null,
      ts: new Date().toISOString(),
    });
  } catch (error) {
    // Table may not exist yet
    const msg = error.message || String(error);
    console.error('Track API error:', msg);
    if (msg.includes('driver_tracks') || msg.includes('schema cache') || error.code === 'PGRST205') {
      return NextResponse.json(
        {
          ok: false,
          error: 'table_missing',
          message:
            'Run supabase/migrate_driver_tracks.sql in Supabase SQL Editor once',
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
