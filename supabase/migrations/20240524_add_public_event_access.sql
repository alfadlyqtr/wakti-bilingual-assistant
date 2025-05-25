
-- Enable public access to events table for viewing public events
-- This allows standalone event pages to work without authentication

-- Add policy for public events to be viewable by anyone
CREATE POLICY "Public events can be viewed by anyone" ON public.events
  FOR SELECT
  USING (is_public = true);

-- Add policy for events to be viewable by short_id (needed for standalone pages)
CREATE POLICY "Events can be viewed by short_id" ON public.events
  FOR SELECT
  USING (short_id IS NOT NULL);
