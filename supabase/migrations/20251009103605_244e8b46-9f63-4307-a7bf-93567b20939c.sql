-- Add is_saved column to messages table
ALTER TABLE public.messages 
ADD COLUMN is_saved BOOLEAN NOT NULL DEFAULT false;

-- Create index for better performance on saved messages queries
CREATE INDEX idx_messages_saved ON public.messages(recipient_id, is_saved) WHERE is_saved = true;

-- Update the cleanup function to preserve saved messages
CREATE OR REPLACE FUNCTION public.cleanup_old_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only delete NON-SAVED messages older than 3 days (72 hours)
  DELETE FROM public.messages 
  WHERE created_at < now() - INTERVAL '3 days'
  AND is_saved = false;
  
  -- Delete orphaned files from storage (only for messages that were deleted)
  DELETE FROM storage.objects 
  WHERE bucket_id = 'message_attachments' 
  AND created_at < now() - INTERVAL '3 days'
  AND NOT EXISTS (
    SELECT 1 FROM public.messages 
    WHERE messages.media_url LIKE '%' || objects.name || '%'
  );
  
  RAISE NOTICE 'Cleaned up old non-saved messages at %', now();
END;
$$;