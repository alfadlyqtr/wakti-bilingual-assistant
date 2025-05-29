
-- Add missing columns to ai_chat_history table for browsing functionality
ALTER TABLE public.ai_chat_history 
ADD COLUMN IF NOT EXISTS browsing_used boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS browsing_data jsonb DEFAULT null,
ADD COLUMN IF NOT EXISTS quota_status jsonb DEFAULT null;

-- Update the table to ensure all rows have default values
UPDATE public.ai_chat_history 
SET 
  browsing_used = COALESCE(browsing_used, false),
  browsing_data = COALESCE(browsing_data, null),
  quota_status = COALESCE(quota_status, null)
WHERE browsing_used IS NULL OR browsing_data IS NULL OR quota_status IS NULL;
