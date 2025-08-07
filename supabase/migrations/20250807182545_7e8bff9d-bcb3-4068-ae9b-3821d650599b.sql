-- Add monthly tracking columns to user_voice_usage table
ALTER TABLE public.user_voice_usage 
ADD COLUMN IF NOT EXISTS monthly_period TEXT DEFAULT to_char(now(), 'YYYY-MM'),
ADD COLUMN IF NOT EXISTS monthly_reset_date TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Update existing records to have current month period
UPDATE public.user_voice_usage 
SET monthly_period = to_char(now(), 'YYYY-MM'),
    monthly_reset_date = now()
WHERE monthly_period IS NULL;

-- Create or replace the voice quota function with monthly reset logic
CREATE OR REPLACE FUNCTION public.get_or_create_user_voice_quota(p_user_id uuid)
RETURNS TABLE(characters_used integer, characters_limit integer, extra_characters integer, purchase_date timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  quota_record RECORD;
  v_characters_used INTEGER;
  v_characters_limit INTEGER;
  v_extra_characters INTEGER;
  v_purchase_date TIMESTAMP WITH TIME ZONE;
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
    quota_record.monthly_period
  FROM public.user_voice_usage uvu
  WHERE uvu.user_id = p_user_id;
  
  -- If no record exists, create one
  IF NOT FOUND THEN
    -- Set default values
    v_characters_used := 0;
    v_characters_limit := 6000;
    v_extra_characters := 0;
    v_purchase_date := NULL;
    
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
      current_month,
      now(),
      now(),
      now()
    );
    
    RAISE NOTICE 'Created new voice quota record for user %', p_user_id;
  ELSE
    -- Check if we need to reset for new month
    IF quota_record.monthly_period != current_month THEN
      should_reset_monthly := true;
      RAISE NOTICE 'Monthly reset needed for user %. Old period: %, New period: %', p_user_id, quota_record.monthly_period, current_month;
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

-- Create function to reset all users' monthly voice quotas
CREATE OR REPLACE FUNCTION public.reset_monthly_voice_quotas()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  current_month TEXT := to_char(now(), 'YYYY-MM');
  reset_count INTEGER := 0;
  result jsonb;
BEGIN
  -- Reset monthly voice quotas for all users
  UPDATE public.user_voice_usage
  SET 
    characters_used = 0,
    monthly_period = current_month,
    monthly_reset_date = now(),
    updated_at = now()
  WHERE monthly_period != current_month;
  
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  
  -- Log the reset action
  INSERT INTO public.audit_logs (
    action,
    table_name,
    record_id,
    user_id,
    details
  ) VALUES (
    'monthly_voice_quota_reset',
    'user_voice_usage',
    'system',
    '00000000-0000-0000-0000-000000000000'::uuid,
    jsonb_build_object(
      'reset_count', reset_count,
      'reset_month', current_month,
      'reset_date', now(),
      'type', 'automatic_monthly_reset'
    )
  );
  
  result := jsonb_build_object(
    'success', true,
    'reset_count', reset_count,
    'reset_month', current_month,
    'reset_date', now()
  );
  
  RAISE NOTICE 'Monthly voice quota reset completed. Users affected: %', reset_count;
  
  RETURN result;
END;
$function$;