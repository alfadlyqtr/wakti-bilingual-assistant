
-- Remove the orphaned voice "اليامي" from the database
DELETE FROM public.user_voice_clones 
WHERE voice_name = 'اليامي';

-- Create storage bucket for voice recordings if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-recordings',
  'voice-recordings', 
  false,
  10485760, -- 10MB limit
  ARRAY['audio/wav', 'audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/ogg']
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

-- Add audio_file_url column to user_voice_clones table to track stored files
ALTER TABLE public.user_voice_clones 
ADD COLUMN IF NOT EXISTS audio_file_url text;

-- Add created_at index for better performance
CREATE INDEX IF NOT EXISTS idx_user_voice_clones_created_at 
ON public.user_voice_clones(created_at);
