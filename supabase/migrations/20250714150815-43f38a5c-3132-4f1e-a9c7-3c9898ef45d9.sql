
-- Update the cleanup_old_messages function to delete messages after 3 days instead of 24 hours
CREATE OR REPLACE FUNCTION public.cleanup_old_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Delete messages older than 3 days (was 24 hours)
  DELETE FROM public.messages 
  WHERE created_at < now() - INTERVAL '3 days';
  
  -- Delete orphaned files from storage older than 3 days (was 24 hours)
  DELETE FROM storage.objects 
  WHERE bucket_id = 'message_attachments' 
  AND created_at < now() - INTERVAL '3 days';
END;
$$;
