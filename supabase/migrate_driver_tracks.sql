-- Live driver tracking points
-- Run once: https://supabase.com/dashboard/project/efrvxxtfkqezgvumvzjw/sql/new

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
CREATE INDEX IF NOT EXISTS driver_tracks_driver_created_idx ON public.driver_tracks (driver_id, created_at DESC);

GRANT ALL ON TABLE public.driver_tracks TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.driver_tracks_id_seq TO anon, authenticated, service_role;

ALTER TABLE public.driver_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "driver_tracks_all" ON public.driver_tracks;
CREATE POLICY "driver_tracks_all" ON public.driver_tracks
  FOR ALL TO anon, authenticated, service_role
  USING (true) WITH CHECK (true);
