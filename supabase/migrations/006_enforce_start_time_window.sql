-- Enforce event start time within 48 hours at the database layer.
-- This prevents stale clients from creating/editing events beyond the allowed window.

CREATE OR REPLACE FUNCTION public.enforce_event_start_within_48_hours()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Allow updates that do not change start_time.
  IF TG_OP = 'UPDATE' AND NEW.start_time = OLD.start_time THEN
    RETURN NEW;
  END IF;

  IF NEW.start_time > (NOW() + INTERVAL '48 hours') THEN
    RAISE EXCEPTION 'Start time must be within 48 hours from now'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_event_start_within_48_hours ON public.events;

CREATE TRIGGER trg_enforce_event_start_within_48_hours
BEFORE INSERT OR UPDATE OF start_time
ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.enforce_event_start_within_48_hours();
