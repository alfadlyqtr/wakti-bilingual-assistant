UPDATE storage.buckets
SET public = false
WHERE id = 'tasjeel_recordings';

DROP POLICY IF EXISTS "Allow anyone to read Tasjeel recordings" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload Tasjeel recordings" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own Tasjeel recordings" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their own Tasjeel recordings" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete objects in tasjeel_recordings" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read tasjeel_recordings" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update objects in tasjeel_recordings" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload to tasjeel_recordings" ON storage.objects;

CREATE POLICY "Tasjeel owners can read recordings"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'tasjeel_recordings'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Tasjeel owners can upload recordings"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tasjeel_recordings'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Tasjeel owners can update recordings"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tasjeel_recordings'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'tasjeel_recordings'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Tasjeel owners can delete recordings"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'tasjeel_recordings'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
