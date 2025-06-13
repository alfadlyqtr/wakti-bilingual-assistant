
-- Create the missing setup_notification_cron_job function with hardcoded values
CREATE OR REPLACE FUNCTION public.setup_notification_cron_job()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  supabase_url text := 'https://hxauxozopvpzpdygoqwf.supabase.co';
  service_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA3MDE2NCwiZXhwIjoyMDYyNjQ2MTY0fQ.qZZC3QOKqrmUGb8r9NQLgcO-jBEiN4_2l_YmqL7tBeg';
BEGIN
  -- First, try to unschedule any existing job
  BEGIN
    PERFORM cron.unschedule('process-notifications');
  EXCEPTION WHEN OTHERS THEN
    -- Ignore errors if job doesn't exist
    NULL;
  END;
  
  -- Schedule the new job to run every 30 seconds
  PERFORM cron.schedule(
    'process-notifications',
    '*/30 * * * * *', -- Every 30 seconds
    format(
      'SELECT net.http_post(url := %L, headers := %L, body := %L);',
      supabase_url || '/functions/v1/process-notification-queue',
      '{"Content-Type": "application/json", "Authorization": "Bearer ' || service_key || '"}',
      '{}'
    )
  );
  
  result := json_build_object(
    'success', true,
    'message', 'Notification cron job scheduled successfully to run every 30 seconds'
  );
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  result := json_build_object(
    'success', false,
    'error', SQLERRM
  );
  RETURN result;
END;
$$;
