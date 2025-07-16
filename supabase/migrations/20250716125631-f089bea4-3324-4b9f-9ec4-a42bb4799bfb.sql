
-- Add RLS policy to allow anyone to view public maw3d events
-- This enables shared event links to work for anonymous users
CREATE POLICY "Anyone can view public maw3d events" 
ON public.maw3d_events 
FOR SELECT 
USING (is_public = true);
