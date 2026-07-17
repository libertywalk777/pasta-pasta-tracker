/**
 * Full A→Z integration test against local Next.js + live Supabase.
 * Run: node scratch/full_test.js [baseUrl]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:3000';

const phones = {
  c1: '998998741511',
  eco: '998958773398',
  blvd: '998901337013',
  beruni: '998900999833',
  driver: '998935664333',
};

let passed = 0;
let failed = 0;
const results = [];

function ok(name, detail = '') {
  passed++;
  results.push({ name, ok: true, detail });
  console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`);
}
function fail(name, detail = '') {
  failed++;
  results.push({ name, ok: false, detail });
  console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
}

async function api(path, body = {}) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { _raw: text };
  }
  return { status: r.status, json };
}

async function main() {
  console.log(`\n🧪 Full test → ${BASE}\n`);

  // 1. Branches
  console.log('── Branches ──');
  {
    const { status, json } = await api('/api/branches');
    if (status === 200 && json.branches?.length === 6 && json.factory?.id === 0) {
      ok('GET/POST /api/branches', `${json.branches.length} branches + factory`);
    } else fail('branches', `status=${status} body=${JSON.stringify(json).slice(0, 200)}`);

    const withPhone = (json.branches || []).filter((b) => b.manager_phone);
    if (withPhone.length >= 4) ok('manager phones exposed', withPhone.map((b) => b.name).join(', '));
    else fail('manager phones', `only ${withPhone.length}`);
  }

  // 2. Role by phone
  console.log('\n── Auto role by phone ──');
  const roleCases = [
    { phone: phones.c1, expect: 'manager', branch: 1, label: 'C1 Dark' },
    { phone: phones.eco, expect: 'manager', branch: 2, label: 'Ecopark' },
    { phone: phones.blvd, expect: 'manager', branch: 4, label: 'Boulevard' },
    { phone: phones.beruni, expect: 'manager', branch: 6, label: 'Beruni' },
    { phone: phones.driver, expect: 'driver', branch: null, label: 'Driver' },
    { phone: '+998 99 874 15 11', expect: 'manager', branch: 1, label: 'C1 formatted' },
    { phone: '998741511', expect: 'manager', branch: 1, label: 'C1 local 9-digit' },
  ];
  for (const c of roleCases) {
    const { json } = await api('/api/get-user-role', { phone: c.phone });
    if (json.ok && json.role === c.expect && (c.branch == null || json.branch_id === c.branch)) {
      ok(`role phone ${c.label}`, `${json.role} branch=${json.branch_id} via ${json.matched_by}`);
    } else {
      fail(`role phone ${c.label}`, JSON.stringify(json));
    }
  }

  // username fallback
  {
    const { json } = await api('/api/get-user-role', { username: 'grxt777' });
    if (json.ok && json.role === 'director') ok('role username director grxt777');
    else fail('role username director', JSON.stringify(json));
  }
  {
    const { json } = await api('/api/get-user-role', { username: 'zubayrmma' });
    if (json.ok && json.role === 'manager' && json.branch_id === 2) ok('role username zubayrmma → Ecopark');
    else fail('role username zubayrmma', JSON.stringify(json));
  }
  {
    const { json } = await api('/api/get-user-role', { username: 'random_person_xyz' });
    if (json.ok && json.role === 'driver') ok('unknown user → driver default');
    else fail('unknown default', JSON.stringify(json));
  }

  // 3. Deliver flow (geo ok)
  console.log('\n── Deliver + confirm flow ──');
  let deliveryId = null;
  {
    // C1 Dark coords
    const { status, json } = await api('/api/deliver', {
      driver_id: 555001,
      driver_name: 'Test Driver',
      branch_id: 1,
      lat: 41.310862,
      lng: 69.288302,
      type: 'delivery',
    });
    if (status === 200 && json.ok && json.delivery_id) {
      deliveryId = json.delivery_id;
      ok('deliver near C1 Dark', `id=${deliveryId} dist=${json.distance}m`);
    } else fail('deliver near', JSON.stringify(json));
  }

  // too far
  {
    const { json } = await api('/api/deliver', {
      driver_id: 555001,
      driver_name: 'Test Driver',
      branch_id: 1,
      lat: 41.0,
      lng: 69.0,
      type: 'delivery',
    });
    if (json.ok === false && json.error === 'too_far') ok('deliver too far rejected', `${json.distance}m`);
    else fail('deliver too far', JSON.stringify(json));
  }

  // pickup at factory
  let pickupId = null;
  {
    const { json } = await api('/api/deliver', {
      driver_id: 555001,
      driver_name: 'Test Driver',
      branch_id: 0,
      lat: 41.277943,
      lng: 69.246124,
      type: 'pickup',
    });
    if (json.ok && json.delivery_id) {
      pickupId = json.delivery_id;
      ok('pickup at factory', `id=${pickupId}`);
    } else fail('pickup', JSON.stringify(json));
  }

  // my-deliveries
  {
    const { json } = await api('/api/my-deliveries', { driver_id: 555001 });
    if (Array.isArray(json.deliveries) && json.deliveries.length >= 2) {
      ok('my-deliveries', `${json.deliveries.length} items`);
    } else fail('my-deliveries', JSON.stringify(json).slice(0, 200));
  }

  // branch-deliveries
  {
    const { json } = await api('/api/branch-deliveries', { branch_id: 1 });
    if (json.ok && Array.isArray(json.deliveries)) ok('branch-deliveries C1', `${json.deliveries.length} items`);
    else fail('branch-deliveries', JSON.stringify(json).slice(0, 200));
  }

  // confirm delivery
  if (deliveryId) {
    const { json } = await api('/api/confirm-delivery', {
      delivery_id: deliveryId,
      status: 'confirmed',
      manager_id: 777001,
      manager_name: 'Test Manager',
    });
    if (json.ok) ok('confirm delivery', `id=${deliveryId}`);
    else fail('confirm', JSON.stringify(json));

    // double confirm should fail
    const r2 = await api('/api/confirm-delivery', {
      delivery_id: deliveryId,
      status: 'confirmed',
      manager_id: 777001,
      manager_name: 'Test Manager',
    });
    if (r2.json.ok === false) ok('double confirm blocked');
    else fail('double confirm', JSON.stringify(r2.json));
  }

  // reject pickup
  if (pickupId) {
    const { json } = await api('/api/confirm-delivery', {
      delivery_id: pickupId,
      status: 'rejected',
      manager_id: 777002,
      manager_name: 'Factory Manager',
    });
    if (json.ok) ok('reject pickup', `id=${pickupId}`);
    else fail('reject pickup', JSON.stringify(json));
  }

  // delivery-status
  if (deliveryId) {
    const { json } = await api('/api/delivery-status', { delivery_id: deliveryId });
    if (json.status === 'confirmed') ok('delivery-status confirmed');
    else fail('delivery-status', JSON.stringify(json));
  }

  // 4. Director APIs (identity by username/phone — no role switcher)
  console.log('\n── Director ──');
  {
    const { json } = await api('/api/all-deliveries', { username: 'grxt777' });
    if (json.ok && json.stats && json.todayStats && Array.isArray(json.deliveries)) {
      ok(
        'all-deliveries director',
        `all=${json.stats.total} today=${json.todayStats.total} list=${json.deliveries.length}`
      );
    } else fail('all-deliveries', JSON.stringify(json).slice(0, 200));
  }
  {
    const { status, json } = await api('/api/all-deliveries', { username: 'hacker' });
    if (status === 403 || json.ok === false) ok('all-deliveries denied for non-director');
    else fail('all-deliveries ACL', JSON.stringify(json));
  }
  {
    // driver phone must NOT see director dashboard
    const { status, json } = await api('/api/all-deliveries', { phone: phones.driver });
    if (status === 403 || json.ok === false) ok('driver phone denied director API');
    else fail('driver director ACL', JSON.stringify(json));
  }

  // grant / list / revoke access
  {
    const tgId = 888001;
    let r = await api('/api/grant-access', {
      username: 'grxt777',
      target_telegram_id: tgId,
      telegram_username: 'test_mgr',
      role: 'manager',
      branch_id: 3,
    });
    if (r.json.ok) ok('grant-access manager Shevchenko');
    else fail('grant-access', JSON.stringify(r.json));

    r = await api('/api/get-user-role', { telegram_id: tgId });
    if (r.json.ok && r.json.role === 'manager' && r.json.branch_id === 3 && r.json.matched_by === 'db') {
      ok('role from DB ACL', `branch ${r.json.branch_id}`);
    } else fail('role DB ACL', JSON.stringify(r.json));

    r = await api('/api/get-access-list', { username: 'grxt777' });
    if (r.json.ok && (r.json.accessList || []).some((a) => Number(a.telegram_id) === tgId)) {
      ok('get-access-list contains granted user');
    } else fail('get-access-list', JSON.stringify(r.json).slice(0, 200));

    r = await api('/api/revoke-access', {
      username: 'grxt777',
      target_telegram_id: tgId,
    });
    if (r.json.ok) ok('revoke-access');
    else fail('revoke-access', JSON.stringify(r.json));
  }

  // Dashboard visibility: new events appear in director feed
  {
    const before = await api('/api/all-deliveries', { username: 'grxt777' });
    const beforeCount = before.json.stats?.total || 0;
    const d = await api('/api/deliver', {
      driver_id: 555999,
      driver_name: 'Dash Test',
      branch_id: 2,
      lat: 41.311676,
      lng: 69.292960,
      type: 'delivery',
    });
    if (!d.json.ok) fail('dashboard seed deliver', JSON.stringify(d.json));
    else {
      const after = await api('/api/all-deliveries', { username: 'grxt777' });
      const list = after.json.deliveries || [];
      const found = list.find((x) => Number(x.id) === Number(d.json.delivery_id));
      if (found && after.json.stats.total >= beforeCount + 1) {
        ok('director dashboard shows new delivery', `#${found.id} ${found.branch_name} ${found.status}`);
      } else {
        fail('director dashboard missing event', JSON.stringify({ found, total: after.json.stats }));
      }
    }
  }

  // 5. Frontend shell
  console.log('\n── Frontend ──');
  {
    const r = await fetch(BASE + '/');
    const html = await r.text();
    if (r.status === 200 && html.includes('Доставка') || html.includes('__next') || html.includes('root')) {
      ok('GET / renders', `status=${r.status} len=${html.length}`);
    } else fail('GET /', `status=${r.status}`);
    if (html.includes('telegram-web-app.js')) ok('Telegram WebApp SDK in HTML');
    else fail('Telegram SDK missing from layout HTML');
  }

  // webhook status
  {
    const r = await fetch(BASE + '/api/webhook');
    const json = await r.json();
    if (json.status === 'running') ok('webhook GET status running');
    else fail('webhook', JSON.stringify(json));
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
