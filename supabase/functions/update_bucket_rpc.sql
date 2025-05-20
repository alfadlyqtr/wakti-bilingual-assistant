
-- SQL function to allow updating storage bucket configuration
-- Must be run with service role permissions
CREATE OR REPLACE FUNCTION public.admin_update_storage_bucket(
  p_bucket_id TEXT,
  p_public BOOLEAN DEFAULT FALSE,
  p_file_size_limit BIGINT DEFAULT NULL,
  p_allowed_mime_types TEXT[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Update the bucket with the provided parameters
  UPDATE storage.buckets
  SET 
    public = p_public,
    file_size_limit = p_file_size_limit,
    allowed_mime_types = p_allowed_mime_types
  WHERE id = p_bucket_id
  RETURNING json_build_object(
    'id', id,
    'name', name,
    'public', public,
    'file_size_limit', file_size_limit,
    'allowed_mime_types', allowed_mime_types,
    'updated_at', updated_at
  ) INTO result;

  -- If no rows were updated, bucket doesn't exist
  IF result IS NULL THEN
    RAISE EXCEPTION 'Bucket % not found', p_bucket_id;
  END IF;

  RETURN result;
END;
$$;

-- Clean up existing policies to prevent conflicts
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'objects' 
      AND schemaname = 'storage'
      AND policyname LIKE '%voice_recordings%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', policy_record.policyname);
  END LOOP;
END $$;

-- Create fresh policies for voice_recordings bucket
-- This ensures exactly ONE policy per operation type (SELECT, INSERT, UPDATE, DELETE)

-- Users can view their own files based on folder path
CREATE POLICY "users_select_own_voice_recordings" 
ON storage.objects FOR SELECT
USING (
  bucket_id = 'voice_recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can upload their own files based on folder path
CREATE POLICY "users_insert_own_voice_recordings" 
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'voice_recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can update their own files based on folder path
CREATE POLICY "users_update_own_voice_recordings" 
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'voice_recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own files based on folder path
CREATE POLICY "users_delete_own_voice_recordings" 
ON storage.objects FOR DELETE
USING (
  bucket_id = 'voice_recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
