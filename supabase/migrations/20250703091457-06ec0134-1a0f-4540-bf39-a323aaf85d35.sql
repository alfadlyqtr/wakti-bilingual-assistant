-- Setup cron job for daily voice clone cleanup (runs every day at 2 AM)
SELECT cron.schedule(
  'cleanup-expired-voice-clones',
  '0 2 * * *', -- Daily at 2 AM
  $$
  SELECT
    net.http_post(
        url:='https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/cleanup-voice-clones',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU"}'::jsonb,
        body:=concat('{"scheduled": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);