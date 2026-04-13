-- Create public bucket for music poster videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('music-posters', 'music-posters', true)
ON CONFLICT (id) DO NOTHING;

-- Allow service role to upload (edge functions use service key)
CREATE POLICY "Service role can upload music posters" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'music-posters');

-- Allow public read access (videos are public by design)
CREATE POLICY "Public read for music posters" ON storage.objects
FOR SELECT USING (bucket_id = 'music-posters');

-- Allow users to delete their own poster videos
CREATE POLICY "Users can delete own music posters" ON storage.objects
FOR DELETE USING (
  bucket_id = 'music-posters'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
