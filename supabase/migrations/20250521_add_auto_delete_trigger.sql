
-- Create a cron job to call our edge function every day at midnight
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

-- Add index to improve performance of auto-deletion queries
CREATE INDEX IF NOT EXISTS idx_tasjeel_records_created_at ON public.tasjeel_records (created_at);

-- Add comment to help future maintainers understand this feature
COMMENT ON TABLE public.tasjeel_records IS 'Stores voice recordings with transcriptions and summaries. Records are automatically deleted after 10 days.';
