-- Run once in Supabase SQL Editor if app_settings is missing:
-- https://supabase.com/dashboard/project/efrvxxtfkqezgvumvzjw/sql/new

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
