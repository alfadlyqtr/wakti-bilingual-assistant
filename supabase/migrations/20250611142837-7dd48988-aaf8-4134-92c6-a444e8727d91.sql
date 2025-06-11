
-- Enable required extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the auto-delete function to run daily at midnight UTC
SELECT cron.schedule(
  'auto-delete-old-tasjeel-recordings',
  '0 0 * * *', -- Run daily at midnight
  $$
  SELECT 
    net.http_post(
      url:='https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/auto-delete-recordings',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Also run it once manually to clean up existing old records
SELECT 
  net.http_post(
    url:='https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/auto-delete-recordings',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
