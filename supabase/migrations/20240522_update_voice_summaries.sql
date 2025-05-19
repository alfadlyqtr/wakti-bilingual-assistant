
-- Add status tracking fields to voice_summaries table

ALTER TABLE voice_summaries 
ADD COLUMN IF NOT EXISTS is_ready BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_processing_transcript BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_processing_summary BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_processing_tts BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS transcript_error TEXT,
ADD COLUMN IF NOT EXISTS summary_error TEXT,
ADD COLUMN IF NOT EXISTS tts_error TEXT,
ADD COLUMN IF NOT EXISTS transcript_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS summary_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tts_completed_at TIMESTAMP WITH TIME ZONE;

-- Update existing records to mark them as ready
UPDATE voice_summaries
SET is_ready = TRUE
WHERE summary IS NOT NULL AND transcript IS NOT NULL;
