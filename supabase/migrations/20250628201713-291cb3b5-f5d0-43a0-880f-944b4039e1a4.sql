
-- Create table for AI conversation summaries to enhance memory without affecting speed
CREATE TABLE public.ai_conversation_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  last_message_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.ai_conversation_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversation summaries" 
  ON public.ai_conversation_summaries 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversation summaries" 
  ON public.ai_conversation_summaries 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversation summaries" 
  ON public.ai_conversation_summaries 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversation summaries" 
  ON public.ai_conversation_summaries 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_ai_conversation_summaries_updated_at
  BEFORE UPDATE ON public.ai_conversation_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for better performance
CREATE INDEX idx_ai_conversation_summaries_user_id ON public.ai_conversation_summaries(user_id);
CREATE INDEX idx_ai_conversation_summaries_conversation_id ON public.ai_conversation_summaries(conversation_id);
