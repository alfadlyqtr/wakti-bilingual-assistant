
-- Enhance ai_conversation_summaries table for 10-day rolling summaries
ALTER TABLE public.ai_conversation_summaries 
ADD COLUMN IF NOT EXISTS summary_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS context_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS compressed_summary TEXT,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '10 days');

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_conversation_summaries_expires_at 
ON public.ai_conversation_summaries(expires_at);

-- Create function to automatically update summary expiry
CREATE OR REPLACE FUNCTION public.update_summary_expiry()
RETURNS TRIGGER AS $$
BEGIN
  NEW.expires_at := now() + INTERVAL '10 days';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update expiry on summary updates
DROP TRIGGER IF EXISTS trigger_update_summary_expiry ON public.ai_conversation_summaries;
CREATE TRIGGER trigger_update_summary_expiry
  BEFORE UPDATE ON public.ai_conversation_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_summary_expiry();

-- Function to clean up expired summaries
CREATE OR REPLACE FUNCTION public.cleanup_expired_summaries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.ai_conversation_summaries
  WHERE expires_at < now();
  
  RAISE NOTICE 'Cleaned up expired conversation summaries at %', now();
END;
$$;

-- Create enhanced function for conversation summary management
CREATE OR REPLACE FUNCTION public.upsert_conversation_summary(
  p_user_id UUID,
  p_conversation_id UUID,
  p_summary_text TEXT,
  p_message_count INTEGER,
  p_compressed_summary TEXT DEFAULT NULL,
  p_context_tokens INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  summary_text TEXT,
  compressed_summary TEXT,
  message_count INTEGER,
  context_tokens INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.ai_conversation_summaries (
    user_id,
    conversation_id,
    summary_text,
    message_count,
    compressed_summary,
    context_tokens,
    last_message_date,
    expires_at
  ) VALUES (
    p_user_id,
    p_conversation_id,
    p_summary_text,
    p_message_count,
    COALESCE(p_compressed_summary, LEFT(p_summary_text, 500)),
    p_context_tokens,
    now(),
    now() + INTERVAL '10 days'
  )
  ON CONFLICT (user_id, conversation_id)
  DO UPDATE SET
    summary_text = EXCLUDED.summary_text,
    message_count = EXCLUDED.message_count,
    compressed_summary = COALESCE(EXCLUDED.compressed_summary, LEFT(EXCLUDED.summary_text, 500)),
    context_tokens = EXCLUDED.context_tokens,
    last_message_date = now(),
    updated_at = now(),
    expires_at = now() + INTERVAL '10 days'
  RETURNING 
    ai_conversation_summaries.id,
    ai_conversation_summaries.summary_text,
    ai_conversation_summaries.compressed_summary,
    ai_conversation_summaries.message_count,
    ai_conversation_summaries.context_tokens,
    ai_conversation_summaries.created_at,
    ai_conversation_summaries.updated_at;
END;
$$;
