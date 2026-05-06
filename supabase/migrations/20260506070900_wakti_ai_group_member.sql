-- Wakti AI Group Member Feature
-- Creates the Wakti AI profile, adds is_ai flag, and helper functions

-- Insert Wakti AI profile (reserved system ID)
INSERT INTO public.profiles (
  id,
  username,
  display_name,
  avatar_url,
  email,
  created_at,
  updated_at,
  email_confirmed
)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'wakti_ai',
  'Wakti',
  '/lovable-uploads/cffe5d1a-e69b-4cd9-ae4c-43b58d4bfbb4.png',
  'ai@wakti.qa',
  now(),
  now(),
  true
)
ON CONFLICT (id) DO UPDATE SET
  display_name = 'Wakti',
  avatar_url = '/lovable-uploads/cffe5d1a-e69b-4cd9-ae4c-43b58d4bfbb4.png',
  updated_at = now();

-- Add is_ai column to conversation_participants
ALTER TABLE public.conversation_participants 
ADD COLUMN IF NOT EXISTS is_ai boolean NOT NULL DEFAULT false;

-- Update existing Wakti participant rows if any
UPDATE public.conversation_participants
SET is_ai = true
WHERE user_id = '00000000-0000-0000-0000-000000000002';

-- Function: Add Wakti AI to a group (creator only)
CREATE OR REPLACE FUNCTION public.add_wakti_to_group(group_conversation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Only the group creator can add Wakti
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE id = group_conversation_id AND created_by = current_user_id
  ) THEN
    RAISE EXCEPTION 'Only the group creator can add Wakti';
  END IF;

  -- Already a member?
  IF EXISTS (
    SELECT 1 FROM public.conversation_participants 
    WHERE conversation_id = group_conversation_id AND user_id = '00000000-0000-0000-0000-000000000002'
  ) THEN
    RETURN true;
  END IF;

  INSERT INTO public.conversation_participants (conversation_id, user_id, joined_at, last_read_at, is_ai)
  VALUES (group_conversation_id, '00000000-0000-0000-0000-000000000002', now(), now(), true);

  RETURN true;
END;
$$;

-- Function: Remove Wakti AI from a group (creator only)
CREATE OR REPLACE FUNCTION public.remove_wakti_from_group(group_conversation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Only the group creator can remove Wakti
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE id = group_conversation_id AND created_by = current_user_id
  ) THEN
    RAISE EXCEPTION 'Only the group creator can remove Wakti';
  END IF;

  DELETE FROM public.conversation_participants 
  WHERE conversation_id = group_conversation_id AND user_id = '00000000-0000-0000-0000-000000000002';

  RETURN true;
END;
$$;

-- Function: Check if Wakti is in a group
CREATE OR REPLACE FUNCTION public.is_wakti_in_group(group_conversation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.conversation_participants 
    WHERE conversation_id = group_conversation_id AND user_id = '00000000-0000-0000-0000-000000000002'
  );
END;
$$;
