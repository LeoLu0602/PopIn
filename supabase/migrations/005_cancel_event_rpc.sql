-- SECURITY DEFINER function to cancel an event.
-- Bypasses client-side RLS WITH CHECK issues by running with elevated privileges
-- while still enforcing that only the event host can cancel.

CREATE OR REPLACE FUNCTION public.cancel_event(p_event_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the calling user is the event host
  IF NOT EXISTS (
    SELECT 1 FROM events
    WHERE id = p_event_id AND host_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to cancel this event';
  END IF;

  UPDATE events SET status = 'canceled' WHERE id = p_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_event(UUID) TO authenticated;
