-- Allow attendees to see events they joined, even if cancelled.
-- Without this, the events SELECT policy (status = 'active') hides
-- cancelled events from attendees, breaking notification display.
CREATE POLICY "Members can view events they joined"
  ON events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM event_members
      WHERE event_members.event_id = id
        AND event_members.user_id = auth.uid()
    )
  );
