-- Add missing columns to user_voice_clones table
ALTER TABLE public.user_voice_clones 
ADD COLUMN IF NOT EXISTS voice_description text,
ADD COLUMN IF NOT EXISTS elevenlabs_data jsonb;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_user_voice_clones_user_id ON public.user_voice_clones(user_id);
CREATE INDEX IF NOT EXISTS idx_user_voice_clones_voice_id ON public.user_voice_clones(voice_id);