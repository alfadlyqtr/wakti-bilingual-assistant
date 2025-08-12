-- Fix critical security vulnerability in admin_users table
-- Current policy allows ANY authenticated user to read admin credentials
-- This is extremely dangerous and must be fixed immediately

-- Drop the overly permissive existing policy
DROP POLICY IF EXISTS "Admin users can manage admin accounts" ON public.admin_users;

-- Create a security definer function to check if user is a valid admin
CREATE OR REPLACE FUNCTION public.is_valid_admin(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_exists boolean := false;
BEGIN
  -- Check if the user exists in admin_users and is active
  SELECT EXISTS(
    SELECT 1 
    FROM public.admin_users 
    WHERE id = user_id AND is_active = true
  ) INTO admin_exists;
  
  RETURN admin_exists;
END;
$$;

-- Create restrictive RLS policies for admin_users table
-- Only allow authenticated admin users to access admin data

-- SELECT policy: Only valid admins can view admin user data
CREATE POLICY "Only authenticated admins can view admin users"
ON public.admin_users
FOR SELECT
TO authenticated
USING (public.is_valid_admin(auth.uid()));

-- INSERT policy: Only valid admins can create new admin users
CREATE POLICY "Only authenticated admins can create admin users"
ON public.admin_users
FOR INSERT
TO authenticated
WITH CHECK (public.is_valid_admin(auth.uid()));

-- UPDATE policy: Only valid admins can update admin user data
CREATE POLICY "Only authenticated admins can update admin users"
ON public.admin_users
FOR UPDATE
TO authenticated
USING (public.is_valid_admin(auth.uid()));

-- DELETE policy: Only valid admins can delete admin users
CREATE POLICY "Only authenticated admins can delete admin users"
ON public.admin_users
FOR DELETE
TO authenticated
USING (public.is_valid_admin(auth.uid()));

-- Also fix admin_sessions table to be equally restrictive
DROP POLICY IF EXISTS "Admin users can manage sessions" ON public.admin_sessions;

-- Only allow authenticated admins to manage sessions
CREATE POLICY "Only authenticated admins can view sessions"
ON public.admin_sessions
FOR SELECT
TO authenticated
USING (public.is_valid_admin(auth.uid()));

CREATE POLICY "Only authenticated admins can create sessions"
ON public.admin_sessions
FOR INSERT
TO authenticated
WITH CHECK (public.is_valid_admin(auth.uid()));

CREATE POLICY "Only authenticated admins can update sessions"
ON public.admin_sessions
FOR UPDATE
TO authenticated
USING (public.is_valid_admin(auth.uid()));

CREATE POLICY "Only authenticated admins can delete sessions"
ON public.admin_sessions
FOR DELETE
TO authenticated
USING (public.is_valid_admin(auth.uid()));

-- Fix admin_activity_logs table as well
DROP POLICY IF EXISTS "Admin users can view activity logs" ON public.admin_activity_logs;

CREATE POLICY "Only authenticated admins can view activity logs"
ON public.admin_activity_logs
FOR SELECT
TO authenticated
USING (public.is_valid_admin(auth.uid()));

CREATE POLICY "Only authenticated admins can create activity logs"
ON public.admin_activity_logs
FOR INSERT
TO authenticated
WITH CHECK (public.is_valid_admin(auth.uid()));

CREATE POLICY "Only authenticated admins can update activity logs"
ON public.admin_activity_logs
FOR UPDATE
TO authenticated
USING (public.is_valid_admin(auth.uid()));

CREATE POLICY "Only authenticated admins can delete activity logs"
ON public.admin_activity_logs
FOR DELETE
TO authenticated
USING (public.is_valid_admin(auth.uid()));