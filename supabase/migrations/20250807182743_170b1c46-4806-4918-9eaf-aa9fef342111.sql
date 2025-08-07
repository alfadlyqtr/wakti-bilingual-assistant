-- Set up cron job for monthly voice quota reset (1st of every month at midnight Qatar time)
-- Qatar is UTC+3, so we schedule for 21:00 UTC (which is midnight Qatar time)
SELECT cron.schedule(
  'monthly-voice-quota-reset',
  '0 21 1 * *', -- At 21:00 UTC on the 1st of every month (midnight Qatar time)
  $$
  SELECT
    net.http_post(
        url:='https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/reset-monthly-voice-quotas',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA3MDE2NCwiZXhwIjoyMDYyNjQ2MTY0fQ.U_0lkOOgcl72I1Whs7HzM5QNk3BfKE3-_DwQO91NKDA"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Also schedule a backup monthly reset via the existing daily quota function on the 1st
-- This ensures voice quotas are reset even if the dedicated function fails
SELECT cron.schedule(
  'backup-monthly-voice-reset',
  '5 21 1 * *', -- 5 minutes after the main reset, at 21:05 UTC (00:05 Qatar time)
  $$
  SELECT
    net.http_post(
        url:='https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/reset-daily-quotas',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA3MDE2NCwiZXhwIjoyMDYyNjQ2MTY0fQ.U_0lkOOgcl72I1Whs7HzM5QNk3BfKE3-_DwQO91NKDA"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);