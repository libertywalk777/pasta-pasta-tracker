-- ============================================================
-- Pasta Pasta Tracker — Supabase schema
-- Project: efrvxxtfkqezgvumvzjw
--
-- How to apply (one-time):
--   1. Open https://supabase.com/dashboard/project/efrvxxtfkqezgvumvzjw/sql/new
--   2. Paste this entire file
--   3. Click Run
-- ============================================================

-- Deliveries: pickup from factory + delivery to branches
CREATE TABLE IF NOT EXISTS public.deliveries (
  id                BIGSERIAL PRIMARY KEY,
  driver_id         BIGINT NOT NULL,
  driver_name       TEXT NOT NULL,
  type              TEXT NOT NULL DEFAULT 'delivery',  -- 'pickup' | 'delivery'
  branch_id         INTEGER NOT NULL,
  branch_name       TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'confirmed' | 'rejected'
  driver_lat        DOUBLE PRECISION,
  driver_lng        DOUBLE PRECISION,
  distance          DOUBLE PRECISION,
  created_at        TEXT NOT NULL,
  confirmed_at      TEXT,
  confirmed_by_id   BIGINT,
  confirmed_by_name TEXT,
  reject_reason     TEXT
);

CREATE INDEX IF NOT EXISTS deliveries_driver_id_idx   ON public.deliveries (driver_id);
CREATE INDEX IF NOT EXISTS deliveries_branch_id_idx   ON public.deliveries (branch_id);
CREATE INDEX IF NOT EXISTS deliveries_status_idx      ON public.deliveries (status);
CREATE INDEX IF NOT EXISTS deliveries_created_at_idx  ON public.deliveries (created_at);

-- Managers registered via Telegram /start
CREATE TABLE IF NOT EXISTS public.managers (
  chat_id     BIGINT PRIMARY KEY,
  username    TEXT,
  first_name  TEXT,
  branch_id   INTEGER
);

CREATE INDEX IF NOT EXISTS managers_branch_id_idx ON public.managers (branch_id);

-- Dynamic role access (director grants)
CREATE TABLE IF NOT EXISTS public.user_access (
  telegram_id       BIGINT PRIMARY KEY,
  telegram_username TEXT,
  role              TEXT NOT NULL,          -- 'director' | 'manager' | 'driver'
  branch_id         INTEGER
);

CREATE INDEX IF NOT EXISTS user_access_username_idx ON public.user_access (telegram_username);

-- ------------------------------------------------------------
-- Permissions for Data API (anon / authenticated / service_role)
-- ------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.deliveries  TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.managers    TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_access TO anon, authenticated, service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Ensure future tables/sequences inherit grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;

-- ------------------------------------------------------------
-- Row Level Security
-- App uses a single publishable key from the server (no end-user auth yet).
-- RLS is ON with open policies so the Data API works with the publishable key.
-- Tighten these later if you add Supabase Auth / service_role-only writes.
-- ------------------------------------------------------------
ALTER TABLE public.deliveries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deliveries_all"  ON public.deliveries;
DROP POLICY IF EXISTS "managers_all"    ON public.managers;
DROP POLICY IF EXISTS "user_access_all" ON public.user_access;

CREATE POLICY "deliveries_all"  ON public.deliveries
  FOR ALL TO anon, authenticated, service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "managers_all" ON public.managers
  FOR ALL TO anon, authenticated, service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "user_access_all" ON public.user_access
  FOR ALL TO anon, authenticated, service_role
  USING (true) WITH CHECK (true);

-- App runtime settings (e.g. auto-detected Telegram group chat id)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

GRANT ALL ON TABLE public.app_settings TO anon, authenticated, service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_all" ON public.app_settings;
CREATE POLICY "app_settings_all" ON public.app_settings
  FOR ALL TO anon, authenticated, service_role
  USING (true) WITH CHECK (true);

-- Done. Tables are ready for the Next.js app.

-- Live driver GPS track points
CREATE TABLE IF NOT EXISTS public.driver_tracks (
  id           BIGSERIAL PRIMARY KEY,
  driver_id    BIGINT NOT NULL,
  driver_name  TEXT,
  phone        TEXT,
  lat          DOUBLE PRECISION NOT NULL,
  lng          DOUBLE PRECISION NOT NULL,
  accuracy     DOUBLE PRECISION,
  speed        DOUBLE PRECISION,
  heading      DOUBLE PRECISION,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS driver_tracks_driver_id_idx ON public.driver_tracks (driver_id);
CREATE INDEX IF NOT EXISTS driver_tracks_created_at_idx ON public.driver_tracks (created_at DESC);

GRANT ALL ON TABLE public.driver_tracks TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.driver_tracks_id_seq TO anon, authenticated, service_role;

ALTER TABLE public.driver_tracks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "driver_tracks_all" ON public.driver_tracks;
CREATE POLICY "driver_tracks_all" ON public.driver_tracks
  FOR ALL TO anon, authenticated, service_role
  USING (true) WITH CHECK (true);
