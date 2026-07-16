const { createClient } = require('@supabase/supabase-js');

// Load .env.local for local scripts / next without hardcoding secrets in source.
try {
  // eslint-disable-next-line global-require
  const fs = require('fs');
  // eslint-disable-next-line global-require
  const path = require('path');
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath) && !process.env.SUPABASE_KEY) {
    const raw = fs.readFileSync(envPath, 'utf8');
    raw.split('\n').forEach((line) => {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    });
  }
} catch {
  // ignore
}

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://efrvxxtfkqezgvumvzjw.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

let supabase = null;
let warnedAboutSchema = false;

function getSupabase() {
  if (!supabase) {
    if (!SUPABASE_KEY) {
      throw new Error(
        'Missing SUPABASE_KEY (or SUPABASE_ANON_KEY). Set it in .env.local / Vercel env.'
      );
    }
    // Avoid realtime WebSocket requirement in Node (serverless)
    let options = {
      auth: { persistSession: false, autoRefreshToken: false },
    };
    try {
      // Optional: provide ws transport if available (Node < 22)
      // eslint-disable-next-line global-require
      const ws = require('ws');
      options.realtime = { transport: ws };
    } catch {
      // ignore
    }
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, options);
  }
  return supabase;
}

function isMissingTableError(error) {
  if (!error) return false;
  const msg = String(error.message || '');
  const code = String(error.code || '');
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('Could not find the table') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  );
}

function schemaHint(error) {
  if (!warnedAboutSchema && isMissingTableError(error)) {
    warnedAboutSchema = true;
    console.error(
      '[db] Tables missing in Supabase. Open the SQL Editor and run supabase/schema.sql once:\n' +
        '  https://supabase.com/dashboard/project/efrvxxtfkqezgvumvzjw/sql/new'
    );
  }
}

/**
 * Thin adapter so existing call sites can keep using:
 *   db.execute(sql, params) → { rows }
 *
 * Supports the exact SQL shapes used across the app (SELECT/INSERT/UPDATE/DELETE).
 * Prefer the typed helpers below for new code.
 */
