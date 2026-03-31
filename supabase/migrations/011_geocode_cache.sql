-- Cache table for geocoding results to avoid repeated Google API calls.
-- Keyed by the normalized address string.

CREATE TABLE geocode_cache (
  address      TEXT PRIMARY KEY,
  lat          DOUBLE PRECISION NOT NULL,
  lng          DOUBLE PRECISION NOT NULL,
  cached_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only the service role (Edge Function) writes to this table.
-- Anon and authenticated users can read cached results indirectly
-- through the Edge Function — no direct table access needed.
ALTER TABLE geocode_cache ENABLE ROW LEVEL SECURITY;

-- No public policies — all access goes through the Edge Function
-- which uses the service role key.