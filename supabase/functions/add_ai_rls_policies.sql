
-- Enable RLS on AI tables if not already enabled
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_user_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for ai_conversations
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.ai_conversations;
CREATE POLICY "Users can view their own conversations" 
  ON public.ai_conversations 
  FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own conversations" ON public.ai_conversations;
CREATE POLICY "Users can create their own conversations" 
  ON public.ai_conversations 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own conversations" ON public.ai_conversations;
CREATE POLICY "Users can update their own conversations" 
  ON public.ai_conversations 
  FOR UPDATE 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.ai_conversations;
CREATE POLICY "Users can delete their own conversations" 
  ON public.ai_conversations 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create RLS policies for ai_chat_history
DROP POLICY IF EXISTS "Users can view their own chat history" ON public.ai_chat_history;
CREATE POLICY "Users can view their own chat history" 
  ON public.ai_chat_history 
  FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own chat history" ON public.ai_chat_history;
CREATE POLICY "Users can create their own chat history" 
  ON public.ai_chat_history 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own chat history" ON public.ai_chat_history;
CREATE POLICY "Users can update their own chat history" 
  ON public.ai_chat_history 
  FOR UPDATE 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own chat history" ON public.ai_chat_history;
CREATE POLICY "Users can delete their own chat history" 
  ON public.ai_chat_history 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create RLS policies for ai_user_knowledge
DROP POLICY IF EXISTS "Users can view their own knowledge" ON public.ai_user_knowledge;
CREATE POLICY "Users can view their own knowledge" 
  ON public.ai_user_knowledge 
  FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own knowledge" ON public.ai_user_knowledge;
CREATE POLICY "Users can create their own knowledge" 
  ON public.ai_user_knowledge 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own knowledge" ON public.ai_user_knowledge;
CREATE POLICY "Users can update their own knowledge" 
  ON public.ai_user_knowledge 
  FOR UPDATE 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own knowledge" ON public.ai_user_knowledge;
CREATE POLICY "Users can delete their own knowledge" 
  ON public.ai_user_knowledge 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create RLS policies for ai_usage_logs
DROP POLICY IF EXISTS "Users can view their own usage logs" ON public.ai_usage_logs;
CREATE POLICY "Users can view their own usage logs" 
  ON public.ai_usage_logs 
  FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own usage logs" ON public.ai_usage_logs;
CREATE POLICY "Users can create their own usage logs" 
  ON public.ai_usage_logs 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
