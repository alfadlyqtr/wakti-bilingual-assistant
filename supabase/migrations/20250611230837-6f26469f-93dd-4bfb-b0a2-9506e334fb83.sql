
-- Fix RLS policies for complete user isolation
-- Add missing WITH CHECK clauses for INSERT policies

-- Fix ai_chat_history policies
DROP POLICY IF EXISTS "Users can create their own chat history" ON public.ai_chat_history;
CREATE POLICY "Users can create their own chat history" 
  ON public.ai_chat_history 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Fix ai_conversations policies  
DROP POLICY IF EXISTS "Users can create their own conversations" ON public.ai_conversations;
CREATE POLICY "Users can create their own conversations" 
  ON public.ai_conversations 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Fix ai_usage_logs policies
DROP POLICY IF EXISTS "Users can create their own usage logs" ON public.ai_usage_logs;
CREATE POLICY "Users can create their own usage logs" 
  ON public.ai_usage_logs 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Remove search quota restrictions by modifying functions to always return success
-- Update increment_search_usage to always allow advanced searches
CREATE OR REPLACE FUNCTION public.increment_search_usage(p_user_id uuid)
RETURNS TABLE(success boolean, daily_count integer, extra_advanced_searches integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Always return success with unlimited searches
  RETURN QUERY SELECT TRUE, 0, 999999;
END;
$$;

-- Update increment_regular_search_usage to always allow regular searches
CREATE OR REPLACE FUNCTION public.increment_regular_search_usage(p_user_id uuid)
RETURNS TABLE(success boolean, regular_search_count integer, extra_regular_searches integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Always return success with unlimited searches
  RETURN QUERY SELECT TRUE, 0, 999999;
END;
$$;

-- Update get_or_create_user_search_quota to return unlimited quotas
CREATE OR REPLACE FUNCTION public.get_or_create_user_search_quota(p_user_id uuid)
RETURNS TABLE(daily_count integer, extra_searches integer, purchase_date timestamp with time zone, regular_search_count integer, extra_regular_searches integer, extra_advanced_searches integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Always return unlimited quotas
  RETURN QUERY SELECT 0, 999999, null::timestamp with time zone, 0, 999999, 999999;
END;
$$;
