
-- Add user_email column to user_voice_clones table for better identification
ALTER TABLE public.user_voice_clones 
ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Create index for better performance on email lookups
CREATE INDEX IF NOT EXISTS idx_user_voice_clones_user_email 
ON public.user_voice_clones(user_email);

-- Update existing records to populate user_email from profiles table
UPDATE public.user_voice_clones 
SET user_email = profiles.email 
FROM public.profiles 
WHERE user_voice_clones.user_id = profiles.id 
AND user_voice_clones.user_email IS NULL;
