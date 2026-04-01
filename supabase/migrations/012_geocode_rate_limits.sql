-- Rate limiting table for the geocode Edge Function.
-- Tracks request counts per user per time window (hour / day).
-- The window column encodes both the type and the bucket,
-- e.g. 'hour:2025-01-15T14' or 'day:2025-01-15'.

CREATE TABLE geocode_rate_limits (
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "window"   TEXT        NOT NULL,
  count      INTEGER     NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, "window")
);

-- Allow periodic cleanup of expired rows
CREATE INDEX idx_geocode_rate_limits_expires ON geocode_rate_limits(expires_at);

ALTER TABLE geocode_rate_limits ENABLE ROW LEVEL SECURITY;
-- No public policies — all access is via the service-role key in the Edge Function.

-- ---------------------------------------------------------------------------
-- Atomic check-and-increment function.
-- Upserts both the hour and day window rows, returns the resulting counts.
-- The caller decides whether to allow or reject based on the returned counts.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_geocode_rate_limit(
  p_user_id         UUID,
  p_hour_window     TEXT,
  p_day_window      TEXT,
  p_hour_expires_at TIMESTAMPTZ,
  p_day_expires_at  TIMESTAMPTZ
)
RETURNS TABLE(hour_count INTEGER, day_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hour INTEGER;
  v_day  INTEGER;
BEGIN
  INSERT INTO geocode_rate_limits (user_id, "window", count, expires_at)
    VALUES (p_user_id, p_hour_window, 1, p_hour_expires_at)
    ON CONFLICT (user_id, "window")
    DO UPDATE SET count = geocode_rate_limits.count + 1
    RETURNING count INTO v_hour;

  INSERT INTO geocode_rate_limits (user_id, "window", count, expires_at)
    VALUES (p_user_id, p_day_window, 1, p_day_expires_at)
    ON CONFLICT (user_id, "window")
    DO UPDATE SET count = geocode_rate_limits.count + 1
    RETURNING count INTO v_day;

  RETURN QUERY SELECT v_hour, v_day;
END;
$$;

-- Allow the Edge Function (service role) to execute this function
GRANT EXECUTE ON FUNCTION increment_geocode_rate_limit TO service_role;
