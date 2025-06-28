
-- Update the ConversationSummaryManager to trigger at 10+ messages instead of 20
-- Add cleanup function for old summaries (2-3 weeks retention)
-- Add message counting system

-- First, let's add a column to track when the summary was last updated with message count
ALTER TABLE public.ai_conversation_summaries 
ADD COLUMN IF NOT EXISTS messages_since_summary INTEGER DEFAULT 0;

-- Create function to clean up old conversation summaries (older than 2-3 weeks)
CREATE OR REPLACE FUNCTION public.cleanup_old_conversation_summaries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete summaries older than 2.5 weeks (17.5 days)
  DELETE FROM public.ai_conversation_summaries
  WHERE updated_at < now() - INTERVAL '17.5 days';
  
  -- Log cleanup action
  RAISE NOTICE 'Cleaned up old conversation summaries at %', now();
END;
$$;

-- Create function to update summary refresh logic
CREATE OR REPLACE FUNCTION public.refresh_conversation_summary_if_needed(
  p_user_id UUID,
  p_conversation_id UUID,
  p_current_message_count INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  summary_record RECORD;
  messages_since_last_summary INTEGER;
BEGIN
  -- Get existing summary
  SELECT id, message_count, messages_since_summary
  INTO summary_record
  FROM public.ai_conversation_summaries
  WHERE user_id = p_user_id AND conversation_id = p_conversation_id;
  
  -- If no summary exists and we have 10+ messages, indicate refresh needed
  IF NOT FOUND AND p_current_message_count >= 10 THEN
    RETURN TRUE;
  END IF;
  
  -- If summary exists, check if we need to refresh
  IF FOUND THEN
    messages_since_last_summary := p_current_message_count - summary_record.message_count;
    
    -- If 10+ new messages since last summary, refresh needed
    IF messages_since_last_summary >= 10 THEN
      -- Update the messages_since_summary counter
      UPDATE public.ai_conversation_summaries
      SET messages_since_summary = messages_since_last_summary,
          updated_at = now()
      WHERE user_id = p_user_id AND conversation_id = p_conversation_id;
      
      RETURN TRUE;
    END IF;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Create cron job for weekly cleanup of old summaries
-- This will run every Sunday at 2 AM
SELECT cron.schedule(
  'cleanup-old-conversation-summaries',
  '0 2 * * 0', -- Every Sunday at 2 AM
  'SELECT public.cleanup_old_conversation_summaries();'
);

-- Add index for better performance on cleanup queries
CREATE INDEX IF NOT EXISTS idx_ai_conversation_summaries_updated_at 
ON public.ai_conversation_summaries(updated_at);

-- Add index for better performance on message counting
CREATE INDEX IF NOT EXISTS idx_ai_conversation_summaries_message_count 
ON public.ai_conversation_summaries(user_id, conversation_id, message_count);
