-- Add coordinate columns to events table.
-- Populated at event creation/edit time via Google Places Autocomplete
-- or resolveEventLocation(). The map reads these directly instead of
-- geocoding at render time. NULL means the event predates this migration
-- and the map will fall back to geocoding from location_text.
ALTER TABLE events
  ADD COLUMN location_lat float8,
  ADD COLUMN location_lng float8;
