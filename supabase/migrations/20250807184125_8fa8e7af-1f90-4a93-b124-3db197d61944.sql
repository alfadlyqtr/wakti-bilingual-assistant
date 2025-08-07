-- Fix the get_or_create_user_voice_quota function to resolve variable scope bug
CREATE OR REPLACE FUNCTION public.get_or_create_user_voice_quota(p_user_id uuid)
 RETURNS TABLE(characters_used integer, characters_limit integer, extra_characters integer, purchase_date timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_characters_used INTEGER;
  v_characters_limit INTEGER;
  v_extra_characters INTEGER;
  v_purchase_date TIMESTAMP WITH TIME ZONE;
  v_monthly_period TEXT;  -- Fixed: Use standalone variable instead of quota_record.monthly_period
  current_month TEXT := to_char(now(), 'YYYY-MM');
  should_reset_monthly BOOLEAN := false;
BEGIN
  -- Try to get existing voice usage record
  SELECT 
    uvu.characters_used, 
    uvu.characters_limit, 
    uvu.extra_characters, 
    uvu.purchase_date,
    uvu.monthly_period
  INTO 
    v_characters_used,
    v_characters_limit,
    v_extra_characters,
    v_purchase_date,
    v_monthly_period  -- Fixed: Use standalone variable
  FROM public.user_voice_usage uvu
  WHERE uvu.user_id = p_user_id;
  
  -- If no record exists, create one
  IF NOT FOUND THEN
    -- Set default values
    v_characters_used := 0;
    v_characters_limit := 6000;
    v_extra_characters := 0;
    v_purchase_date := NULL;
    v_monthly_period := current_month;  -- Fixed: Initialize the variable
    
    -- Insert new record
    INSERT INTO public.user_voice_usage (
      user_id, 
      characters_used, 
      characters_limit,
      extra_characters,
      purchase_date,
      monthly_period,
      monthly_reset_date,
      created_at,
      updated_at
    )
    VALUES (
      p_user_id,
      v_characters_used,
      v_characters_limit,
      v_extra_characters,
      v_purchase_date,
      v_monthly_period,
      now(),
      now(),
      now()
    );
    
    RAISE NOTICE 'Created new voice quota record for user %', p_user_id;
  ELSE
    -- Check if we need to reset for new month
    IF v_monthly_period != current_month THEN  -- Fixed: Use standalone variable
      should_reset_monthly := true;
      RAISE NOTICE 'Monthly reset needed for user %. Old period: %, New period: %', p_user_id, v_monthly_period, current_month;
    END IF;
  END IF;
  
  -- Check if extra characters have expired (30 days)
  IF v_purchase_date IS NOT NULL AND 
     v_purchase_date < (now() - INTERVAL '30 days') THEN
    -- Reset expired extras
    UPDATE public.user_voice_usage
    SET 
      extra_characters = 0, 
      purchase_date = NULL, 
      updated_at = now()
    WHERE user_id = p_user_id;
    
    v_extra_characters := 0;
    v_purchase_date := NULL;
    
    RAISE NOTICE 'Reset expired extra characters for user %', p_user_id;
  END IF;
  
  -- Perform monthly reset if needed
  IF should_reset_monthly THEN
    UPDATE public.user_voice_usage
    SET 
      characters_used = 0,
      monthly_period = current_month,
      monthly_reset_date = now(),
      updated_at = now()
    WHERE user_id = p_user_id;
    
    v_characters_used := 0;
    
    RAISE NOTICE 'Monthly voice quota reset completed for user %', p_user_id;
  END IF;
  
  -- Return the quota information
  RETURN QUERY SELECT 
    v_characters_used, 
    v_characters_limit, 
    v_extra_characters, 
    v_purchase_date;
END;
$function$;