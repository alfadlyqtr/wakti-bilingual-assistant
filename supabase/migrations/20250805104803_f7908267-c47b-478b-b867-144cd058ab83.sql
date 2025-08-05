-- Phase 1: Ultra-Safe Database Cleanup
-- Remove legacy task tables with 0 records and no active code references

-- Drop legacy task tables
DROP TABLE IF EXISTS public.my_tasks CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.subtasks CASCADE;
DROP TABLE IF EXISTS public.task_shares CASCADE;

-- Remove unused storage buckets with 0 files
DELETE FROM storage.buckets WHERE id = 'video_generator_images';
DELETE FROM storage.buckets WHERE id = 'vision_uploads';
DELETE FROM storage.buckets WHERE id = 'events';