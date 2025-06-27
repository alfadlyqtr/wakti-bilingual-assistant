
-- Create vision_uploads bucket for AI vision functionality
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vision_uploads',
  'vision_uploads', 
  true,
  5242880, -- 5MB in bytes
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
);

-- Create RLS policy for vision uploads bucket
CREATE POLICY "Users can upload their own vision files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'vision_uploads' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own vision files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'vision_uploads' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own vision files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'vision_uploads' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Enable public access for vision uploads (needed for OpenAI API)
CREATE POLICY "Public access to vision files" ON storage.objects
FOR SELECT USING (bucket_id = 'vision_uploads');
