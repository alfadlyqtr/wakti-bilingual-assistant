-- Clean up video generation storage objects first, then remove bucket
DELETE FROM storage.objects WHERE bucket_id = 'ai-temp-images';

-- Now remove the bucket
DELETE FROM storage.buckets WHERE id = 'ai-temp-images';

-- Remove video generation table
DROP TABLE IF EXISTS public.video_generation_tasks CASCADE;