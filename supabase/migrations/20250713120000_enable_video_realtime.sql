
-- Enable real-time updates for video_generation_tasks table
ALTER TABLE public.video_generation_tasks REPLICA IDENTITY FULL;

-- Add the table to the realtime publication
ALTER publication supabase_realtime ADD TABLE public.video_generation_tasks;
