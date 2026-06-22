
-- Function to find anonymous users older than 7 days
CREATE OR REPLACE FUNCTION public.get_old_anonymous_user_ids()
RETURNS TABLE(id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT u.id
  FROM auth.users u
  WHERE u.is_anonymous = true
    AND u.created_at < now() - interval '7 days';
$$;

-- Grant execute to service_role so the edge function can call it
GRANT EXECUTE ON FUNCTION public.get_old_anonymous_user_ids() TO service_role;

-- Schedule the cleanup job to run every Sunday at midnight UTC
-- This removes anonymous users who never converted to a full account after 7 days
SELECT cron.schedule(
  'cleanup-anonymous-users',
  '0 0 * * 0', -- Every Sunday at midnight UTC
  $$
  SELECT
    net.http_post(
      url := 'https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/cleanup-anonymous-users',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU"}'::jsonb,
      body := '{"automated": true}'::jsonb
    ) as request_id;
  $$
);
