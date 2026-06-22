-- RPC functions for group updates (creator only)
-- Uses SECURITY DEFINER to bypass RLS, matching pattern of create_group_conversation

CREATE OR REPLACE FUNCTION public.update_group_avatar(group_conversation_id uuid, avatar_url text)
RETURNS void
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

  IF avatar_url IS NULL OR btrim(avatar_url) = '' THEN
    RAISE EXCEPTION 'Avatar URL is required';
  END IF;

  -- Only the group creator can update the avatar
  UPDATE public.conversations
  SET avatar_url = btrim(avatar_url),
      updated_at = now()
  WHERE id = group_conversation_id
    AND created_by = current_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only the group creator can change the group picture';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.rename_group_conversation(group_conversation_id uuid, new_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  trimmed_name text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  trimmed_name := left(btrim(coalesce(new_name, '')), 80);
  IF trimmed_name = '' THEN
    RAISE EXCEPTION 'Group name is required';
  END IF;

  -- Only the group creator can rename
  UPDATE public.conversations
  SET name = trimmed_name,
      updated_at = now()
  WHERE id = group_conversation_id
    AND created_by = current_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only the group creator can rename the group';
  END IF;
END;
$$;
