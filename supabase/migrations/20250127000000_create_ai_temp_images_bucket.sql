
-- Create bucket for temporary AI image uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('ai-temp-images', 'ai-temp-images', true);

-- Create policy to allow authenticated users to upload
CREATE POLICY "Allow authenticated users to upload images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'ai-temp-images' 
  AND auth.role() = 'authenticated'
);

-- Allow public read access for AI processing
CREATE POLICY "Allow public read for AI processing" ON storage.objects
FOR SELECT USING (bucket_id = 'ai-temp-images');

-- Allow users to delete their own uploads
CREATE POLICY "Allow users to delete own uploads" ON storage.objects
FOR DELETE USING (
  bucket_id = 'ai-temp-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
