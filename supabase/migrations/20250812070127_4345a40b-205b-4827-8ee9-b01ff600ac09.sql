-- Fix contact discovery RLS policy and initialize privacy settings

-- Drop the current policy and recreate with correct paths and statuses
DROP POLICY IF EXISTS "Secure profile access policy" ON public.profiles;

-- Create the fixed policy that supports both approved and accepted contacts
-- and uses the correct nested path for profile visibility
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
  -- Users can view profiles of their contacts (both approved and accepted statuses)
  EXISTS (
    SELECT 1 FROM public.contacts 
    WHERE ((user_id = auth.uid() AND contact_id = profiles.id) OR 
           (user_id = profiles.id AND contact_id = auth.uid()))
    AND status IN ('accepted', 'approved')
  )
  OR
  -- Users can view profiles that have enabled profile visibility for discovery
  -- Check the correct nested path: settings->privacy->profileVisibility
  (
    auth.uid() IS NOT NULL AND
    COALESCE((profiles.settings->'privacy'->>'profileVisibility')::boolean, true) = true
  )
);

-- Initialize missing privacy settings for existing users
-- Set default values: profileVisibility = true, autoApproveContacts = false
UPDATE public.profiles 
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{privacy}',
  jsonb_build_object(
    'profileVisibility', true,
    'activityStatus', true
  )
)
WHERE settings->'privacy' IS NULL OR settings->'privacy' = 'null'::jsonb;

-- Also ensure auto_approve_contacts has a default value
UPDATE public.profiles 
SET auto_approve_contacts = false
WHERE auto_approve_contacts IS NULL;