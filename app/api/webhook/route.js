import { NextResponse } from 'next/server';
import { handleUpdate, setWebhook, diagnoseBot } from '@/lib/bot';
import { initDb } from '@/lib/db';

let dbInitialized = false;

export async function POST(request) {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }

  try {
    const body = await request.json();
    // Process update in background — return 200 quickly so Telegram doesn't retry
    handleUpdate(body).catch((e) => console.error('Webhook handler error:', e));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Webhook error:', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// GET — setup webhook / diagnose bot group access
//   /api/webhook?setup=1     → set webhook
//   /api/webhook?diagnose=1  → check token + group write access
export async function GET(request) {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }

  const { searchParams } = new URL(request.url);

  if (searchParams.get('setup') === '1') {
    const url = new URL(request.url);
    // Prefer explicit production host if behind proxy
    const host = request.headers.get('x-forwarded-host') || url.host;
    const proto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '') || 'https';
    const webhookUrl = `${proto}://${host}/api/webhook`;
    const res = await setWebhook(webhookUrl);
    const status = res.ok ? 200 : 500;
    return NextResponse.json({ ...res, webhook: webhookUrl }, { status });
  }

  if (searchParams.get('diagnose') === '1') {
    const report = await diagnoseBot();
    return NextResponse.json({ ok: true, ...report });
  }

  return NextResponse.json({ status: 'running' });
}
