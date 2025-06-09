
-- Create the message-media storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-media', 'message-media', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the message-media bucket

-- Allow public read access to all objects in message-media bucket
CREATE POLICY "Public Read Access for message-media"
ON storage.objects FOR SELECT 
USING (bucket_id = 'message-media');

-- Allow authenticated users to upload their own files
CREATE POLICY "Authenticated Users Can Upload to message-media"
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'message-media' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own files
CREATE POLICY "Users Can Update Their Own Files in message-media"
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'message-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'message-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to delete their own files
CREATE POLICY "Users Can Delete Their Own Files in message-media"
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'message-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
