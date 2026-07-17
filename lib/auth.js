/**
 * Shared identity helpers for API routes.
 * Director actions accept phone and/or username (no role switcher).
 */
const { resolveIdentity, normalizePhone } = require('./branches');

async function resolveRequestIdentity(body = {}) {
  const phone = body.phone ? normalizePhone(body.phone) : '';
  const username = body.username ? String(body.username).replace(/^@/, '') : '';
  const telegram_id = body.telegram_id != null && body.telegram_id !== ''
    ? Number(body.telegram_id)
    : null;

  // DB ACL first (same order as get-user-role)
  try {
    const { getDb } = require('./db');
    const db = getDb();
    if (telegram_id) {
      const res = await db.execute(
        'SELECT * FROM user_access WHERE telegram_id = ?',
        [telegram_id]
      );
      if (res.rows[0]) {
        return {
          ok: true,
          role: res.rows[0].role,
          branch_id: res.rows[0].branch_id,
          matched_by: 'db',
          phone: phone || null,
          username: username || null,
          telegram_id,
        };
      }
    }
    if (username) {
      const res = await db.execute(
        'SELECT * FROM user_access WHERE LOWER(telegram_username) = ?',
        [username.toLowerCase()]
      );
      if (res.rows[0]) {
        return {
          ok: true,
          role: res.rows[0].role,
          branch_id: res.rows[0].branch_id,
          matched_by: 'db',
          phone: phone || null,
          username: username || null,
          telegram_id,
        };
      }
    }
  } catch (e) {
    console.error('resolveRequestIdentity DB error:', e.message || e);
  }

  const identity = resolveIdentity({ phone, username });
  return {
    ok: true,
    role: identity.role,
    branch_id: identity.branch_id,
    matched_by: identity.matched_by,
    label: identity.label,
    phone: identity.phone || phone || null,
    username: username || null,
    telegram_id,
  };
}

async function requireDirector(body = {}) {
  const id = await resolveRequestIdentity(body);
  if (id.role !== 'director') {
    return { ok: false, error: 'Access denied', status: 403, identity: id };
  }
  return { ok: true, identity: id };
}

module.exports = { resolveRequestIdentity, requireDirector, normalizePhone };
