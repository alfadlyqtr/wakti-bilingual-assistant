-- Create private storage bucket for saved TTS audio
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'saved-tts',
  'saved-tts',
  false, -- private bucket
  52428800, -- 50 MB
  ARRAY[
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/webm',
    'audio/ogg'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies: users can only access their own folder (first path segment = auth.uid())
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can upload their own saved tts'
  ) THEN
    CREATE POLICY "Users can upload their own saved tts"
      ON storage.objects
      FOR INSERT
      WITH CHECK (
        bucket_id = 'saved-tts'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can view their own saved tts'
  ) THEN
    CREATE POLICY "Users can view their own saved tts"
      ON storage.objects
      FOR SELECT
      USING (
        bucket_id = 'saved-tts'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can delete their own saved tts'
  ) THEN
    CREATE POLICY "Users can delete their own saved tts"
      ON storage.objects
      FOR DELETE
      USING (
        bucket_id = 'saved-tts'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

-- We now prefer storage_path over audio_url (audio_url may be a signed URL generated client-side)
ALTER TABLE public.saved_tts
  ALTER COLUMN audio_url DROP NOT NULL;

-- Ensure pg_cron + pg_net exist for scheduled HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily cleanup for expired saved TTS
CREATE OR REPLACE FUNCTION public.setup_saved_tts_cleanup_cron_job()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  v_supabase_url text;
BEGIN
  v_supabase_url := 'https://hxauxozopvpzpdygoqwf.supabase.co';

  BEGIN
    PERFORM cron.unschedule('cleanup-saved-tts');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  PERFORM cron.schedule(
    'cleanup-saved-tts',
    '15 2 * * *', -- Daily at 02:15 UTC
    format(
      'SELECT net.http_post(url := %L, headers := %L, body := %L);',
      v_supabase_url || '/functions/v1/cleanup-saved-tts',
      '{"Content-Type": "application/json"}',
      '{"automated": true}'
    )
  );

  result := json_build_object(
    'success', true,
    'message', 'Saved TTS cleanup cron job scheduled successfully'
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

-- Run once to (re)create the cron job
SELECT public.setup_saved_tts_cleanup_cron_job();
