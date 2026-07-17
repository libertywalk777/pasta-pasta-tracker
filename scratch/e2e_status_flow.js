/**
 * A→Z end-to-end: roles, deliver, confirm, reject, ACL, statuses, director feed.
 * Usage: node scratch/e2e_status_flow.js [baseUrl]
 */
const BASE = process.argv[2] || 'https://pasta-pasta-tracker.vercel.app';

let passed = 0;
let failed = 0;
const logs = [];

function ok(name, detail = '') {
  passed++;
  logs.push({ ok: true, name, detail });
  console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`);
}
function fail(name, detail = '') {
  failed++;
  logs.push({ ok: false, name, detail });
  console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
}

async function api(path, body = {}, method = 'POST') {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { _raw: text.slice(0, 300) };
  }
  return { status: r.status, json, text };
}

async function main() {
  console.log(`\n🧪 E2E A→Z status flow → ${BASE}\n`);
  const runId = Date.now();
  // Real-looking but synthetic telegram ids for isolation
  const DRIVER_ID = 910000000 + (runId % 100000);
  const MGR_C1_ID = 920000001;
  const MGR_ECO_ID = 920000002;

  // ── 0. Health / webhook ──
  console.log('── 0. Health & webhook ──');
  {
    const r = await fetch(`${BASE}/api/webhook`);
    const j = await r.json();
    if (r.status === 200 && j.status === 'running') ok('webhook running');
    else fail('webhook', JSON.stringify(j));
  }
  {
    const r = await fetch(`${BASE}/api/webhook?diagnose=1`);
    const j = await r.json();
    if (j.ok && j.has_token) ok('diagnose has BOT_TOKEN', j.bot?.username || '');
    else fail('diagnose token', JSON.stringify(j).slice(0, 200));
    if (j.group_chat_id) ok('diagnose GROUP_CHAT_ID', String(j.group_chat_id));
    else fail('diagnose group id missing');
    if (j.group_send_test?.ok) ok('diagnose group send works', `msg=${j.group_send_test.message_id}`);
    else fail('diagnose group send', JSON.stringify(j.group_send_test));
    if (j.webhook_info?.url) ok('webhook_info url', j.webhook_info.url);
    else fail('webhook_info', JSON.stringify(j.webhook_info));
  }

  // ── 1. Roles by phone ──
  console.log('\n── 1. Roles ──');
  const roleCases = [
    { phone: '998933762109', role: 'director', branch: null, label: 'dir grxt' },
    { phone: '998996444333', role: 'director', branch: null, label: 'dir javdat' },
    { phone: '998935664333', role: 'driver', branch: null, label: 'driver' },
    { phone: '998998741511', role: 'manager', branch: 1, label: 'C1' },
    { phone: '998958773398', role: 'manager', branch: 2, label: 'Ecopark' },
    { phone: '998975752003', role: 'manager', branch: 3, label: 'Shevchenko' },
    { phone: '998901337013', role: 'manager', branch: 4, label: 'Boulevard' },
    { phone: '998931222742', role: 'manager', branch: 5, label: 'SeoulMun' },
    { phone: '998900999833', role: 'manager', branch: 6, label: 'Beruni' },
    { phone: '998930005045', role: 'manager', branch: 0, label: 'Factory' },
  ];
  for (const c of roleCases) {
    const { json } = await api('/api/get-user-role', { phone: c.phone });
    if (
      json.ok &&
      json.role === c.role &&
      (c.branch == null ? json.branch_id == null : Number(json.branch_id) === c.branch)
    ) {
      ok(`role ${c.label}`, `${json.role} branch=${json.branch_id} via ${json.matched_by}`);
    } else fail(`role ${c.label}`, JSON.stringify(json));
  }

  // ── 2. Deliver near C1 ──
  console.log('\n── 2. Deliver → pending ──');
  let deliveryId = null;
  {
    const { status, json } = await api('/api/deliver', {
      driver_id: DRIVER_ID,
      driver_name: `E2E Driver ${runId}`,
      branch_id: 1,
      lat: 41.310862,
      lng: 69.288302,
      type: 'delivery',
    });
    if (status === 200 && json.ok && json.delivery_id) {
      deliveryId = Number(json.delivery_id);
      ok('deliver near C1', `id=${deliveryId} dist=${json.distance} status=${json.status || 'pending'}`);
    } else fail('deliver near C1', JSON.stringify(json));
  }

  // too far must fail
  {
    const { json } = await api('/api/deliver', {
      driver_id: DRIVER_ID,
      driver_name: `E2E Driver ${runId}`,
      branch_id: 1,
      lat: 41.0,
      lng: 69.0,
      type: 'delivery',
    });
    if (json.ok === false && json.error === 'too_far') ok('too_far rejected', `${json.distance}m`);
    else fail('too_far', JSON.stringify(json));
  }

  // pickup factory
  let pickupId = null;
  {
    const { json } = await api('/api/deliver', {
      driver_id: DRIVER_ID,
      driver_name: `E2E Driver ${runId}`,
      branch_id: 0,
      lat: 41.277943,
      lng: 69.246124,
      type: 'pickup',
    });
    if (json.ok && json.delivery_id) {
      pickupId = Number(json.delivery_id);
      ok('pickup factory', `id=${pickupId}`);
    } else fail('pickup', JSON.stringify(json));
  }

  // status pending
  if (deliveryId) {
    const { json } = await api('/api/delivery-status', { delivery_id: deliveryId });
    if (json.status === 'pending') ok('status after deliver = pending', `#${deliveryId}`);
    else fail('status pending', JSON.stringify(json));
  }

  // my-deliveries contains both
  {
    const { json } = await api('/api/my-deliveries', { driver_id: DRIVER_ID });
    const list = json.deliveries || [];
    const ids = list.map((d) => Number(d.id));
    if (deliveryId && ids.includes(deliveryId) && pickupId && ids.includes(pickupId)) {
      ok('my-deliveries has both', `n=${list.length}`);
    } else fail('my-deliveries', JSON.stringify({ ids, deliveryId, pickupId }));
  }

  // branch-deliveries C1 has delivery
  {
    const { json } = await api('/api/branch-deliveries', { branch_id: 1 });
    const list = json.deliveries || [];
    const found = list.find((d) => Number(d.id) === deliveryId);
    if (found && found.status === 'pending') ok('branch-deliveries C1 pending', `#${deliveryId}`);
    else fail('branch-deliveries', JSON.stringify(found || list.slice(0, 2)));
  }

  // ── 3. Confirm flow ──
  console.log('\n── 3. Confirm / double-confirm ──');
  if (deliveryId) {
    const { json } = await api('/api/confirm-delivery', {
      delivery_id: deliveryId,
      status: 'confirmed',
      manager_id: MGR_C1_ID,
      manager_name: 'E2E Manager C1',
    });
    if (json.ok) ok('confirm delivery', `#${deliveryId}`);
    else fail('confirm', JSON.stringify(json));

    const st = await api('/api/delivery-status', { delivery_id: deliveryId });
    if (st.json.status === 'confirmed' && st.json.confirmed_by_name === 'E2E Manager C1') {
      ok('status confirmed + manager name', st.json.confirmed_at || '');
    } else fail('status confirmed', JSON.stringify(st.json));

    // double confirm blocked
    const d2 = await api('/api/confirm-delivery', {
      delivery_id: deliveryId,
      status: 'rejected',
      manager_id: MGR_C1_ID,
      manager_name: 'E2E Manager C1',
    });
    if (d2.json.ok === false) ok('double confirm blocked', d2.json.error || '');
    else fail('double confirm', JSON.stringify(d2.json));

    // status still confirmed
    const st2 = await api('/api/delivery-status', { delivery_id: deliveryId });
    if (st2.json.status === 'confirmed') ok('status stays confirmed after double');
    else fail('status after double', JSON.stringify(st2.json));
  }

  // ── 4. Reject flow ──
  console.log('\n── 4. Reject pickup ──');
  if (pickupId) {
    const { json } = await api('/api/confirm-delivery', {
      delivery_id: pickupId,
      status: 'rejected',
      manager_id: 930000000,
      manager_name: 'Factory Manager E2E',
    });
    if (json.ok) ok('reject pickup', `#${pickupId}`);
    else fail('reject', JSON.stringify(json));

    const st = await api('/api/delivery-status', { delivery_id: pickupId });
    if (st.json.status === 'rejected') ok('status rejected', st.json.confirmed_by_name || '');
    else fail('status rejected', JSON.stringify(st.json));
  }

  // ── 5. Invalid status ──
  console.log('\n── 5. Validation ──');
  {
    // create another pending
    const d = await api('/api/deliver', {
      driver_id: DRIVER_ID,
      driver_name: `E2E Driver ${runId}`,
      branch_id: 2,
      lat: 41.311676,
      lng: 69.292960,
      type: 'delivery',
    });
    const id = d.json.delivery_id;
    if (!id) fail('seed eco deliver', JSON.stringify(d.json));
    else {
      ok('seed eco deliver', `#${id}`);
      const bad = await api('/api/confirm-delivery', {
        delivery_id: id,
        status: 'maybe',
        manager_id: MGR_ECO_ID,
        manager_name: 'Eco',
      });
      if (bad.status === 400 || bad.json.ok === false) ok('invalid status rejected');
      else fail('invalid status', JSON.stringify(bad.json));

      // confirm this one for director feed
      const conf = await api('/api/confirm-delivery', {
        delivery_id: id,
        status: 'confirmed',
        manager_id: MGR_ECO_ID,
        manager_name: 'E2E Eco Manager',
      });
      if (conf.json.ok) ok('confirm eco', `#${id}`);
      else fail('confirm eco', JSON.stringify(conf.json));
    }
  }

  // ── 6. Director dashboard sees events ──
  console.log('\n── 6. Director dashboard ──');
  {
    const { json } = await api('/api/all-deliveries', { username: 'grxt777' });
    if (!json.ok) fail('all-deliveries', JSON.stringify(json).slice(0, 200));
    else {
      const list = json.deliveries || [];
      const foundConf = list.find((d) => Number(d.id) === deliveryId);
      const foundRej = list.find((d) => Number(d.id) === pickupId);
      if (foundConf && foundConf.status === 'confirmed') {
        ok('director feed has confirmed C1', `#${deliveryId}`);
      } else fail('director feed confirmed', JSON.stringify(foundConf));
      if (foundRej && foundRej.status === 'rejected') {
        ok('director feed has rejected pickup', `#${pickupId}`);
      } else fail('director feed rejected', JSON.stringify(foundRej));
      if (json.stats && json.stats.total >= 2) {
        ok('director stats', `total=${json.stats.total} conf=${json.stats.confirmed} rej=${json.stats.rejected} pend=${json.stats.pending}`);
      } else fail('director stats', JSON.stringify(json.stats));
      if (json.todayStats) ok('todayStats present', `today total=${json.todayStats.total}`);
      else fail('todayStats missing');
    }
  }
  {
    const { status, json } = await api('/api/all-deliveries', { username: 'not_a_director' });
    if (status === 403 || json.ok === false) ok('non-director denied all-deliveries');
    else fail('ACL all-deliveries', JSON.stringify(json));
  }
  {
    const { status, json } = await api('/api/all-deliveries', { phone: '998935664333' });
    if (status === 403 || json.ok === false) ok('driver phone denied director API');
    else fail('driver ACL', JSON.stringify(json));
  }

  // ── 7. Branch history reflects final statuses ──
  console.log('\n── 7. Branch history statuses ──');
  {
    const { json } = await api('/api/branch-deliveries', { branch_id: 1 });
    const found = (json.deliveries || []).find((d) => Number(d.id) === deliveryId);
    if (found?.status === 'confirmed' && found.confirmed_by_name) {
      ok('C1 history confirmed', found.confirmed_by_name);
    } else fail('C1 history', JSON.stringify(found));
  }
  {
    const { json } = await api('/api/branch-deliveries', { branch_id: 0 });
    const found = (json.deliveries || []).find((d) => Number(d.id) === pickupId);
    if (found?.status === 'rejected') ok('factory history rejected', `#${pickupId}`);
    else fail('factory history', JSON.stringify(found));
  }

  // ── 8. Unit: canUserConfirmBranch (local require if available) ──
  console.log('\n── 8. Branch manager gate (local) ──');
  try {
    // eslint-disable-next-line global-require
    const { canUserConfirmBranch } = require('../lib/bot');
    const a = await canUserConfirmBranch({ id: 1, username: 'zubayrmma' }, 2);
    const b = await canUserConfirmBranch({ id: 1, username: 'zubayrmma' }, 1);
    const c = await canUserConfirmBranch({ id: 1, username: 'random_x' }, 2);
    const d = await canUserConfirmBranch({ id: 1, username: 'nicknet97' }, 0);
    if (a.ok) ok('gate: zubayrmma → Ecopark allowed', a.via);
    else fail('gate eco allow', JSON.stringify(a));
    if (!b.ok) ok('gate: zubayrmma → C1 denied', b.responsible);
    else fail('gate eco on c1', JSON.stringify(b));
    if (!c.ok) ok('gate: stranger denied', c.responsible);
    else fail('gate stranger', JSON.stringify(c));
    if (d.ok) ok('gate: nicknet97 → factory allowed', d.via);
    else fail('gate factory', JSON.stringify(d));
  } catch (e) {
    fail('local canUserConfirmBranch', e.message);
  }

  // ── 9. Branches payload complete ──
  console.log('\n── 9. Branches payload ──');
  {
    const { json } = await api('/api/branches', {});
    if (json.branches?.length === 6) ok('6 branches');
    else fail('branches count', String(json.branches?.length));
    const withPhone = (json.branches || []).filter((b) => b.manager_phone);
    if (withPhone.length === 6) ok('all branch phones set');
    else fail('branch phones', withPhone.map((b) => b.name).join(','));
    if (json.factory?.manager_phone) ok('factory phone', json.factory.manager_phone);
    else fail('factory phone');
    if (json.directors?.length >= 2) ok('directors list', json.directors.map((d) => d.username).join(','));
    else fail('directors', JSON.stringify(json.directors));
  }

  console.log(`\n════════════════════════════`);
  console.log(`Passed: ${passed}  Failed: ${failed}`);
  console.log(`════════════════════════════\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
