
-- Check if the reset actually worked and debug the quota functions
-- First, let's see the current state of the quota tables
SELECT 'translation_quotas' as table_name, count(*) as row_count, 
       sum(daily_count) as total_daily_used, 
       sum(extra_translations) as total_extras
FROM public.user_translation_quotas
UNION ALL
SELECT 'voice_usage' as table_name, count(*) as row_count,
       sum(characters_used) as total_used,
       sum(extra_characters) as total_extras  
FROM public.user_voice_usage
UNION ALL
SELECT 'search_quotas' as table_name, count(*) as row_count,
       sum(daily_count) as total_daily_used,
       sum(extra_advanced_searches) as total_extras
FROM public.user_search_quotas;

-- Also ensure the get_or_create functions work properly after reset
-- Fix the get_or_create_user_search_quota function to properly handle reset data
CREATE OR REPLACE FUNCTION public.get_or_create_user_search_quota(p_user_id uuid)
 RETURNS TABLE(daily_count integer, extra_searches integer, purchase_date timestamp with time zone, regular_search_count integer, extra_regular_searches integer, extra_advanced_searches integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  current_month TEXT := to_char(now(), 'YYYY-MM');
  quota_record RECORD;
BEGIN
  -- Try to get existing search quota record for current month
  SELECT usq.daily_count, usq.extra_searches, usq.purchase_date, 
         usq.regular_search_count, usq.extra_regular_searches, usq.extra_advanced_searches
  INTO quota_record
  FROM public.user_search_quotas usq
  WHERE usq.user_id = p_user_id AND usq.monthly_date = current_month;
  
  -- If no record exists for current month, create one
  IF NOT FOUND THEN
    INSERT INTO public.user_search_quotas (
      user_id, 
      daily_count, 
      monthly_date,
      extra_searches,
      regular_search_count,
      extra_regular_searches, 
      extra_advanced_searches
    )
    VALUES (
      p_user_id,
      0,
      current_month,
      0,
      0,
      0,
      0
    )
    RETURNING daily_count, extra_searches, purchase_date, regular_search_count, 
              extra_regular_searches, extra_advanced_searches
    INTO quota_record;
  END IF;
  
  -- Check if extra searches have expired (30 days)
  IF quota_record.purchase_date IS NOT NULL AND 
     quota_record.purchase_date < (now() - INTERVAL '30 days') THEN
    -- Reset expired extras
    UPDATE public.user_search_quotas
    SET extra_searches = 0, extra_regular_searches = 0, extra_advanced_searches = 0,
        purchase_date = NULL, updated_at = now()
    WHERE user_id = p_user_id AND monthly_date = current_month;
    
    quota_record.extra_searches := 0;
    quota_record.extra_regular_searches := 0;
    quota_record.extra_advanced_searches := 0;
    quota_record.purchase_date := NULL;
  END IF;
  
  RETURN QUERY SELECT quota_record.daily_count, quota_record.extra_searches, quota_record.purchase_date,
                      quota_record.regular_search_count, quota_record.extra_regular_searches, 
                      quota_record.extra_advanced_searches;
END;
$function$;
