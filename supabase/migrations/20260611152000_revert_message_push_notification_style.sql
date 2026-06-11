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
  v_user_language TEXT;
  v_notification_title TEXT;
  v_notification_body TEXT;
BEGIN
  SELECT username, display_name
  INTO v_username, v_display_name
  FROM public.profiles WHERE id = NEW.sender_id;
  
  IF v_username IS NOT NULL AND v_username != '' THEN
    v_sender_name := v_username;
  ELSIF v_display_name IS NOT NULL AND v_display_name != '' AND v_display_name NOT LIKE '%@%' THEN
    v_sender_name := v_display_name;
  ELSE
    v_sender_name := 'Someone';
  END IF;
  
  SELECT COALESCE(language, 'en') INTO v_user_language
  FROM public.profiles WHERE id = NEW.recipient_id;
  
  IF v_user_language = 'ar' THEN
    v_notification_title := v_sender_name || ' أرسل لك رسالة';
    v_notification_body := CASE 
      WHEN NEW.message_type = 'text' THEN LEFT(COALESCE(NEW.content, ''), 50)
      WHEN NEW.message_type = 'image' THEN '📷 صورة'
      WHEN NEW.message_type = 'voice' THEN '🎤 رسالة صوتية'
      WHEN NEW.message_type = 'pdf' THEN '📄 مستند'
      ELSE 'رسالة جديدة'
    END;
  ELSE
    v_notification_title := v_sender_name || ' sent you a message';
    v_notification_body := CASE 
      WHEN NEW.message_type = 'text' THEN LEFT(COALESCE(NEW.content, ''), 50)
      WHEN NEW.message_type = 'image' THEN '📷 Image'
      WHEN NEW.message_type = 'voice' THEN '🎤 Voice message'
      WHEN NEW.message_type = 'pdf' THEN '📄 Document'
      ELSE 'New message'
    END;
  END IF;
  
  PERFORM public.create_notification(
    NEW.recipient_id,
    'message_received',
    v_notification_title,
    v_notification_body,
    jsonb_build_object(
      'message_id', NEW.id,
      'sender_id', NEW.sender_id,
      'sender_name', v_sender_name,
      'message_type', NEW.message_type
    ),
    '/contacts?openChat=' || NEW.sender_id
  );
  
  RETURN NEW;
END;
$function$;
