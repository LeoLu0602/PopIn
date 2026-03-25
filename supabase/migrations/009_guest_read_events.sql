-- Allow anonymous (guest) users to browse events and submit feedback without logging in.
-- Guests can read events, profiles (for host info), and event_members (for attendee counts).
-- Guests can also insert feedback with a null user_id.

-- Schema access
GRANT USAGE ON SCHEMA public TO anon;

-- Table-level grants
GRANT SELECT ON TABLE public.events TO anon;
GRANT SELECT ON TABLE public.profiles TO anon;
GRANT SELECT ON TABLE public.event_members TO anon;
GRANT INSERT ON TABLE public.feedback TO anon;

-- RLS: anon can read all events (active and canceled, for event detail page)
CREATE POLICY "Events viewable by guests"
  ON public.events FOR SELECT
  TO anon
  USING (true);

-- RLS: anon can read profiles (needed for host display name)
CREATE POLICY "Profiles viewable by guests"
  ON public.profiles FOR SELECT
  TO anon
  USING (true);

-- RLS: anon can read event_members (needed for attendee counts and participant stacks)
CREATE POLICY "Event members viewable by guests"
  ON public.event_members FOR SELECT
  TO anon
  USING (true);

-- RLS: anon can insert feedback with null user_id
CREATE POLICY "Guests can insert feedback"
  ON public.feedback FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);
