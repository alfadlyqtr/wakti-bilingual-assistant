CREATE OR REPLACE FUNCTION public.create_group_conversation(group_name text, member_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  normalized_member_ids uuid[];
  candidate_user_id uuid;
  selected_member_id uuid;
  new_conversation_id uuid;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF btrim(coalesce(group_name, '')) = '' THEN
    RAISE EXCEPTION 'Group name is required';
  END IF;

  normalized_member_ids := ARRAY(
    SELECT DISTINCT selected_member_id
    FROM unnest(coalesce(member_ids, ARRAY[]::uuid[])) AS selected_member_id
    WHERE selected_member_id IS NOT NULL
      AND selected_member_id <> current_user_id
  );

  IF coalesce(array_length(normalized_member_ids, 1), 0) < 2 THEN
    RAISE EXCEPTION 'A group chat needs at least 2 contacts';
  END IF;

  FOREACH candidate_user_id IN ARRAY normalized_member_ids LOOP
    IF NOT public.are_users_contacts(current_user_id, candidate_user_id) THEN
      RAISE EXCEPTION 'All members must be approved mutual contacts';
    END IF;
  END LOOP;

  INSERT INTO public.conversations (name, is_group, created_by, created_at, updated_at)
  VALUES (left(btrim(group_name), 80), true, current_user_id, now(), now())
  RETURNING id INTO new_conversation_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id, joined_at, last_read_at)
  VALUES (new_conversation_id, current_user_id, now(), now());

  INSERT INTO public.conversation_participants (conversation_id, user_id, joined_at, last_read_at)
  SELECT new_conversation_id, selected_member_id, now(), now()
  FROM unnest(normalized_member_ids) AS selected_member_id;

  RETURN new_conversation_id;
END;
$$;
