
-- Drop existing functions first to avoid return type conflicts
DROP FUNCTION IF EXISTS public.increment_search_usage(uuid);
DROP FUNCTION IF EXISTS public.increment_regular_search_usage(uuid);
DROP FUNCTION IF EXISTS public.purchase_extra_searches(uuid, integer);

-- Add separate columns for regular and advanced extra searches
ALTER TABLE public.user_search_quotas 
ADD COLUMN IF NOT EXISTS extra_regular_searches integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_advanced_searches integer DEFAULT 0;

-- Migrate existing extra_searches data to both columns for backward compatibility
UPDATE public.user_search_quotas 
SET extra_regular_searches = extra_searches,
    extra_advanced_searches = extra_searches
WHERE extra_searches > 0;

-- Update the get_or_create_user_search_quota function to return separate extra search types
DROP FUNCTION IF EXISTS public.get_or_create_user_search_quota(uuid);

CREATE OR REPLACE FUNCTION public.get_or_create_user_search_quota(p_user_id uuid)
RETURNS TABLE(daily_count integer, extra_searches integer, purchase_date timestamp with time zone, regular_search_count integer, extra_regular_searches integer, extra_advanced_searches integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  current_month TEXT := to_char(now(), 'YYYY-MM');
  quota_record RECORD;
BEGIN
  -- Try to get current month's search quota
  SELECT usq.daily_count, usq.extra_searches, usq.purchase_date, usq.regular_search_count, usq.extra_regular_searches, usq.extra_advanced_searches
  INTO quota_record
  FROM public.user_search_quotas usq
  WHERE usq.user_id = p_user_id AND usq.monthly_date = current_month;
  
  -- If no record exists for this month, create one
  IF NOT FOUND THEN
    -- Get the latest extra_searches from previous records
    SELECT usq.extra_searches, usq.purchase_date, usq.extra_regular_searches, usq.extra_advanced_searches
    INTO quota_record
    FROM public.user_search_quotas usq
    WHERE usq.user_id = p_user_id
    ORDER BY usq.monthly_date DESC
    LIMIT 1;
    
    -- Create new record for current month
    INSERT INTO public.user_search_quotas (
      user_id, 
      daily_count, 
      daily_date, 
      monthly_date,
      regular_search_count,
      extra_searches, 
      extra_regular_searches,
      extra_advanced_searches,
      purchase_date
    )
    VALUES (
      p_user_id,
      0,
      CURRENT_DATE,
      current_month,
      0,
      COALESCE(quota_record.extra_searches, 0),
      COALESCE(quota_record.extra_regular_searches, 0),
      COALESCE(quota_record.extra_advanced_searches, 0),
      quota_record.purchase_date
    )
    RETURNING user_search_quotas.daily_count, user_search_quotas.extra_searches, user_search_quotas.purchase_date, user_search_quotas.regular_search_count, user_search_quotas.extra_regular_searches, user_search_quotas.extra_advanced_searches
    INTO quota_record;
  END IF;
  
  -- Check if extra searches have expired (30 days)
  IF quota_record.purchase_date IS NOT NULL AND 
     quota_record.purchase_date < (now() - INTERVAL '30 days') THEN
    -- Reset expired extras
    UPDATE public.user_search_quotas
    SET extra_searches = 0, extra_regular_searches = 0, extra_advanced_searches = 0, purchase_date = NULL, updated_at = now()
    WHERE user_id = p_user_id AND monthly_date = current_month;
    
    quota_record.extra_searches := 0;
    quota_record.extra_regular_searches := 0;
    quota_record.extra_advanced_searches := 0;
    quota_record.purchase_date := NULL;
  END IF;
  
  RETURN QUERY SELECT 
    quota_record.daily_count, 
    quota_record.extra_searches, 
    quota_record.purchase_date,
    COALESCE(quota_record.regular_search_count, 0),
    COALESCE(quota_record.extra_regular_searches, 0),
    COALESCE(quota_record.extra_advanced_searches, 0);
END;
$function$;

-- Create new increment_search_usage function for advanced searches
CREATE OR REPLACE FUNCTION public.increment_search_usage(p_user_id uuid)
RETURNS TABLE(success boolean, daily_count integer, extra_advanced_searches integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  current_month TEXT := to_char(now(), 'YYYY-MM');
  current_daily INTEGER;
  current_extras INTEGER;
  max_monthly CONSTANT INTEGER := 5; -- 5 free advanced searches per month
BEGIN
  -- Get current quota
  SELECT usq.daily_count, usq.extra_advanced_searches
  INTO current_daily, current_extras
  FROM public.user_search_quotas usq
  WHERE usq.user_id = p_user_id AND usq.monthly_date = current_month;
  
  -- If no record exists, create one first
  IF NOT FOUND THEN
    PERFORM public.get_or_create_user_search_quota(p_user_id);
    current_daily := 0;
    current_extras := 0;
  END IF;
  
  -- Check if user can search (advanced search limit: 5 per month)
  IF current_daily < max_monthly THEN
    -- Increment monthly count
    UPDATE public.user_search_quotas
    SET daily_count = daily_count + 1, updated_at = now()
    WHERE user_id = p_user_id AND monthly_date = current_month;
    
    current_daily := current_daily + 1;
    RETURN QUERY SELECT TRUE, current_daily, current_extras;
  ELSIF current_extras > 0 THEN
    -- Use extra advanced search
    UPDATE public.user_search_quotas
    SET extra_advanced_searches = extra_advanced_searches - 1, updated_at = now()
    WHERE user_id = p_user_id AND monthly_date = current_month;
    
    current_extras := current_extras - 1;
    RETURN QUERY SELECT TRUE, current_daily, current_extras;
  ELSE
    -- No searches available
    RETURN QUERY SELECT FALSE, current_daily, current_extras;
  END IF;
END;
$function$;

-- Create new increment_regular_search_usage function for regular searches
CREATE OR REPLACE FUNCTION public.increment_regular_search_usage(p_user_id uuid)
RETURNS TABLE(success boolean, regular_search_count integer, extra_regular_searches integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  current_month TEXT := to_char(now(), 'YYYY-MM');
  current_regular INTEGER;
  current_extras INTEGER;
  max_monthly CONSTANT INTEGER := 15; -- 15 free regular searches per month
BEGIN
  -- Get current quota
  SELECT usq.regular_search_count, usq.extra_regular_searches
  INTO current_regular, current_extras
  FROM public.user_search_quotas usq
  WHERE usq.user_id = p_user_id AND usq.monthly_date = current_month;
  
  -- If no record exists, create one first
  IF NOT FOUND THEN
    PERFORM public.get_or_create_user_search_quota(p_user_id);
    current_regular := 0;
    current_extras := 0;
  END IF;
  
  -- Check if user can search (regular search limit: 15 per month)
  IF current_regular < max_monthly THEN
    -- Increment monthly count
    UPDATE public.user_search_quotas
    SET regular_search_count = regular_search_count + 1, updated_at = now()
    WHERE user_id = p_user_id AND monthly_date = current_month;
    
    current_regular := current_regular + 1;
    RETURN QUERY SELECT TRUE, current_regular, current_extras;
  ELSIF current_extras > 0 THEN
    -- Use extra regular search
    UPDATE public.user_search_quotas
    SET extra_regular_searches = extra_regular_searches - 1, updated_at = now()
    WHERE user_id = p_user_id AND monthly_date = current_month;
    
    current_extras := current_extras - 1;
    RETURN QUERY SELECT TRUE, current_regular, current_extras;
  ELSE
    -- No searches available
    RETURN QUERY SELECT FALSE, current_regular, current_extras;
  END IF;
END;
$function$;

-- Create separate purchase functions for regular and advanced searches
CREATE OR REPLACE FUNCTION public.purchase_extra_regular_searches(p_user_id uuid, p_count integer)
RETURNS TABLE(success boolean, new_extra_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  current_month TEXT := to_char(now(), 'YYYY-MM');
  current_extras INTEGER;
BEGIN
  -- Ensure user search quota exists for current month
  PERFORM public.get_or_create_user_search_quota(p_user_id);
  
  -- Add extra regular searches
  UPDATE public.user_search_quotas
  SET 
    extra_regular_searches = extra_regular_searches + p_count,
    purchase_date = now(),
    updated_at = now()
  WHERE user_id = p_user_id AND monthly_date = current_month
  RETURNING extra_regular_searches INTO current_extras;
  
  RETURN QUERY SELECT TRUE, current_extras;
END;
$function$;

CREATE OR REPLACE FUNCTION public.purchase_extra_advanced_searches(p_user_id uuid, p_count integer)
RETURNS TABLE(success boolean, new_extra_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  current_month TEXT := to_char(now(), 'YYYY-MM');
  current_extras INTEGER;
BEGIN
  -- Ensure user search quota exists for current month
  PERFORM public.get_or_create_user_search_quota(p_user_id);
  
  -- Add extra advanced searches
  UPDATE public.user_search_quotas
  SET 
    extra_advanced_searches = extra_advanced_searches + p_count,
    purchase_date = now(),
    updated_at = now()
  WHERE user_id = p_user_id AND monthly_date = current_month
  RETURNING extra_advanced_searches INTO current_extras;
  
  RETURN QUERY SELECT TRUE, current_extras;
END;
$function$;
