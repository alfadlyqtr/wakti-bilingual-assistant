
-- Add voice related columns to voice_summaries table if they don't exist

ALTER TABLE voice_summaries 
ADD COLUMN IF NOT EXISTS summary_voice TEXT,
ADD COLUMN IF NOT EXISTS summary_language TEXT;

-- Create an index on summary_audio_url for faster lookups
CREATE INDEX IF NOT EXISTS idx_voice_summaries_audio_url ON voice_summaries(summary_audio_url);
