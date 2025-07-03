-- Fix RLS policies for maw3d_events to ensure public events are accessible
-- Drop existing conflicting policies
DROP POLICY IF EXISTS "Users can view their own events only" ON public.maw3d_events;
DROP POLICY IF EXISTS "Anyone can view public maw3d events" ON public.maw3d_events;

-- Create new comprehensive policies that don't conflict
CREATE POLICY "Anyone can view public maw3d events" 
ON public.maw3d_events 
FOR SELECT 
USING (is_public = true);

CREATE POLICY "Users can view their own events" 
ON public.maw3d_events 
FOR SELECT 
USING (created_by = auth.uid());

-- Ensure the policies for other operations remain intact
-- Users can insert their own events
CREATE POLICY "Users can insert their own events" 
ON public.maw3d_events 
FOR INSERT 
WITH CHECK (created_by = auth.uid());

-- Users can update their own events  
CREATE POLICY "Users can update their own events" 
ON public.maw3d_events 
FOR UPDATE 
USING (created_by = auth.uid());

-- Users can delete their own events
CREATE POLICY "Users can delete their own events" 
ON public.maw3d_events 
FOR DELETE 
USING (created_by = auth.uid());