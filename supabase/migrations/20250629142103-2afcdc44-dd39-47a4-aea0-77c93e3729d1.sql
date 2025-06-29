
-- Fix the get_or_create_voice_translation_quota function to resolve column ambiguity
CREATE OR REPLACE FUNCTION public.get_or_create_voice_translation_quota(p_user_id uuid)
RETURNS TABLE(translation_count integer, extra_translations integer, purchase_date timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  current_month TEXT := to_char(now(), 'YYYY-MM');
  quota_record RECORD;
BEGIN
  -- Try to get current month's quota
  SELECT uvtq.translation_count, uvtq.extra_translations, uvtq.purchase_date
  INTO quota_record
  FROM public.user_voice_translation_quotas uvtq
  WHERE uvtq.user_id = p_user_id AND uvtq.monthly_date = current_month;
  
  -- If no record exists for this month, create one
  IF NOT FOUND THEN
    -- Get the latest extra_translations from previous records
    SELECT uvtq.extra_translations, uvtq.purchase_date
    INTO quota_record
    FROM public.user_voice_translation_quotas uvtq
    WHERE uvtq.user_id = p_user_id
    ORDER BY uvtq.monthly_date DESC
    LIMIT 1;
    
    -- Create new record for current month with explicit column references
    INSERT INTO public.user_voice_translation_quotas (
      user_id, 
      translation_count, 
      monthly_date, 
      extra_translations, 
      purchase_date
    )
    VALUES (
      p_user_id,
      0, -- Start with 0 translations used
      current_month,
      COALESCE(quota_record.extra_translations, 0),
      quota_record.purchase_date
    )
    RETURNING 
      user_voice_translation_quotas.translation_count, 
      user_voice_translation_quotas.extra_translations, 
      user_voice_translation_quotas.purchase_date
    INTO quota_record;
  END IF;
  
  -- Check if extra translations have expired (30 days)
  IF quota_record.purchase_date IS NOT NULL AND 
     quota_record.purchase_date < (now() - INTERVAL '30 days') THEN
    -- Reset expired extras
    UPDATE public.user_voice_translation_quotas
    SET extra_translations = 0, purchase_date = NULL, updated_at = now()
    WHERE user_id = p_user_id AND monthly_date = current_month;
    
    quota_record.extra_translations := 0;
    quota_record.purchase_date := NULL;
  END IF;
  
  RETURN QUERY SELECT quota_record.translation_count, quota_record.extra_translations, quota_record.purchase_date;
END;
$function$;
