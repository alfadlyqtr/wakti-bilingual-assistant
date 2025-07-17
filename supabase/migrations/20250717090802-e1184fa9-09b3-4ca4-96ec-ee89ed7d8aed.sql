
-- Add missing tables to supabase_realtime publication for real-time notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.my_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_task_completions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.maw3d_rsvps;

-- Set REPLICA IDENTITY FULL for complete change data capture
ALTER TABLE public.my_tasks REPLICA IDENTITY FULL;
ALTER TABLE public.shared_task_completions REPLICA IDENTITY FULL;
ALTER TABLE public.maw3d_rsvps REPLICA IDENTITY FULL;