function getDb() {
  return {
    execute: async (query, params = []) => {
      const sql = String(query).trim();
      const upper = sql.toUpperCase().replace(/\s+/g, ' ');

      try {
        // ─── CREATE TABLE / schema bootstrap (no-op on Supabase) ───
        if (upper.startsWith('CREATE TABLE')) {
          // Schema is managed via supabase/schema.sql — nothing to do at runtime.
          return { rows: [] };
        }

        // ─── INSERT INTO deliveries ... RETURNING id ───
        if (upper.includes('INSERT INTO DELIVERIES')) {
          // params: [driver_id, driver_name, type, branch_id, branch_name, lat, lng, distance, created_at]
          const [
            driver_id,
            driver_name,
            type,
            branch_id,
            branch_name,
            driver_lat,
            driver_lng,
            distance,
            created_at,
          ] = params;

          const { data, error } = await getSupabase()
            .from('deliveries')
            .insert({
              driver_id,
              driver_name,
              type,
              branch_id,
              branch_name,
              status: 'pending',
              driver_lat,
              driver_lng,
              distance,
              created_at,
            })
            .select('id')
            .single();

          if (error) {
            schemaHint(error);
            throw error;
          }
          return { rows: data ? [data] : [] };
        }

        // ─── INSERT OR REPLACE INTO managers ───
        if (upper.includes('INSERT OR REPLACE INTO MANAGERS') || upper.includes('INSERT INTO MANAGERS')) {
          // params variants:
          //  [chat_id, username, first_name, branch_id]
          //  [chat_id, username, first_name]  (legacy neon translation)
          const [chat_id, username, first_name, branch_id] = params;
          const row = {
            chat_id,
            username: username ?? null,
            first_name: first_name ?? null,
          };
          if (branch_id !== undefined) row.branch_id = branch_id;

          const { error } = await getSupabase()
            .from('managers')
            .upsert(row, { onConflict: 'chat_id' });

          if (error) {
            schemaHint(error);
            throw error;
          }
          return { rows: [] };
        }

        // ─── INSERT OR REPLACE INTO user_access ───
        if (
          upper.includes('INSERT OR REPLACE INTO USER_ACCESS') ||
          upper.includes('INSERT INTO USER_ACCESS')
        ) {
          // params: [telegram_id, telegram_username, role, branch_id]
          const [telegram_id, telegram_username, role, branch_id] = params;
          const { error } = await getSupabase()
            .from('user_access')
            .upsert(
              {
                telegram_id,
                telegram_username: telegram_username ?? null,
                role,
                branch_id: branch_id ?? null,
              },
              { onConflict: 'telegram_id' }
            );

          if (error) {
            schemaHint(error);
            throw error;
          }
          return { rows: [] };
        }

        // ─── UPDATE deliveries SET status=... ───
        if (upper.startsWith('UPDATE DELIVERIES')) {
          // params: [newStatus, now, managerId, managerName, deliveryId]
          const [status, confirmed_at, confirmed_by_id, confirmed_by_name, id] = params;
          const { error } = await getSupabase()
            .from('deliveries')
            .update({
              status,
              confirmed_at,
              confirmed_by_id,
              confirmed_by_name,
            })
            .eq('id', id);

          if (error) {
            schemaHint(error);
            throw error;
          }
          return { rows: [] };
        }

        // ─── DELETE FROM user_access ───
        if (upper.startsWith('DELETE FROM USER_ACCESS')) {
          const [telegram_id] = params;
          const { error } = await getSupabase()
            .from('user_access')
            .delete()
            .eq('telegram_id', telegram_id);

          if (error) {
            schemaHint(error);
            throw error;
          }
          return { rows: [] };
        }

        // ─── SELECT * FROM deliveries WHERE id = ? ───
        if (upper.includes('FROM DELIVERIES WHERE ID =')) {
          const [id] = params;
          const { data, error } = await getSupabase()
            .from('deliveries')
            .select('*')
            .eq('id', id)
            .maybeSingle();

          if (error) {
            schemaHint(error);
            throw error;
          }
          return { rows: data ? [data] : [] };
        }

        // ─── SELECT * FROM deliveries WHERE driver_id = ? ───
        if (upper.includes('FROM DELIVERIES WHERE DRIVER_ID =')) {
          const [driver_id] = params;
          const { data, error } = await getSupabase()
            .from('deliveries')
            .select('*')
            .eq('driver_id', driver_id)
            .order('id', { ascending: false })
            .limit(30);

          if (error) {
            schemaHint(error);
            throw error;
          }
          return { rows: data || [] };
        }

        // ─── SELECT * FROM deliveries WHERE branch_id = ? ───
        if (upper.includes('FROM DELIVERIES WHERE BRANCH_ID =')) {
          const [branch_id] = params;
          const { data, error } = await getSupabase()
            .from('deliveries')
            .select('*')
            .eq('branch_id', branch_id)
            .order('id', { ascending: false })
            .limit(30);

          if (error) {
            schemaHint(error);
            throw error;
          }
          return { rows: data || [] };
        }

        // ─── SELECT * FROM deliveries ORDER BY id DESC LIMIT 100 ───
        if (upper.includes('FROM DELIVERIES ORDER BY ID DESC')) {
          const { data, error } = await getSupabase()
            .from('deliveries')
            .select('*')
            .order('id', { ascending: false })
            .limit(100);

          if (error) {
            schemaHint(error);
            throw error;
          }
          return { rows: data || [] };
        }

        // ─── SELECT status, COUNT(*) ... FROM deliveries GROUP BY status ───
        // (all-time stats used by director dashboard)
        if (
          upper.includes('FROM DELIVERIES GROUP BY STATUS') &&
          !upper.includes('CREATED_AT LIKE')
        ) {
          const { data, error } = await getSupabase()
            .from('deliveries')
            .select('status');

          if (error) {
            schemaHint(error);
            throw error;
          }

          const counts = {};
          (data || []).forEach((r) => {
            counts[r.status] = (counts[r.status] || 0) + 1;
          });
          // Match both `cnt` (bot /stats) and `count` (all-deliveries API)
          const rows = Object.entries(counts).map(([status, n]) => ({
            status,
            count: n,
            cnt: n,
          }));
          return { rows };
        }

        // ─── SELECT status, COUNT(*) ... WHERE created_at LIKE ? GROUP BY status ───
        if (upper.includes('FROM DELIVERIES WHERE CREATED_AT LIKE') && upper.includes('GROUP BY STATUS')) {
          const [like] = params; // e.g. "2026-07-16%"
          const day = String(like).replace(/%/g, '');
          const { data, error } = await getSupabase()
            .from('deliveries')
            .select('status, created_at')
            .gte('created_at', `${day} 00:00:00`)
            .lte('created_at', `${day} 23:59:59`);

          if (error) {
            schemaHint(error);
            throw error;
          }

          const counts = {};
          (data || []).forEach((r) => {
            counts[r.status] = (counts[r.status] || 0) + 1;
          });
          const rows = Object.entries(counts).map(([status, n]) => ({
            status,
            count: n,
            cnt: n,
          }));
          return { rows };
        }

        // ─── SELECT chat_id FROM managers WHERE branch_id = ? ───
        if (upper.includes('FROM MANAGERS WHERE BRANCH_ID =')) {
          const [branch_id] = params;
          const { data, error } = await getSupabase()
            .from('managers')
            .select('chat_id')
            .eq('branch_id', branch_id)
            .limit(1);

          if (error) {
            schemaHint(error);
            throw error;
          }
          return { rows: data || [] };
        }

        // ─── SELECT * FROM managers ───
        if (upper.includes('FROM MANAGERS')) {
          const { data, error } = await getSupabase().from('managers').select('*');
          if (error) {
            schemaHint(error);
            throw error;
          }
          return { rows: data || [] };
        }

        // ─── SELECT * FROM user_access WHERE telegram_id = ? ───
        if (upper.includes('FROM USER_ACCESS WHERE TELEGRAM_ID =')) {
          const [telegram_id] = params;
          const { data, error } = await getSupabase()
            .from('user_access')
            .select('*')
            .eq('telegram_id', telegram_id)
            .maybeSingle();

          if (error) {
            schemaHint(error);
            throw error;
          }
          return { rows: data ? [data] : [] };
        }

        // ─── SELECT * FROM user_access WHERE LOWER(telegram_username) = ? ───
        if (upper.includes('FROM USER_ACCESS WHERE LOWER(TELEGRAM_USERNAME)')) {
          const [username] = params;
          // PostgREST has no LOWER() filter; fetch by ilike exact match
          const { data, error } = await getSupabase()
            .from('user_access')
            .select('*')
            .ilike('telegram_username', username)
            .limit(1);

          if (error) {
            schemaHint(error);
            throw error;
          }
          return { rows: data || [] };
        }

        // ─── SELECT * FROM user_access ORDER BY ... ───
        if (upper.includes('FROM USER_ACCESS')) {
          const { data, error } = await getSupabase()
            .from('user_access')
            .select('*')
            .order('telegram_id', { ascending: false });

          if (error) {
            schemaHint(error);
            throw error;
          }
          return { rows: data || [] };
        }

        console.warn('[db] Unhandled SQL (no-op):', sql.slice(0, 120));
        return { rows: [] };
      } catch (err) {
        schemaHint(err);
        throw err;
      }
    },
  };
}

/**
 * initDb — on Supabase schema is applied via SQL Editor (supabase/schema.sql).
 * Here we just probe connectivity and log a clear hint if tables are missing.
 */
async function initDb() {
  try {
    const { error } = await getSupabase().from('deliveries').select('id').limit(1);
    if (error) {
      schemaHint(error);
      if (isMissingTableError(error)) {
        console.warn(
          '[db] Supabase connected, but tables are not created yet. Run supabase/schema.sql in the SQL Editor.'
        );
      } else {
        console.error('[db] Supabase probe failed:', error.message);
      }
    } else {
      console.log('[db] Supabase OK →', SUPABASE_URL);
    }
  } catch (e) {
    console.error('[db] initDb error:', e.message || e);
  }
}

module.exports = { getDb, initDb, getSupabase };
