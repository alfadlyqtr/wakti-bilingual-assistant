CREATE OR REPLACE FUNCTION public.notify_on_new_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_sender_name TEXT;
  v_username TEXT;
  v_display_name TEXT;
  v_avatar_url TEXT;
  v_user_language TEXT;
  v_message_preview TEXT;
BEGIN
  SELECT username, display_name, avatar_url
  INTO v_username, v_display_name, v_avatar_url
  FROM public.profiles
  WHERE id = NEW.sender_id;

  IF v_display_name IS NOT NULL AND btrim(v_display_name) <> '' AND v_display_name NOT LIKE '%@%' THEN
    v_sender_name := btrim(v_display_name);
  ELSIF v_username IS NOT NULL AND btrim(v_username) <> '' THEN
    v_sender_name := btrim(v_username);
  ELSE
    v_sender_name := 'Someone';
  END IF;

  SELECT COALESCE(language, 'en')
  INTO v_user_language
  FROM public.profiles
  WHERE id = NEW.recipient_id;

  IF v_user_language = 'ar' THEN
    v_message_preview := CASE
      WHEN NEW.message_type = 'text' THEN COALESCE(NULLIF(LEFT(btrim(COALESCE(NEW.content, '')), 80), ''), 'رسالة جديدة')
      WHEN NEW.message_type = 'image' THEN '📷 صورة'
      WHEN NEW.message_type = 'voice' THEN '🎤 رسالة صوتية'
      WHEN NEW.message_type = 'pdf' THEN '📄 مستند'
      ELSE 'رسالة جديدة'
    END;
  ELSE
    v_message_preview := CASE
      WHEN NEW.message_type = 'text' THEN COALESCE(NULLIF(LEFT(btrim(COALESCE(NEW.content, '')), 80), ''), 'New message')
      WHEN NEW.message_type = 'image' THEN '📷 Image'
      WHEN NEW.message_type = 'voice' THEN '🎤 Voice message'
      WHEN NEW.message_type = 'pdf' THEN '📄 Document'
      ELSE 'New message'
    END;
  END IF;

  PERFORM public.create_notification(
    NEW.recipient_id,
    'message_received',
    v_sender_name,
    v_message_preview,
    jsonb_build_object(
      'message_id', NEW.id,
      'sender_id', NEW.sender_id,
      'sender_name', v_sender_name,
      'sender_avatar_url', v_avatar_url,
      'message_type', NEW.message_type,
      'message_preview', v_message_preview
    ),
    '/contacts?openChat=' || NEW.sender_id
  );

  RETURN NEW;
END;
$function$;
