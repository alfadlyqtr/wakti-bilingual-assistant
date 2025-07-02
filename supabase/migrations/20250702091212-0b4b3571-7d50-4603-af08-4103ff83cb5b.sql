-- Clean up any remaining voice clone references
-- Remove storage bucket if it still exists
DELETE FROM storage.buckets WHERE id = 'voice-recordings';

-- Clean up any remaining objects in case they exist
DELETE FROM storage.objects WHERE bucket_id = 'voice-recordings';