DROP TRIGGER IF EXISTS trigger_notify_new_group_message ON public.conversation_messages;
DROP FUNCTION IF EXISTS public.notify_on_new_group_message();

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
  v_recipient RECORD;
  v_notification_title TEXT;
  v_notification_body TEXT;
  v_deep_link TEXT;
BEGIN
  SELECT username, display_name
  INTO v_username, v_display_name
  FROM public.profiles
  WHERE id = NEW.sender_id;

  IF v_username IS NOT NULL AND v_username <> '' THEN
    v_sender_name := v_username;
  ELSIF v_display_name IS NOT NULL AND v_display_name <> '' AND v_display_name NOT LIKE '%@%' THEN
    v_sender_name := v_display_name;
  ELSE
    v_sender_name := 'Someone';
  END IF;

  SELECT COALESCE(NULLIF(name, ''), 'Group chat')
  INTO v_group_name
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  v_deep_link := '/group-chats/' || NEW.conversation_id;

  FOR v_recipient IN
    SELECT cp.user_id, COALESCE(p.language, 'en') AS language
    FROM public.conversation_participants cp
    LEFT JOIN public.profiles p ON p.id = cp.user_id
    WHERE cp.conversation_id = NEW.conversation_id
      AND cp.user_id <> NEW.sender_id
      AND COALESCE(cp.is_ai, false) = false
  LOOP
    IF v_recipient.language = 'ar' THEN
      v_notification_title := v_sender_name || ' أرسل رسالة في ' || v_group_name;
      v_notification_body := CASE
        WHEN NEW.message_type = 'text' THEN COALESCE(NULLIF(LEFT(BTRIM(COALESCE(NEW.content, '')), 80), ''), 'رسالة جديدة')
        WHEN NEW.message_type = 'image' THEN '📷 صورة'
        WHEN NEW.message_type = 'voice' THEN '🎤 رسالة صوتية'
        WHEN NEW.message_type = 'pdf' THEN '📄 مستند'
        ELSE 'رسالة جديدة'
      END;
    ELSE
      v_notification_title := v_sender_name || ' sent a message in ' || v_group_name;
      v_notification_body := CASE
        WHEN NEW.message_type = 'text' THEN COALESCE(NULLIF(LEFT(BTRIM(COALESCE(NEW.content, '')), 80), ''), 'New message')
        WHEN NEW.message_type = 'image' THEN '📷 Image'
        WHEN NEW.message_type = 'voice' THEN '🎤 Voice message'
        WHEN NEW.message_type = 'pdf' THEN '📄 Document'
        ELSE 'New message'
      END;
    END IF;

    PERFORM public.create_notification(
      v_recipient.user_id,
      'group_message_received',
      v_notification_title,
      v_notification_body,
      jsonb_build_object(
        'conversation_id', NEW.conversation_id,
        'message_id', NEW.id,
        'sender_id', NEW.sender_id,
        'sender_name', v_sender_name,
        'group_name', v_group_name,
        'message_type', NEW.message_type,
        'deep_link', v_deep_link
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
