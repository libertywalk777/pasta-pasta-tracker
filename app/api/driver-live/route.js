import { NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';
import { requireDirector } from '@/lib/auth';
import { haversine } from '@/lib/geo';
import { DRIVERS, BRANCHES, FACTORY } from '@/lib/branches';

let dbInitialized = false;

function toIsoMinutesAgo(mins) {
  return new Date(Date.now() - mins * 60 * 1000).toISOString();
}

function formatDuration(ms) {
  if (!ms || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}ч ${m}м`;
  if (m > 0) return `${m}м ${sec}с`;
  return `${sec}с`;
}

/**
 * POST /api/driver-live
 * Director-only. Returns latest positions + path stats for drivers.
 * Body: { username?, phone?, telegram_id?, since_minutes? }
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

    const sinceMinutes = Math.min(Math.max(Number(body.since_minutes) || 180, 15), 24 * 60);
    const since = toIsoMinutesAgo(sinceMinutes);
    const db = getDb();

    let rows = [];
    try {
      const res = await db.execute(
        'SELECT * FROM driver_tracks WHERE created_at >= ? ORDER BY id DESC LIMIT 2000',
        [since]
      );
      rows = res.rows || [];
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('driver_tracks') || msg.includes('schema cache') || e.code === 'PGRST205') {
        return NextResponse.json({
          ok: true,
          table_missing: true,
          drivers: [],
          points: [],
          message: 'Run supabase/migrate_driver_tracks.sql in Supabase SQL Editor',
          branches: BRANCHES,
          factory: FACTORY,
        });
      }
      throw e;
    }

    // Group by driver_id (rows already newest-first)
    const byDriver = new Map();
    for (const p of rows) {
      const id = Number(p.driver_id);
      if (!byDriver.has(id)) byDriver.set(id, []);
      byDriver.get(id).push(p);
    }

    const rosterByPhone = new Map(
      (DRIVERS || []).map((d) => [
        String(d.phone || '').replace(/\D/g, ''),
        d,
      ])
    );

    const drivers = [];
    for (const [driverId, pointsDesc] of byDriver.entries()) {
      // chronological
      const points = [...pointsDesc].reverse();
      const first = points[0];
      const last = points[points.length - 1];

      let distanceM = 0;
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        const seg = haversine(Number(a.lat), Number(a.lng), Number(b.lat), Number(b.lng));
        // ignore GPS jumps > 2km between samples
        if (seg < 2000) distanceM += seg;
      }

      const t0 = new Date(first.created_at).getTime();
      const t1 = new Date(last.created_at).getTime();
      const durationMs = t1 - t0;
      const hours = durationMs > 0 ? durationMs / 3600000 : 0;
      const avgKmh = hours > 0 ? distanceM / 1000 / hours : 0;

      const phoneDigits = String(last.phone || '').replace(/\D/g, '');
      const roster = rosterByPhone.get(phoneDigits);
      const ageSec = Math.max(0, Math.round((Date.now() - t1) / 1000));
      const online = ageSec <= 90;

      drivers.push({
        driver_id: driverId,
        driver_name: last.driver_name || roster?.name || `Driver ${driverId}`,
        phone: last.phone || roster?.phone || null,
        username: roster?.username || null,
        online,
        last_seen: last.created_at,
        age_sec: ageSec,
        lat: Number(last.lat),
        lng: Number(last.lng),
        accuracy: last.accuracy != null ? Number(last.accuracy) : null,
        speed: last.speed != null ? Number(last.speed) : null,
        heading: last.heading != null ? Number(last.heading) : null,
        points_count: points.length,
        distance_m: Math.round(distanceM),
        distance_km: Math.round((distanceM / 1000) * 100) / 100,
        duration_ms: durationMs,
        duration_label: formatDuration(durationMs),
        avg_kmh: Math.round(avgKmh * 10) / 10,
        path: points.map((p) => ({
          lat: Number(p.lat),
          lng: Number(p.lng),
          t: p.created_at,
          speed: p.speed != null ? Number(p.speed) : null,
        })),
      });
    }

    // Sort: online first, then last_seen desc
    drivers.sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      return new Date(b.last_seen) - new Date(a.last_seen);
    });

    return NextResponse.json({
      ok: true,
      since,
      since_minutes: sinceMinutes,
      drivers,
      roster_drivers: DRIVERS,
      branches: BRANCHES,
      factory: FACTORY,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('driver-live API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
