
-- Create the wakti-ai-v2 bucket for AI file uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('wakti-ai-v2', 'wakti-ai-v2', true);

-- Create policy to allow authenticated users to upload
CREATE POLICY "Allow authenticated users to upload to wakti-ai-v2" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'wakti-ai-v2' 
  AND auth.role() = 'authenticated'
);

-- Allow public read access
CREATE POLICY "Allow public read for wakti-ai-v2" ON storage.objects
FOR SELECT USING (bucket_id = 'wakti-ai-v2');

-- Allow users to delete their own uploads
CREATE POLICY "Allow users to delete own uploads in wakti-ai-v2" ON storage.objects
FOR DELETE USING (
  bucket_id = 'wakti-ai-v2' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
