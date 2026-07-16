// ─── Branches + people roster (phone-first identity) ───

const BRANCHES = [
  {
    id: 1,
    name: 'C1 Dark',
    address: 'Массив Буюк Ипак Йули 36',
    lat: 41.310862,
    lng: 69.288302,
    manager_username: 'B_o_b_rakh_tigermma',
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
    manager_phone: null,
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
    manager_phone: null,
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
  manager_phone: null,
};

const DRIVER = {
  name: 'Развозчик',
  phone: '+998935664333',
};

const DIRECTOR = {
  username: process.env.DIRECTOR_USERNAME || 'grxt777',
  phone: process.env.DIRECTOR_PHONE || null,
};

/**
 * Normalize phone to digits-only international form without '+'.
 * Examples: "+998 99 874 15 11" → "998998741511"
 *           "998741511" (9 digits local) → "998998741511"  if starts with missing country? 
 *           We only auto-prefix 998 when local mobile is 9 digits.
 */
function normalizePhone(raw) {
  if (raw == null || raw === '') return '';
  let d = String(raw).replace(/\D/g, '');
  if (!d) return '';
  // Strip leading 00
  if (d.startsWith('00')) d = d.slice(2);
  // Uzbekistan local 9-digit (90/91/93/94/95/97/98/99...)
  if (d.length === 9) d = '998' + d;
  // Sometimes stored as 8 998 ...
  if (d.length === 12 && d.startsWith('8')) d = d.slice(1);
  return d;
}

/**
 * Static roster used for automatic role detection.
 * Priority when resolving: phone → username → default driver.
 */
function buildRoster() {
  const people = [];

  // Driver
  people.push({
    role: 'driver',
    branch_id: null,
    username: null,
    phone: normalizePhone(DRIVER.phone),
    label: DRIVER.name,
  });

  // Director
  people.push({
    role: 'director',
    branch_id: null,
    username: (DIRECTOR.username || '').toLowerCase(),
    phone: normalizePhone(DIRECTOR.phone),
    label: 'Директор',
  });

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

  // Unknown person → driver by default (operational default for the mini-app)
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
  DIRECTOR,
  ROSTER,
  normalizePhone,
  resolveIdentity,
};
