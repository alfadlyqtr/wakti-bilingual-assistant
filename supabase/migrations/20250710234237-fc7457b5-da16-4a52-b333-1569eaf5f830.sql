
-- Phase 1: Create Memory Table with Personalization Integration
CREATE TABLE IF NOT EXISTS public.user_memory_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Core Memory Fields
  interaction_count INTEGER DEFAULT 0,
  last_interaction TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  relationship_style TEXT DEFAULT 'casual',
  communication_style TEXT DEFAULT 'friendly',
  current_projects TEXT,
  working_patterns TEXT,
  recent_achievements TEXT,
  conversation_themes TEXT[],
  user_expertise TEXT[],
  preferred_help_style TEXT,
  
  -- Personalization Integration Fields
  ai_nickname TEXT,
  preferred_tone TEXT,
  reply_style TEXT,
  custom_instructions TEXT,
  preferred_nickname TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one record per user
  UNIQUE(user_id)
);

-- Add RLS policies for user_memory_context
ALTER TABLE public.user_memory_context ENABLE ROW LEVEL SECURITY;

-- Users can only access their own memory context
CREATE POLICY "Users can manage their own memory context" 
  ON public.user_memory_context 
  FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_memory_context_user_id ON public.user_memory_context(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_context_last_interaction ON public.user_memory_context(last_interaction);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_user_memory_context_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_memory_context_updated_at
  BEFORE UPDATE ON public.user_memory_context
  FOR EACH ROW
  EXECUTE FUNCTION update_user_memory_context_updated_at();
