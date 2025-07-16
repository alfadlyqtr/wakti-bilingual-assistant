
-- Remove the policy that allows anyone to view public events
DROP POLICY IF EXISTS "Anyone can view public maw3d events" ON public.maw3d_events;

-- The remaining policies will ensure users can only see their own events:
-- "Users can view their own events only" - already exists
-- "Users can insert their own events" - already exists  
-- "Users can update their own events" - already exists
-- "Users can delete their own events" - already exists
