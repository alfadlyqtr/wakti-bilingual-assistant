-- Add mention-specific push notifications for group chat
-- When a user is @mentioned, they get "Tameem mentioned you in wakti team"
-- Non-mentioned users still get the generic "Tameem sent a message in wakti team"

DROP TRIGGER IF EXISTS trigger_notify_new_group_message ON public.conversation_messages;

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
  v_is_mentioned BOOLEAN;
  v_content_lower TEXT;
  v_p_display_name TEXT;
  v_p_username TEXT;
BEGIN
  -- Get sender info
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
  v_content_lower := LOWER(COALESCE(NEW.content, ''));

  FOR v_participant IN
    SELECT cp.user_id
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = NEW.conversation_id
      AND cp.user_id <> NEW.sender_id
      AND COALESCE(cp.is_ai, false) = false
  LOOP
    -- Get participant info
    SELECT display_name, username, COALESCE(language, 'en')
    INTO v_p_display_name, v_p_username, v_user_language
    FROM public.profiles
    WHERE id = v_participant.user_id;

    -- Check if this participant is mentioned
    v_is_mentioned := false;

    -- Check @display_name
    IF v_p_display_name IS NOT NULL AND v_p_display_name <> '' AND v_p_display_name NOT LIKE '%@%' THEN
      IF POSITION('@' || LOWER(v_p_display_name) IN v_content_lower) > 0 THEN
        v_is_mentioned := true;
      END IF;
    END IF;

    -- Check @username
    IF NOT v_is_mentioned AND v_p_username IS NOT NULL AND v_p_username <> '' THEN
      IF POSITION('@' || LOWER(v_p_username) IN v_content_lower) > 0 THEN
        v_is_mentioned := true;
      END IF;
    END IF;

    -- Build notification body
    v_notification_body := CASE
      WHEN NEW.message_type = 'text' THEN LEFT(COALESCE(NEW.content, ''), 80)
      WHEN NEW.message_type = 'image' THEN (CASE WHEN v_user_language = 'ar' THEN 'صورة' ELSE 'Image' END)
      WHEN NEW.message_type = 'voice' THEN (CASE WHEN v_user_language = 'ar' THEN 'رسالة صوتية' ELSE 'Voice message' END)
      WHEN NEW.message_type = 'pdf' THEN (CASE WHEN v_user_language = 'ar' THEN 'مستند' ELSE 'Document' END)
      ELSE (CASE WHEN v_user_language = 'ar' THEN 'رسالة جديدة' ELSE 'New message' END)
    END;

    IF v_is_mentioned THEN
      -- Mention notification
      IF v_user_language = 'ar' THEN
        v_notification_title := v_sender_name || ' أشار إليك في ' || v_group_name;
      ELSE
        v_notification_title := v_sender_name || ' mentioned you in ' || v_group_name;
      END IF;
    ELSE
      -- Regular notification
      IF v_user_language = 'ar' THEN
        v_notification_title := v_sender_name || ' أرسل رسالة في ' || v_group_name;
      ELSE
        v_notification_title := v_sender_name || ' sent a message in ' || v_group_name;
      END IF;
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
        'deep_link', v_deep_link,
        'is_mentioned', v_is_mentioned
      ),
      v_deep_link
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trigger_notify_new_group_message
AFTER INSERT ON public.conversation_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_new_group_message();
