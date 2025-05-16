
-- Create the storage bucket for avatars if it doesn't exist
INSERT INTO storage.buckets (id, name, public)  
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Set security policies for the avatars bucket
-- Allow public read access to all objects
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

-- Allow authenticated users to upload/update/delete their own avatars
CREATE POLICY "Authenticated Users Can Upload"
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated Users Can Update Their Own Avatars"
ON storage.objects FOR UPDATE 
USING (bucket_id = 'avatars' AND auth.uid() = owner)
WITH CHECK (bucket_id = 'avatars' AND auth.uid() = owner);

CREATE POLICY "Authenticated Users Can Delete Their Own Avatars"
ON storage.objects FOR DELETE 
USING (bucket_id = 'avatars' AND auth.uid() = owner);
