
-- Add missing columns to user_voice_clones table
ALTER TABLE public.user_voice_clones 
ADD COLUMN IF NOT EXISTS voice_description TEXT,
ADD COLUMN IF NOT EXISTS elevenlabs_data JSONB;
