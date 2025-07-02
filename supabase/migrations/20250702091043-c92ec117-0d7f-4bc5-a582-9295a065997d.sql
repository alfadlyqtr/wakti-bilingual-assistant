-- Remove voice clone system components completely

-- Drop user_voice_clones table
DROP TABLE IF EXISTS public.user_voice_clones CASCADE;

-- Delete all objects from voice-recordings bucket first
DELETE FROM storage.objects WHERE bucket_id = 'voice-recordings';

-- Delete the voice-recordings storage bucket
DELETE FROM storage.buckets WHERE id = 'voice-recordings';

-- Remove any related triggers or functions
DROP TRIGGER IF EXISTS update_voice_clone_updated_at_trigger ON public.user_voice_clones;
DROP FUNCTION IF EXISTS public.update_voice_clone_updated_at();

-- Remove voice recording upload trigger if it exists
DROP TRIGGER IF EXISTS log_voice_recording_upload_trigger ON storage.objects;
DROP FUNCTION IF EXISTS public.log_voice_recording_upload();