
-- Create ai_quota_management table with proper structure and policies
CREATE TABLE IF NOT EXISTS public.ai_quota_management (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_characters_used INTEGER DEFAULT 0 NOT NULL,
  search_characters_used INTEGER DEFAULT 0 NOT NULL,
  image_prompts_used INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.ai_quota_management ENABLE ROW LEVEL SECURITY;

-- Policy: users can only access their own quota data
CREATE POLICY "Users can access their own quota data" ON public.ai_quota_management
  FOR ALL USING (auth.uid() = user_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_ai_quota_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_quota_management_updated_at
  BEFORE UPDATE ON public.ai_quota_management
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_quota_updated_at();

-- Function to get or create quota silently
CREATE OR REPLACE FUNCTION get_or_create_ai_quota(p_user_id UUID)
RETURNS TABLE(
  chat_characters_used INTEGER,
  search_characters_used INTEGER,
  image_prompts_used INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  quota_record RECORD;
BEGIN
  -- Try to get existing quota record
  SELECT aqm.chat_characters_used, aqm.search_characters_used, aqm.image_prompts_used, aqm.created_at, aqm.updated_at
  INTO quota_record
  FROM public.ai_quota_management aqm
  WHERE aqm.user_id = p_user_id;
  
  -- If no record exists, create one silently
  IF NOT FOUND THEN
    INSERT INTO public.ai_quota_management (
      user_id, 
      chat_characters_used, 
      search_characters_used, 
      image_prompts_used
    )
    VALUES (
      p_user_id,
      0,
      0,
      0
    )
    RETURNING chat_characters_used, search_characters_used, image_prompts_used, created_at, updated_at
    INTO quota_record;
  END IF;
  
  RETURN QUERY SELECT quota_record.chat_characters_used, quota_record.search_characters_used, quota_record.image_prompts_used, quota_record.created_at, quota_record.updated_at;
END;
$$;
