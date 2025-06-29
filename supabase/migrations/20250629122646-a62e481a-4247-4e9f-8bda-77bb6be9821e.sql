
-- Drop the unused user_translation_quotas table
DROP TABLE IF EXISTS public.user_translation_quotas CASCADE;

-- Create PayPal webhook processing functions for voice credits and translation credits
CREATE OR REPLACE FUNCTION public.process_voice_credits_purchase(p_user_id uuid, p_transaction_id text, p_amount numeric)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.process_translation_credits_purchase(p_user_id uuid, p_transaction_id text, p_amount numeric)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  current_month TEXT := to_char(now(), 'YYYY-MM');
  credits_to_add INTEGER := 100; -- 100 translations for 10 QAR
BEGIN
  -- Ensure user voice translation quota exists
  PERFORM public.get_or_create_voice_translation_quota(p_user_id);
  
  -- Add extra translations
  UPDATE public.user_voice_translation_quotas
  SET 
    extra_translations = extra_translations + credits_to_add,
    purchase_date = now(),
    updated_at = now()
  WHERE user_id = p_user_id AND monthly_date = current_month;
  
  -- Log the purchase
  INSERT INTO public.audit_logs (
    action, table_name, record_id, user_id, details
  ) VALUES (
    'purchase', 'user_voice_translation_quotas', p_user_id::text, p_user_id,
    jsonb_build_object(
      'transaction_id', p_transaction_id,
      'amount', p_amount,
      'credits_added', credits_to_add,
      'type', 'translation_credits'
    )
  );
  
  RETURN true;
END;
$function$;
