
-- Add suspension status to profiles table
ALTER TABLE public.profiles 
ADD COLUMN is_suspended boolean DEFAULT false,
ADD COLUMN suspended_at timestamp with time zone,
ADD COLUMN suspended_by uuid REFERENCES admin_users(id),
ADD COLUMN suspension_reason text;

-- Create admin messages table for one-way admin-to-user messaging
CREATE TABLE public.admin_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id uuid REFERENCES auth.users NOT NULL,
  admin_id uuid REFERENCES admin_users(id) NOT NULL,
  subject text NOT NULL,
  content text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security for admin messages
ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;

-- Users can only view admin messages sent to them
CREATE POLICY "Users can view admin messages sent to them" 
  ON public.admin_messages 
  FOR SELECT 
  USING (auth.uid() = recipient_id);

-- Only admins can insert admin messages (handled via admin functions)
CREATE POLICY "Admins can send messages" 
  ON public.admin_messages 
  FOR INSERT 
  WITH CHECK (false); -- Prevent direct inserts, use admin function instead

-- Function to send admin message
CREATE OR REPLACE FUNCTION public.send_admin_message(
  p_admin_id uuid,
  p_recipient_id uuid,
  p_subject text,
  p_content text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  message_id uuid;
BEGIN
  -- Insert the admin message
  INSERT INTO public.admin_messages (admin_id, recipient_id, subject, content)
  VALUES (p_admin_id, p_recipient_id, p_subject, p_content)
  RETURNING id INTO message_id;
  
  RETURN message_id;
END;
$$;

-- Function to suspend user
CREATE OR REPLACE FUNCTION public.suspend_user(
  p_user_id uuid,
  p_admin_id uuid,
  p_reason text DEFAULT 'Account suspended by admin'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    is_suspended = true,
    suspended_at = now(),
    suspended_by = p_admin_id,
    suspension_reason = p_reason,
    updated_at = now()
  WHERE id = p_user_id;
  
  RETURN FOUND;
END;
$$;

-- Function to unsuspend user
CREATE OR REPLACE FUNCTION public.unsuspend_user(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    is_suspended = false,
    suspended_at = null,
    suspended_by = null,
    suspension_reason = null,
    updated_at = now()
  WHERE id = p_user_id;
  
  RETURN FOUND;
END;
$$;

-- Function for soft delete user (mark as deleted but keep data)
CREATE OR REPLACE FUNCTION public.soft_delete_user(
  p_user_id uuid,
  p_admin_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Mark user as suspended and add deletion marker
  UPDATE public.profiles
  SET 
    is_suspended = true,
    suspended_at = now(),
    suspended_by = p_admin_id,
    suspension_reason = 'Account deleted by admin',
    display_name = '[DELETED USER]',
    email = null,
    updated_at = now()
  WHERE id = p_user_id;
  
  -- Note: We don't actually delete from auth.users to maintain referential integrity
  -- The user will just be unable to login and their profile is anonymized
  
  RETURN FOUND;
END;
$$;
