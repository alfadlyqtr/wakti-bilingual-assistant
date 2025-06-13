
-- Enable pg_cron extension for notification scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant necessary permissions for cron jobs
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Create a function wrapper for better error handling
CREATE OR REPLACE FUNCTION public.setup_notification_cron_job()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  -- First, try to unschedule any existing job
  BEGIN
    PERFORM cron.unschedule('process-notifications');
  EXCEPTION WHEN OTHERS THEN
    -- Ignore errors if job doesn't exist
    NULL;
  END;
  
  -- Schedule the new job
  PERFORM cron.schedule(
    'process-notifications',
    '*/30 * * * * *', -- Every 30 seconds
    format(
      'SELECT net.http_post(url := %L, headers := %L, body := %L);',
      current_setting('app.settings.supabase_url') || '/functions/v1/process-notification-queue',
      '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}',
      '{}'
    )
  );
  
  result := json_build_object(
    'success', true,
    'message', 'Notification cron job scheduled successfully'
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
