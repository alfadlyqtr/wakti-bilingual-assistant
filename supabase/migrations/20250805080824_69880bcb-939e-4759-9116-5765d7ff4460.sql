-- Remove video generation tables and cleanup
DROP TABLE IF EXISTS public.video_generation_tasks CASCADE;

-- Remove ai-temp-images storage bucket for video generation
DELETE FROM storage.buckets WHERE id = 'ai-temp-images';