const { createClient } = require('@libsql/client');

const TURSO_URL = process.env.TURSO_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;

let client;

function getDb() {
  if (!client) {
    if (DATABASE_URL) {
      // Production: Neon Database (Postgres)
      const { neon } = require('@neondatabase/serverless');
      const sql = neon(DATABASE_URL);
      client = {
        execute: async (query, params = []) => {
          let pgQuery = query;
          // 1. Translate SQLite INSERT OR REPLACE to ON CONFLICT for Postgres
          if (pgQuery.toUpperCase().includes('INSERT OR REPLACE INTO MANAGERS')) {
            pgQuery = `
              INSERT INTO managers (chat_id, username, first_name) 
              VALUES ($1, $2, $3) 
              ON CONFLICT (chat_id) 
              DO UPDATE SET username = EXCLUDED.username, first_name = EXCLUDED.first_name
            `;
          } else if (pgQuery.toUpperCase().includes('INSERT OR REPLACE INTO USER_ACCESS')) {
            pgQuery = `
              INSERT INTO user_access (telegram_id, telegram_username, role, branch_id) 
              VALUES ($1, $2, $3, $4) 
              ON CONFLICT (telegram_id) 
              DO UPDATE SET telegram_username = EXCLUDED.telegram_username, role = EXCLUDED.role, branch_id = EXCLUDED.branch_id
            `;
          } else if (pgQuery.toUpperCase().includes('INSERT OR IGNORE INTO MANAGERS')) {
            pgQuery = pgQuery.replace(/INSERT OR IGNORE INTO/i, 'INSERT INTO') + ' ON CONFLICT (chat_id) DO NOTHING';
          }
          
          // 2. Convert ? placeholders to Postgres $1, $2, etc.
          let paramIndex = 1;
          pgQuery = pgQuery.replace(/\?/g, () => `$${paramIndex++}`);
          
          const rows = await sql(pgQuery, params);
          return { rows };
        }
      };
    } else if (TURSO_URL && TURSO_AUTH_TOKEN) {
      // Production: Turso (cloud SQLite)
      const localClient = createClient({ url: TURSO_URL, authToken: TURSO_AUTH_TOKEN });
      client = {
        execute: async (query, params = []) => {
          return await localClient.execute(query, params);
        }
      };
    } else {
      // Local dev: local SQLite file via Turso's local mode
      const localClient = createClient({ url: 'file:local.db' });
      client = {
        execute: async (query, params = []) => {
          return await localClient.execute(query, params);
        }
      };
    }
  }
  return client;
}

async function initDb() {
  const db = getDb();
  if (DATABASE_URL) {
    // Neon PostgreSQL schema
    await db.execute(`
      CREATE TABLE IF NOT EXISTS deliveries (
        id SERIAL PRIMARY KEY,
        driver_id BIGINT NOT NULL,
        driver_name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'delivery',
        branch_id INTEGER NOT NULL,
        branch_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        driver_lat DOUBLE PRECISION,
        driver_lng DOUBLE PRECISION,
        distance DOUBLE PRECISION,
        created_at TEXT NOT NULL,
        confirmed_at TEXT,
        confirmed_by_id BIGINT,
        confirmed_by_name TEXT,
        reject_reason TEXT
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS managers (
        chat_id BIGINT PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        branch_id INTEGER
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS user_access (
        telegram_id BIGINT PRIMARY KEY,
        telegram_username TEXT,
        role TEXT NOT NULL,
        branch_id INTEGER
      )
    `);
  } else {
    // LibSQL / SQLite schema
    await db.execute(`
      CREATE TABLE IF NOT EXISTS deliveries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        driver_id INTEGER NOT NULL,
        driver_name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'delivery',
        branch_id INTEGER NOT NULL,
        branch_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        driver_lat REAL,
        driver_lng REAL,
        distance REAL,
        created_at TEXT NOT NULL,
        confirmed_at TEXT,
        confirmed_by_id INTEGER,
        confirmed_by_name TEXT,
        reject_reason TEXT
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS managers (
        chat_id INTEGER PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        branch_id INTEGER
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS user_access (
        telegram_id INTEGER PRIMARY KEY,
        telegram_username TEXT,
        role TEXT NOT NULL,
        branch_id INTEGER
      )
    `);
  }
}

module.exports = { getDb, initDb };
