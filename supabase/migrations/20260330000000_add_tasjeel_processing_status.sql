-- Add processing_status field to tasjeel_records
-- This allows the backend orchestrator to track where each record is in the pipeline
-- and the frontend to show accurate progress states instead of managing all steps client-side.

ALTER TABLE public.tasjeel_records
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'done';

-- Valid values:
--   uploading     - audio file is being uploaded to storage
--   transcribing  - transcription edge function is running
--   summarizing   - summarize-text edge function is running
--   generating_speech - generate-speech edge function is running
--   done          - all steps complete, record is ready
--   failed        - one or more steps failed (check error_message)
--   partial       - completed without speech generation (summary exists but no audio)

ALTER TABLE public.tasjeel_records
  ADD COLUMN IF NOT EXISTS error_message text;

COMMENT ON COLUMN public.tasjeel_records.processing_status IS 'Pipeline stage: uploading, transcribing, summarizing, generating_speech, done, partial, failed';
COMMENT ON COLUMN public.tasjeel_records.error_message IS 'Last error encountered during processing, if any';

-- Index for efficiently querying incomplete/stuck records
CREATE INDEX IF NOT EXISTS idx_tasjeel_records_processing_status
  ON public.tasjeel_records (processing_status)
  WHERE processing_status <> 'done';
