
-- Create the storage bucket for message media if it doesn't exist
INSERT INTO storage.buckets (id, name, public)  
VALUES ('message_media', 'message_media', true)
ON CONFLICT (id) DO NOTHING;

-- Set security policies for the message_media bucket
-- Allow public read access to all objects
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT 
USING (bucket_id = 'message_media');

-- Allow authenticated users to upload their own media
CREATE POLICY "Authenticated Users Can Upload"
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'message_media' AND auth.role() = 'authenticated');

-- Allow authenticated users to update/delete their own media
CREATE POLICY "Users Can Update Their Own Media"
ON storage.objects FOR UPDATE 
USING (bucket_id = 'message_media' AND auth.uid() = owner)
WITH CHECK (bucket_id = 'message_media' AND auth.uid() = owner);

CREATE POLICY "Users Can Delete Their Own Media"
ON storage.objects FOR DELETE 
USING (bucket_id = 'message_media' AND auth.uid() = owner);
