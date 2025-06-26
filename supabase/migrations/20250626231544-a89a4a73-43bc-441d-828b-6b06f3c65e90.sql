
-- Update ai_user_knowledge table to support all personalization fields
ALTER TABLE public.ai_user_knowledge 
ADD COLUMN IF NOT EXISTS nickname TEXT,
ADD COLUMN IF NOT EXISTS ai_tone TEXT DEFAULT 'neutral',
ADD COLUMN IF NOT EXISTS reply_style TEXT DEFAULT 'detailed',
ADD COLUMN IF NOT EXISTS traits TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS auto_enable BOOLEAN DEFAULT true;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_user_knowledge_user_id ON public.ai_user_knowledge(user_id);

-- Create or replace function to upsert user personalization
CREATE OR REPLACE FUNCTION public.upsert_user_personalization(
  p_user_id UUID,
  p_nickname TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_main_use TEXT DEFAULT NULL,
  p_interests TEXT[] DEFAULT '{}',
  p_ai_tone TEXT DEFAULT 'neutral',
  p_reply_style TEXT DEFAULT 'detailed',
  p_traits TEXT[] DEFAULT '{}',
  p_communication_style TEXT DEFAULT NULL,
  p_response_length TEXT DEFAULT NULL,
  p_personal_note TEXT DEFAULT NULL,
  p_auto_enable BOOLEAN DEFAULT true
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  nickname TEXT,
  role TEXT,
  main_use TEXT,
  interests TEXT[],
  ai_tone TEXT,
  reply_style TEXT,
  traits TEXT[],
  communication_style TEXT,
  response_length TEXT,
  personal_note TEXT,
  auto_enable BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.ai_user_knowledge (
    user_id,
    nickname,
    role,
    main_use,
    interests,
    ai_tone,
    reply_style,
    traits,
    communication_style,
    response_length,
    personal_note,
    auto_enable
  ) VALUES (
    p_user_id,
    p_nickname,
    p_role,
    p_main_use,
    p_interests,
    p_ai_tone,
    p_reply_style,
    p_traits,
    p_communication_style,
    p_response_length,
    p_personal_note,
    p_auto_enable
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    nickname = COALESCE(EXCLUDED.nickname, ai_user_knowledge.nickname),
    role = COALESCE(EXCLUDED.role, ai_user_knowledge.role),
    main_use = COALESCE(EXCLUDED.main_use, ai_user_knowledge.main_use),
    interests = COALESCE(EXCLUDED.interests, ai_user_knowledge.interests),
    ai_tone = COALESCE(EXCLUDED.ai_tone, ai_user_knowledge.ai_tone),
    reply_style = COALESCE(EXCLUDED.reply_style, ai_user_knowledge.reply_style),
    traits = COALESCE(EXCLUDED.traits, ai_user_knowledge.traits),
    communication_style = COALESCE(EXCLUDED.communication_style, ai_user_knowledge.communication_style),
    response_length = COALESCE(EXCLUDED.response_length, ai_user_knowledge.response_length),
    personal_note = COALESCE(EXCLUDED.personal_note, ai_user_knowledge.personal_note),
    auto_enable = COALESCE(EXCLUDED.auto_enable, ai_user_knowledge.auto_enable),
    updated_at = now()
  RETURNING 
    ai_user_knowledge.id,
    ai_user_knowledge.user_id,
    ai_user_knowledge.nickname,
    ai_user_knowledge.role,
    ai_user_knowledge.main_use,
    ai_user_knowledge.interests,
    ai_user_knowledge.ai_tone,
    ai_user_knowledge.reply_style,
    ai_user_knowledge.traits,
    ai_user_knowledge.communication_style,
    ai_user_knowledge.response_length,
    ai_user_knowledge.personal_note,
    ai_user_knowledge.auto_enable,
    ai_user_knowledge.created_at,
    ai_user_knowledge.updated_at;
  
  RETURN QUERY
  SELECT 
    ai_user_knowledge.id,
    ai_user_knowledge.user_id,
    ai_user_knowledge.nickname,
    ai_user_knowledge.role,
    ai_user_knowledge.main_use,
    ai_user_knowledge.interests,
    ai_user_knowledge.ai_tone,
    ai_user_knowledge.reply_style,
    ai_user_knowledge.traits,
    ai_user_knowledge.communication_style,
    ai_user_knowledge.response_length,
    ai_user_knowledge.personal_note,
    ai_user_knowledge.auto_enable,
    ai_user_knowledge.created_at,
    ai_user_knowledge.updated_at
  FROM public.ai_user_knowledge
  WHERE ai_user_knowledge.user_id = p_user_id;
END;
$$;

-- Enable RLS if not already enabled
ALTER TABLE public.ai_user_knowledge ENABLE ROW LEVEL SECURITY;

-- Create policy for users to access their own personalization data
DROP POLICY IF EXISTS "Users can access their own personalization" ON public.ai_user_knowledge;
CREATE POLICY "Users can access their own personalization" ON public.ai_user_knowledge
  FOR ALL USING (auth.uid() = user_id);
