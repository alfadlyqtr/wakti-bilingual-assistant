-- Fix update_group_avatar to use the input parameter value safely.
-- Keeps creator-only behavior while avoiding column/parameter name collision.

CREATE OR REPLACE FUNCTION public.update_group_avatar(group_conversation_id uuid, avatar_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  cleaned_avatar_url text := btrim(coalesce(avatar_url, ''));
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF cleaned_avatar_url = '' THEN
    RAISE EXCEPTION 'Avatar URL is required';
  END IF;

  UPDATE public.conversations AS c
  SET avatar_url = cleaned_avatar_url,
      updated_at = now()
  WHERE c.id = group_conversation_id
    AND c.created_by = current_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only the group creator can change the group picture';
  END IF;
END;
$$;
