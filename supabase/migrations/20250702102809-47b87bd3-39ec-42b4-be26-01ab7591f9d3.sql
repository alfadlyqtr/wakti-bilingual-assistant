-- Create user_voice_clones table to store ElevenLabs voice data
CREATE TABLE IF NOT EXISTS public.user_voice_clones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_id text NOT NULL UNIQUE,
  voice_name text NOT NULL,
  voice_description text,
  elevenlabs_data jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_voice_clones ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage their own voice clones" 
ON public.user_voice_clones 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_voice_clones_user_id ON public.user_voice_clones(user_id);
CREATE INDEX IF NOT EXISTS idx_user_voice_clones_voice_id ON public.user_voice_clones(voice_id);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_voice_clone_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_voice_clones_updated_at
  BEFORE UPDATE ON public.user_voice_clones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_voice_clone_updated_at();

-- Create storage buckets for voice recordings and generated audio
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-recordings',
  'voice-recordings', 
  false,
  10485760, -- 10MB limit
  ARRAY['audio/wav', 'audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/ogg']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-generated-audio',
  'voice-generated-audio', 
  false,
  52428800, -- 50MB limit for generated audio
  ARRAY['audio/mp3', 'audio/mpeg', 'audio/wav']
)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for voice recordings bucket
CREATE POLICY "Users can upload their own voice recordings"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'voice-recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own voice recordings"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'voice-recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own voice recordings"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'voice-recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create RLS policies for generated audio bucket
CREATE POLICY "Users can upload their own generated audio"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'voice-generated-audio' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own generated audio"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'voice-generated-audio' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own generated audio"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'voice-generated-audio' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);