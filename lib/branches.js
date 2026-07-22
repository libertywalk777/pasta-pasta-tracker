// ─── Branches + people roster (phone-first identity) ───

const BRANCHES = [
  {
    id: 1,
    name: 'C1 Dark',
    address: 'Массив Буюк Ипак Йули 36',
    lat: 41.310862,
    lng: 69.288302,
    manager_username: 'B_o_b_rakhmma',
    manager_phone: '+998998741511',
  },
  {
    id: 2,
    name: 'Ecopark Cafe',
    address: 'Узбекистон Овози 28',
    lat: 41.311676,
    lng: 69.292960,
    manager_username: 'zubayrmma',
    manager_phone: '+998958773398',
  },
  {
    id: 3,
    name: 'Shevchenko Cafe',
    address: 'Шевченко 21А',
    lat: 41.297168,
    lng: 69.281061,
    manager_username: 'sob1rov_f1',
    manager_phone: '+998975752003',
  },
  {
    id: 4,
    name: 'Boulevard Cafe',
    address: 'Укчи 6',
    lat: 41.316910,
    lng: 69.245351,
    manager_username: 'Ibn_Abdulloh',
    manager_phone: '+998901337013',
  },
  {
    id: 5,
    name: 'SeoulMun Cafe',
    address: 'Баходыра 69/1',
    lat: 41.298851,
    lng: 69.246487,
    manager_username: 'I_A_R_10',
    manager_phone: '+998931222742',
    // Only SeoulMun: 1 km geofence (others use default MAX_DISTANCE_METERS)
    max_distance_meters: 1000,
  },
  {
    id: 6,
    name: 'Beruni Cafe',
    address: 'Беруни 41',
    lat: 41.344840,
    lng: 69.204587,
    manager_username: 'shislam_099',
    manager_phone: '+998900999833',
  },
];

const FACTORY = {
  id: 0,
  name: 'Фабрика',
  address: '1-й проезд Мукими 23а',
  lat: 41.277943,
  lng: 69.246124,
  manager_username: 'nicknet97',
  manager_phone: '+998930005045',
};

const DRIVERS = [
  { name: 'Развозчик', phone: '+998935664333', username: null },
  { name: 'Dominify Group', phone: '+998200300193', username: 'dominifygroup' },
];

// Back-compat single DRIVER (primary)
const DRIVER = DRIVERS[0];

/** Multiple directors supported (phone + username) */
const DIRECTORS = [
  { username: 'grxt777', phone: '+998933762109', label: 'Директор' },
  { username: 'javdat_n', phone: '+998996444333', label: 'Директор' },
];

// Back-compat single DIRECTOR (primary)
const DIRECTOR = {
  username: process.env.DIRECTOR_USERNAME || DIRECTORS[0].username,
  phone: process.env.DIRECTOR_PHONE || DIRECTORS[0].phone,
};

/**
 * Normalize phone to digits-only international form without '+'.
 * Examples: "+998 99 874 15 11" → "998998741511"
 *           "998741511" (9 digits local) → "998998741511"
 */
function normalizePhone(raw) {
  if (raw == null || raw === '') return '';
  let d = String(raw).replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  // Uzbekistan local 9-digit
  if (d.length === 9) d = '998' + d;
  if (d.length === 12 && d.startsWith('8')) d = d.slice(1);
  return d;
}

function isDirectorIdentity({ phone, username } = {}) {
  const p = normalizePhone(phone);
  const u = (username || '').replace(/^@/, '').toLowerCase();
  return DIRECTORS.some((d) => {
    const dp = normalizePhone(d.phone);
    const du = (d.username || '').toLowerCase();
    return (p && dp && p === dp) || (u && du && u === du);
  });
}

/**
 * Static roster used for automatic role detection.
 * Priority when resolving: phone → username → default driver.
 */
function buildRoster() {
  const people = [];

  // Drivers (all)
  for (const d of DRIVERS) {
    people.push({
      role: 'driver',
      branch_id: null,
      username: (d.username || '').toLowerCase() || null,
      phone: normalizePhone(d.phone),
      label: d.name || 'Развозчик',
    });
  }

  // Directors (all)
  for (const d of DIRECTORS) {
    people.push({
      role: 'director',
      branch_id: null,
      username: (d.username || '').toLowerCase(),
      phone: normalizePhone(d.phone),
      label: d.label || 'Директор',
    });
  }

  // Factory manager
  people.push({
    role: 'manager',
    branch_id: FACTORY.id,
    username: (FACTORY.manager_username || '').toLowerCase(),
    phone: normalizePhone(FACTORY.manager_phone),
    label: FACTORY.name,
  });

  // Branch managers
  for (const b of BRANCHES) {
    people.push({
      role: 'manager',
      branch_id: b.id,
      username: (b.manager_username || '').toLowerCase(),
      phone: normalizePhone(b.manager_phone),
      label: b.name,
    });
  }

  return people;
}

const ROSTER = buildRoster();

/**
 * Resolve role from phone and/or username.
 * Phone match wins over username.
 */
function resolveIdentity({ phone, username } = {}) {
  const p = normalizePhone(phone);
  const u = (username || '').replace(/^@/, '').toLowerCase();

  if (p) {
    const byPhone = ROSTER.find((r) => r.phone && r.phone === p);
    if (byPhone) {
      return {
        ok: true,
        role: byPhone.role,
        branch_id: byPhone.branch_id,
        matched_by: 'phone',
        label: byPhone.label,
        phone: p,
      };
    }
  }

  if (u) {
    const byUser = ROSTER.find((r) => r.username && r.username === u);
    if (byUser) {
      return {
        ok: true,
        role: byUser.role,
        branch_id: byUser.branch_id,
        matched_by: 'username',
        label: byUser.label,
        phone: byUser.phone || p || null,
      };
    }
  }

  // Unknown person → driver by default
  return {
    ok: true,
    role: 'driver',
    branch_id: null,
    matched_by: 'default',
    label: DRIVER.name,
    phone: p || null,
  };
}

module.exports = {
  BRANCHES,
  FACTORY,
  DRIVER,
  DRIVERS,
  DIRECTOR,
  DIRECTORS,
  ROSTER,
  normalizePhone,
  resolveIdentity,
  isDirectorIdentity,
};
