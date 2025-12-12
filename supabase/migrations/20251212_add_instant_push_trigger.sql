-- Add instant push trigger for all notification types
-- This ensures wakti-send-push is called immediately when any notification is created

-- First, ensure pg_net extension is available (for HTTP calls)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create the trigger function that calls wakti-send-push
CREATE OR REPLACE FUNCTION public.trigger_instant_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_service_key TEXT;
BEGIN
  -- Get service role key from vault (or use environment)
  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_service_role_key'
  LIMIT 1;
  
  -- If no vault secret, try to get from current_setting
  IF v_service_key IS NULL THEN
    v_service_key := current_setting('app.settings.service_role_key', true);
  END IF;
  
  -- If still no key, use hardcoded service role key (not ideal but works)
  IF v_service_key IS NULL OR v_service_key = '' THEN
    v_service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA3MDE2NCwiZXhwIjoyMDYyNjQ2MTY0fQ.U_0lkOOgcl72I1Whs7HzM5QNk3BfKE3-_DwQO91NKDA';
  END IF;

  -- Call wakti-send-push Edge Function with the notification_id
  PERFORM net.http_post(
    url := 'https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/wakti-send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object('notification_id', NEW.id)
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Failed to trigger instant push for notification %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$function$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS instant_push_trigger ON public.notification_history;

-- Create the trigger on notification_history
CREATE TRIGGER instant_push_trigger
  AFTER INSERT ON public.notification_history
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_instant_push();

-- Add a comment for documentation
COMMENT ON FUNCTION public.trigger_instant_push() IS 'Triggers wakti-send-push Edge Function immediately when a notification is created';
