
-- Create the missing ai_quota_management table for analytics tracking
CREATE TABLE public.ai_quota_management (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_characters_used INTEGER NOT NULL DEFAULT 0,
  search_characters_used INTEGER NOT NULL DEFAULT 0,
  image_prompts_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.ai_quota_management ENABLE ROW LEVEL SECURITY;

-- Create policy for users to only access their own quota data
CREATE POLICY "Users can view their own quota data" 
  ON public.ai_quota_management 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own quota data" 
  ON public.ai_quota_management 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quota data" 
  ON public.ai_quota_management 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create trigger to automatically update updated_at column
CREATE TRIGGER update_ai_quota_management_updated_at
  BEFORE UPDATE ON public.ai_quota_management
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to get or create user quota (silently)
CREATE OR REPLACE FUNCTION public.get_or_create_ai_quota(p_user_id uuid)
RETURNS TABLE(
  chat_characters_used integer,
  search_characters_used integer,
  image_prompts_used integer,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

-- Create index for better performance on user queries
CREATE INDEX idx_ai_quota_management_user_id ON public.ai_quota_management(user_id);
