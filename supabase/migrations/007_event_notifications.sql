-- Add updated_at to events if it doesn't already exist
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Auto-update updated_at on every row update
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS events_updated_at ON events;
CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Notifications table
CREATE TABLE IF NOT EXISTS event_notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('event_updated', 'event_cancelled')),
  changed_fields TEXT[] NOT NULL DEFAULT '{}',
  read         BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Partial index for fast unread count queries
CREATE INDEX IF NOT EXISTS event_notifications_unread_idx
  ON event_notifications(user_id)
  WHERE read = false;

ALTER TABLE event_notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
CREATE POLICY "Users read own notifications"
  ON event_notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users can mark their own notifications as read
CREATE POLICY "Users update own notifications"
  ON event_notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Hosts can insert notifications for attendees of their events
CREATE POLICY "Hosts insert notifications for their events"
  ON event_notifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_id
        AND events.host_id = auth.uid()
    )
  );
