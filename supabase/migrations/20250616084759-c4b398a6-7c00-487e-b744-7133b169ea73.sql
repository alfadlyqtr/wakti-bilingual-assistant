
-- Make the admin-uploads bucket public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'admin-uploads';

-- Create RLS policies to allow public access to files in admin-uploads bucket
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'admin-uploads' );

CREATE POLICY "Public Access Insert"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'admin-uploads' );
