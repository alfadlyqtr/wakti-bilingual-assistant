-- Add RLS policies for contacts table to allow users to manage their own contacts

-- Ensure RLS is enabled on contacts table
ALTER TABLE IF EXISTS public.contacts ENABLE ROW LEVEL SECURITY;

-- Drop any existing conflicting policies
DROP POLICY IF EXISTS "Users can view their contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can create contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can update their contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete their contacts" ON public.contacts;

-- SELECT: Users can view contacts where they are user_id or contact_id
CREATE POLICY "Users can view their contacts"
ON public.contacts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = contact_id);

-- INSERT: Users can create contacts where they are the user_id
CREATE POLICY "Users can create contacts"
ON public.contacts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can update contacts where they are the user_id
CREATE POLICY "Users can update their contacts"
ON public.contacts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can delete contacts where they are the user_id
CREATE POLICY "Users can delete their contacts"
ON public.contacts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
