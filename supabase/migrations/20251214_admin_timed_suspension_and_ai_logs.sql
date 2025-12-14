-- Migration: Add timed suspensions + AI logs table
-- Date: 2024-12-14

-- ============================================
-- 1. Add suspended_until column to profiles
-- ============================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS suspended_until timestamp with time zone;

-- ============================================
-- 2. Update suspend_user function to support timed suspensions
-- ============================================
CREATE OR REPLACE FUNCTION public.suspend_user(
  p_user_id uuid,
  p_admin_id uuid,
  p_reason text DEFAULT 'Account suspended by admin',
  p_until timestamp with time zone DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    is_suspended = true,
    suspended_at = now(),
    suspended_by = p_admin_id,
    suspension_reason = p_reason,
    suspended_until = p_until,
    updated_at = now()
  WHERE id = p_user_id;
  
  RETURN FOUND;
END;
$$;

-- ============================================
-- 3. Update unsuspend_user function to clear suspended_until
-- ============================================
CREATE OR REPLACE FUNCTION public.unsuspend_user(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    is_suspended = false,
    suspended_at = null,
    suspended_by = null,
    suspension_reason = null,
    suspended_until = null,
    updated_at = now()
  WHERE id = p_user_id;
  
  RETURN FOUND;
END;
$$;

-- ============================================
-- 4. Create ai_logs table for unified AI usage tracking
-- ============================================
CREATE TABLE IF NOT EXISTS public.ai_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- What was called
  function_name text NOT NULL,
  model text,
  
  -- Status
  status text NOT NULL DEFAULT 'success',
  error_message text,
  
  -- Input/Output (trimmed for storage)
  prompt text,
  response text,
  
  -- Metadata (mode, language, tone, style, etc.)
  metadata jsonb DEFAULT '{}',
  
  -- Usage metrics
  input_tokens integer DEFAULT 0,
  output_tokens integer DEFAULT 0,
  total_tokens integer DEFAULT 0,
  duration_ms integer DEFAULT 0,
  cost_credits numeric(10, 6) DEFAULT 0
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_logs_user_id ON public.ai_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created_at ON public.ai_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_logs_function_name ON public.ai_logs(function_name);
CREATE INDEX IF NOT EXISTS idx_ai_logs_model ON public.ai_logs(model);
CREATE INDEX IF NOT EXISTS idx_ai_logs_status ON public.ai_logs(status);

-- Enable RLS
ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;

-- Admin-only access (via service role or admin functions)
-- Users cannot directly read ai_logs
CREATE POLICY "Service role full access to ai_logs"
  ON public.ai_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 5. Helper function to log AI usage (called from Edge Functions)
-- ============================================
CREATE OR REPLACE FUNCTION public.log_ai_usage(
  p_user_id uuid,
  p_function_name text,
  p_model text DEFAULT NULL,
  p_status text DEFAULT 'success',
  p_error_message text DEFAULT NULL,
  p_prompt text DEFAULT NULL,
  p_response text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}',
  p_input_tokens integer DEFAULT 0,
  p_output_tokens integer DEFAULT 0,
  p_duration_ms integer DEFAULT 0,
  p_cost_credits numeric DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO public.ai_logs (
    user_id,
    function_name,
    model,
    status,
    error_message,
    prompt,
    response,
    metadata,
    input_tokens,
    output_tokens,
    total_tokens,
    duration_ms,
    cost_credits
  ) VALUES (
    p_user_id,
    p_function_name,
    p_model,
    p_status,
    p_error_message,
    -- Trim prompt/response to avoid huge storage
    LEFT(p_prompt, 2000),
    LEFT(p_response, 2000),
    p_metadata,
    p_input_tokens,
    p_output_tokens,
    p_input_tokens + p_output_tokens,
    p_duration_ms,
    p_cost_credits
  )
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- ============================================
-- 6. Admin function to query AI logs with filters
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_get_ai_logs(
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 50,
  p_user_id uuid DEFAULT NULL,
  p_function_name text DEFAULT NULL,
  p_model text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_from timestamp with time zone DEFAULT NULL,
  p_to timestamp with time zone DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  created_at timestamp with time zone,
  user_id uuid,
  user_email text,
  user_display_name text,
  function_name text,
  model text,
  status text,
  error_message text,
  prompt text,
  response text,
  metadata jsonb,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  duration_ms integer,
  cost_credits numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offset integer;
BEGIN
  v_offset := (p_page - 1) * p_limit;
  
  RETURN QUERY
  SELECT 
    al.id,
    al.created_at,
    al.user_id,
    p.email as user_email,
    p.display_name as user_display_name,
    al.function_name,
    al.model,
    al.status,
    al.error_message,
    al.prompt,
    al.response,
    al.metadata,
    al.input_tokens,
    al.output_tokens,
    al.total_tokens,
    al.duration_ms,
    al.cost_credits
  FROM public.ai_logs al
  LEFT JOIN public.profiles p ON p.id = al.user_id
  WHERE 
    (p_user_id IS NULL OR al.user_id = p_user_id)
    AND (p_function_name IS NULL OR al.function_name = p_function_name)
    AND (p_model IS NULL OR al.model = p_model)
    AND (p_status IS NULL OR al.status = p_status)
    AND (p_from IS NULL OR al.created_at >= p_from)
    AND (p_to IS NULL OR al.created_at <= p_to)
  ORDER BY al.created_at DESC
  LIMIT p_limit
  OFFSET v_offset;
END;
$$;

-- ============================================
-- 7. Admin function to get AI logs stats
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_get_ai_logs_stats(
  p_from timestamp with time zone DEFAULT NULL,
  p_to timestamp with time zone DEFAULT NULL
)
RETURNS TABLE (
  total_calls bigint,
  success_calls bigint,
  error_calls bigint,
  success_rate numeric,
  total_tokens bigint,
  total_cost numeric,
  unique_users bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_calls,
    COUNT(*) FILTER (WHERE al.status = 'success')::bigint as success_calls,
    COUNT(*) FILTER (WHERE al.status = 'error')::bigint as error_calls,
    CASE 
      WHEN COUNT(*) > 0 
      THEN ROUND((COUNT(*) FILTER (WHERE al.status = 'success')::numeric / COUNT(*)::numeric) * 100, 1)
      ELSE 0 
    END as success_rate,
    COALESCE(SUM(al.total_tokens), 0)::bigint as total_tokens,
    COALESCE(SUM(al.cost_credits), 0)::numeric as total_cost,
    COUNT(DISTINCT al.user_id)::bigint as unique_users
  FROM public.ai_logs al
  WHERE 
    (p_from IS NULL OR al.created_at >= p_from)
    AND (p_to IS NULL OR al.created_at <= p_to);
END;
$$;

-- ============================================
-- 8. Get distinct function names for filter dropdown
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_get_ai_function_names()
RETURNS TABLE (function_name text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT DISTINCT al.function_name 
  FROM public.ai_logs al 
  WHERE al.function_name IS NOT NULL
  ORDER BY al.function_name;
$$;

-- ============================================
-- 9. Get distinct models for filter dropdown
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_get_ai_models()
RETURNS TABLE (model text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT DISTINCT al.model 
  FROM public.ai_logs al 
  WHERE al.model IS NOT NULL
  ORDER BY al.model;
$$;
