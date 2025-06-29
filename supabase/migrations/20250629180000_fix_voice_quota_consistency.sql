
-- Fix voice quota consistency - set default to 5000 characters
CREATE OR REPLACE FUNCTION public.get_or_create_user_voice_quota(p_user_id uuid)
RETURNS TABLE(characters_used integer, characters_limit integer, extra_characters integer, purchase_date timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  quota_record RECORD;
BEGIN
  -- Try to get existing voice usage record
  SELECT uvu.characters_used, uvu.characters_limit, uvu.extra_characters, uvu.purchase_date
  INTO quota_record
  FROM public.user_voice_usage uvu
  WHERE uvu.user_id = p_user_id;
  
  -- If no record exists, create one with 5000 character limit
  IF NOT FOUND THEN
    INSERT INTO public.user_voice_usage (
      user_id, 
      characters_used, 
      characters_limit,
      extra_characters
    )
    VALUES (
      p_user_id,
      0,
      5000, -- Fixed: Use consistent 5000 characters
      0
    )
    RETURNING characters_used, characters_limit, extra_characters, purchase_date
    INTO quota_record;
  ELSE
    -- Update existing records that might have old 3000 limit
    IF quota_record.characters_limit < 5000 THEN
      UPDATE public.user_voice_usage
      SET characters_limit = 5000, updated_at = now()
      WHERE user_id = p_user_id;
      quota_record.characters_limit := 5000;
    END IF;
  END IF;
  
  -- Check if extra characters have expired (30 days)
  IF quota_record.purchase_date IS NOT NULL AND 
     quota_record.purchase_date < (now() - INTERVAL '30 days') THEN
    -- Reset expired extras
    UPDATE public.user_voice_usage
    SET extra_characters = 0, purchase_date = NULL, updated_at = now()
    WHERE user_id = p_user_id;
    
    quota_record.extra_characters := 0;
    quota_record.purchase_date := NULL;
  END IF;
  
  RETURN QUERY SELECT quota_record.characters_used, quota_record.characters_limit, quota_record.extra_characters, quota_record.purchase_date;
END;
$$;

-- Fix translation quota to use consistent 10 daily limit
CREATE OR REPLACE FUNCTION public.get_or_create_user_quota(p_user_id uuid)
RETURNS TABLE(daily_count integer, extra_translations integer, purchase_date timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today_date DATE := CURRENT_DATE;
  quota_record RECORD;
BEGIN
  -- Try to get today's quota
  SELECT uq.daily_count, uq.extra_translations, uq.purchase_date
  INTO quota_record
  FROM public.user_translation_quotas uq
  WHERE uq.user_id = p_user_id AND uq.daily_date = today_date;
  
  -- If no record exists for today, create one
  IF NOT FOUND THEN
    -- Get the latest extra_translations from previous records
    SELECT uq.extra_translations, uq.purchase_date
    INTO quota_record
    FROM public.user_translation_quotas uq
    WHERE uq.user_id = p_user_id
    ORDER BY uq.daily_date DESC
    LIMIT 1;
    
    -- Create new record for today
    INSERT INTO public.user_translation_quotas (
      user_id, 
      daily_count, 
      daily_date, 
      extra_translations, 
      purchase_date
    )
    VALUES (
      p_user_id,
      0,
      today_date,
      COALESCE(quota_record.extra_translations, 0),
      quota_record.purchase_date
    )
    RETURNING user_translation_quotas.daily_count, user_translation_quotas.extra_translations, user_translation_quotas.purchase_date
    INTO quota_record;
  END IF;
  
  -- Check if extra translations have expired (30 days)
  IF quota_record.purchase_date IS NOT NULL AND 
     quota_record.purchase_date < (now() - INTERVAL '30 days') THEN
    -- Reset expired extras
    UPDATE public.user_translation_quotas
    SET extra_translations = 0, purchase_date = NULL, updated_at = now()
    WHERE user_id = p_user_id AND daily_date = today_date;
    
    quota_record.extra_translations := 0;
    quota_record.purchase_date := NULL;
  END IF;
  
  RETURN QUERY SELECT quota_record.daily_count, quota_record.extra_translations, quota_record.purchase_date;
END;
$$;

-- Add PayPal webhook processing functions
CREATE OR REPLACE FUNCTION public.process_voice_credits_purchase(p_user_id uuid, p_transaction_id text, p_amount numeric)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  credits_to_add INTEGER := 5000; -- 5000 characters for 10 QAR
BEGIN
  -- Ensure user voice quota exists
  PERFORM public.get_or_create_user_voice_quota(p_user_id);
  
  -- Add extra voice characters
  UPDATE public.user_voice_usage
  SET 
    extra_characters = extra_characters + credits_to_add,
    purchase_date = now(),
    updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Log the purchase
  INSERT INTO public.audit_logs (
    action, table_name, record_id, user_id, details
  ) VALUES (
    'purchase', 'user_voice_usage', p_user_id::text, p_user_id,
    jsonb_build_object(
      'transaction_id', p_transaction_id,
      'amount', p_amount,
      'credits_added', credits_to_add,
      'type', 'voice_credits'
    )
  );
  
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_translation_credits_purchase(p_user_id uuid, p_transaction_id text, p_amount numeric)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today_date DATE := CURRENT_DATE;
  credits_to_add INTEGER := 100; -- 100 translations for 10 QAR
BEGIN
  -- Ensure user translation quota exists
  PERFORM public.get_or_create_user_quota(p_user_id);
  
  -- Add extra translations
  UPDATE public.user_translation_quotas
  SET 
    extra_translations = extra_translations + credits_to_add,
    purchase_date = now(),
    updated_at = now()
  WHERE user_id = p_user_id AND daily_date = today_date;
  
  -- Log the purchase
  INSERT INTO public.audit_logs (
    action, table_name, record_id, user_id, details
  ) VALUES (
    'purchase', 'user_translation_quotas', p_user_id::text, p_user_id,
    jsonb_build_object(
      'transaction_id', p_transaction_id,
      'amount', p_amount,
      'credits_added', credits_to_add,
      'type', 'translation_credits'
    )
  );
  
  RETURN true;
END;
$$;
