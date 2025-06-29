
-- Fix RLS policies for voice translation quota tables

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can create their own voice translation quotas" ON public.user_voice_translation_quotas;
DROP POLICY IF EXISTS "Users can view their own voice translation quotas" ON public.user_voice_translation_quotas;
DROP POLICY IF EXISTS "Users can update their own voice translation quotas" ON public.user_voice_translation_quotas;

-- Create proper RLS policies for user_voice_translation_quotas
CREATE POLICY "Users can create their own voice translation quotas" 
  ON public.user_voice_translation_quotas 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own voice translation quotas" 
  ON public.user_voice_translation_quotas 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own voice translation quotas" 
  ON public.user_voice_translation_quotas 
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ensure RLS is enabled
ALTER TABLE public.user_voice_translation_quotas ENABLE ROW LEVEL SECURITY;

-- Fix RLS policies for user_voice_usage table if needed
DROP POLICY IF EXISTS "Users can create their own voice usage" ON public.user_voice_usage;
DROP POLICY IF EXISTS "Users can view their own voice usage" ON public.user_voice_usage;
DROP POLICY IF EXISTS "Users can update their own voice usage" ON public.user_voice_usage;

CREATE POLICY "Users can create their own voice usage" 
  ON public.user_voice_usage 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own voice usage" 
  ON public.user_voice_usage 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own voice usage" 
  ON public.user_voice_usage 
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ensure RLS is enabled
ALTER TABLE public.user_voice_usage ENABLE ROW LEVEL SECURITY;
