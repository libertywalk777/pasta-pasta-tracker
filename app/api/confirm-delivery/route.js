import { NextResponse } from 'next/server';
import { processDeliveryConfirmation } from '@/lib/bot';
import { initDb } from '@/lib/db';

let dbInitialized = false;

export async function POST(request) {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }

  try {
    const { delivery_id, status, manager_id, manager_name } = await request.json();

    if (!delivery_id || !status || !manager_id || !manager_name) {
      return NextResponse.json({ ok: false, error: 'Missing parameters' }, { status: 400 });
    }

    if (status !== 'confirmed' && status !== 'rejected') {
      return NextResponse.json({ ok: false, error: 'Invalid status' }, { status: 400 });
    }

    const res = await processDeliveryConfirmation(
      Number(delivery_id),
      status,
      Number(manager_id),
      manager_name
    );

    if (res.ok) {
      return NextResponse.json({ ok: true });
    } else {
      return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
    }
  } catch (error) {
    console.error('Confirm delivery API error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
