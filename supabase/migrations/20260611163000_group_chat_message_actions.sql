ALTER TABLE public.conversation_messages
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reply_to_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conversation_messages_reply_to_id_fkey'
      AND conrelid = 'public.conversation_messages'::regclass
  ) THEN
    ALTER TABLE public.conversation_messages
    ADD CONSTRAINT conversation_messages_reply_to_id_fkey
    FOREIGN KEY (reply_to_id)
    REFERENCES public.conversation_messages(id)
    ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_conversation_messages_reply_to_id
ON public.conversation_messages(reply_to_id);

CREATE TABLE IF NOT EXISTS public.conversation_message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_message_id UUID NOT NULL REFERENCES public.conversation_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS conversation_message_reactions_message_user_idx
ON public.conversation_message_reactions(conversation_message_id, user_id);

CREATE INDEX IF NOT EXISTS idx_conversation_message_reactions_message_id
ON public.conversation_message_reactions(conversation_message_id);

CREATE INDEX IF NOT EXISTS idx_conversation_message_reactions_user_id
ON public.conversation_message_reactions(user_id);

ALTER TABLE public.conversation_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_message_reactions REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "Participants can view group message reactions" ON public.conversation_message_reactions;
CREATE POLICY "Participants can view group message reactions"
ON public.conversation_message_reactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.conversation_messages cm
    JOIN public.conversation_participants cp
      ON cp.conversation_id = cm.conversation_id
    WHERE cm.id = conversation_message_reactions.conversation_message_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Participants can add their group message reaction" ON public.conversation_message_reactions;
CREATE POLICY "Participants can add their group message reaction"
ON public.conversation_message_reactions
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.conversation_messages cm
    JOIN public.conversation_participants cp
      ON cp.conversation_id = cm.conversation_id
    WHERE cm.id = conversation_message_reactions.conversation_message_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Participants can delete their group message reaction" ON public.conversation_message_reactions;
CREATE POLICY "Participants can delete their group message reaction"
ON public.conversation_message_reactions
FOR DELETE
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.conversation_messages cm
    JOIN public.conversation_participants cp
      ON cp.conversation_id = cm.conversation_id
    WHERE cm.id = conversation_message_reactions.conversation_message_id
      AND cp.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.soft_delete_conversation_message(p_message_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_updated_count INTEGER;
BEGIN
  UPDATE public.conversation_messages
  SET is_deleted = true,
      deleted_at = now(),
      content = null,
      media_url = null,
      media_type = null,
      voice_duration = null,
      file_size = null,
      reply_to_id = null
  WHERE id = p_message_id
    AND sender_id = auth.uid()
    AND is_deleted = false;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 0 THEN
    RETURN false;
  END IF;

  DELETE FROM public.conversation_message_reactions
  WHERE conversation_message_id = p_message_id;

  RETURN true;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.soft_delete_conversation_message(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.refresh_conversation_after_message_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_last_message public.conversation_messages%ROWTYPE;
BEGIN
  SELECT *
  INTO v_last_message
  FROM public.conversation_messages
  WHERE conversation_id = NEW.conversation_id
  ORDER BY created_at DESC
  LIMIT 1;

  UPDATE public.conversations
  SET updated_at = now(),
      last_message_text = CASE
        WHEN v_last_message.id IS NULL THEN NULL
        WHEN COALESCE(v_last_message.is_deleted, false) THEN '[Deleted message]'
        WHEN v_last_message.content IS NOT NULL AND btrim(v_last_message.content) <> '' THEN left(v_last_message.content, 200)
        WHEN v_last_message.message_type = 'image' THEN '[Image]'
        WHEN v_last_message.message_type = 'voice' THEN '[Voice]'
        WHEN v_last_message.message_type = 'pdf' THEN '[PDF]'
        ELSE '[Message]'
      END,
      last_message_at = CASE WHEN v_last_message.id IS NULL THEN NULL ELSE v_last_message.created_at END,
      last_message_by = CASE WHEN v_last_message.id IS NULL THEN NULL ELSE v_last_message.sender_id END
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS conversation_message_refresh_after_update ON public.conversation_messages;
CREATE TRIGGER conversation_message_refresh_after_update
AFTER UPDATE OF is_deleted, deleted_at, content, media_url, media_type, voice_duration, file_size, reply_to_id
ON public.conversation_messages
FOR EACH ROW
EXECUTE FUNCTION public.refresh_conversation_after_message_update();

CREATE OR REPLACE FUNCTION public.notify_on_new_group_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_sender_name TEXT;
  v_username TEXT;
  v_display_name TEXT;
  v_group_name TEXT;
  v_user_language TEXT;
  v_notification_title TEXT;
  v_notification_body TEXT;
  v_deep_link TEXT;
  v_sender_avatar_url TEXT;
  v_participant RECORD;
BEGIN
  SELECT username, display_name, avatar_url
  INTO v_username, v_display_name, v_sender_avatar_url
  FROM public.profiles
  WHERE id = NEW.sender_id;

  IF v_username IS NOT NULL AND v_username <> '' THEN
    v_sender_name := v_username;
  ELSIF v_display_name IS NOT NULL AND v_display_name <> '' AND v_display_name NOT LIKE '%@%' THEN
    v_sender_name := v_display_name;
  ELSE
    v_sender_name := 'Someone';
  END IF;

  SELECT COALESCE(name, 'Group chat')
  INTO v_group_name
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  v_deep_link := '/group-chats/' || NEW.conversation_id;

  FOR v_participant IN
    SELECT cp.user_id
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = NEW.conversation_id
      AND cp.user_id <> NEW.sender_id
      AND COALESCE(cp.is_ai, false) = false
  LOOP
    SELECT COALESCE(language, 'en')
    INTO v_user_language
    FROM public.profiles
    WHERE id = v_participant.user_id;

    IF v_user_language = 'ar' THEN
      v_notification_title := v_sender_name || ' أرسل رسالة في ' || v_group_name;
      v_notification_body := CASE
        WHEN NEW.message_type = 'text' THEN LEFT(COALESCE(NEW.content, ''), 80)
        WHEN NEW.message_type = 'image' THEN '📷 صورة'
        WHEN NEW.message_type = 'voice' THEN '🎤 رسالة صوتية'
        WHEN NEW.message_type = 'pdf' THEN '📄 مستند'
        ELSE 'رسالة جديدة'
      END;
    ELSE
      v_notification_title := v_sender_name || ' sent a message in ' || v_group_name;
      v_notification_body := CASE
        WHEN NEW.message_type = 'text' THEN LEFT(COALESCE(NEW.content, ''), 80)
        WHEN NEW.message_type = 'image' THEN '📷 Image'
        WHEN NEW.message_type = 'voice' THEN '🎤 Voice message'
        WHEN NEW.message_type = 'pdf' THEN '📄 Document'
        ELSE 'New message'
      END;
    END IF;

    PERFORM public.create_notification(
      v_participant.user_id,
      'group_message_received',
      v_notification_title,
      v_notification_body,
      jsonb_build_object(
        'message_id', NEW.id,
        'sender_id', NEW.sender_id,
        'sender_name', v_sender_name,
        'sender_avatar_url', v_sender_avatar_url,
        'message_type', NEW.message_type,
        'conversation_id', NEW.conversation_id,
        'group_name', v_group_name,
        'deep_link', v_deep_link
      ),
      v_deep_link
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_notify_new_group_message ON public.conversation_messages;
CREATE TRIGGER trigger_notify_new_group_message
AFTER INSERT ON public.conversation_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_new_group_message();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'conversation_message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_message_reactions;
  END IF;
END $$;
