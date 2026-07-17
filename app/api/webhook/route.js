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
    const webhookUrl = `${url.origin}/api/webhook`;
    const res = await setWebhook(webhookUrl);
    return NextResponse.json({ ok: true, webhook: webhookUrl, ...res });
  }

  if (searchParams.get('diagnose') === '1') {
    const report = await diagnoseBot();
    return NextResponse.json({ ok: true, ...report });
  }

  return NextResponse.json({ status: 'running' });
}
