-- Fix contact discovery by updating the existing RLS policy
-- Drop the current policy and recreate with profile visibility support

DROP POLICY IF EXISTS "Secure profile access policy" ON public.profiles;

-- Create the updated policy that includes profile visibility checking
CREATE POLICY "Secure profile access policy"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Users can view their own profile (full access)
  id = auth.uid()
  OR
  -- Users can view system profiles (for notifications/messages)
  id IN ('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid)
  OR
  -- Users can view profiles of their accepted contacts
  EXISTS (
    SELECT 1 FROM public.contacts 
    WHERE ((user_id = auth.uid() AND contact_id = profiles.id) OR 
           (user_id = profiles.id AND contact_id = auth.uid()))
    AND status = 'accepted'
  )
  OR
  -- Users can view profiles that have enabled profile visibility for discovery
  (
    auth.uid() IS NOT NULL AND
    (profiles.settings->>'profileVisibility')::boolean = true
  )
);