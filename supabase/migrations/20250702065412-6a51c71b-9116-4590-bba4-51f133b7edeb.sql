-- Create user_voice_clones table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_voice_clones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_id text NOT NULL,
  voice_name text NOT NULL,
  voice_description text,
  elevenlabs_data jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_voice_clones ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can manage their own voice clones" ON public.user_voice_clones;
CREATE POLICY "Users can manage their own voice clones" 
ON public.user_voice_clones 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_voice_clones_user_id ON public.user_voice_clones(user_id);
CREATE INDEX IF NOT EXISTS idx_user_voice_clones_voice_id ON public.user_voice_clones(voice_id);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_user_voice_clones_updated_at ON public.user_voice_clones;
CREATE TRIGGER update_user_voice_clones_updated_at
  BEFORE UPDATE ON public.user_voice_clones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();