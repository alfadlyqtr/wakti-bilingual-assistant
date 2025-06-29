
-- Update admin gift voice credits function to queue notifications
CREATE OR REPLACE FUNCTION public.admin_gift_voice_credits(p_user_id uuid, p_characters integer, p_admin_id uuid)
RETURNS TABLE(success boolean, new_extra_characters integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  current_extras INTEGER;
BEGIN
  -- Ensure user voice quota exists
  PERFORM public.get_or_create_user_voice_quota(p_user_id);
  
  -- Add extra voice characters
  UPDATE public.user_voice_usage
  SET 
    extra_characters = extra_characters + p_characters,
    purchase_date = now(),
    updated_at = now()
  WHERE user_id = p_user_id
  RETURNING extra_characters INTO current_extras;
  
  -- Log the admin gift in audit logs
  INSERT INTO public.audit_logs (
    action, table_name, record_id, user_id, details
  ) VALUES (
    'admin_gift', 'user_voice_usage', p_user_id::text, p_admin_id,
    jsonb_build_object(
      'gifted_to_user', p_user_id,
      'characters_gifted', p_characters,
      'type', 'voice_credits',
      'admin_action', true
    )
  );
  
  -- Queue notification for the user
  PERFORM public.queue_notification(
    p_user_id,
    'admin_gifts',
    '🎁 Gift from Wakti Admin Team!',
    format('You have received %s voice characters as a gift from the Wakti Admin Team. Enjoy your extra credits!', p_characters),
    jsonb_build_object(
      'gift_type', 'voice_credits',
      'amount', p_characters,
      'new_balance', current_extras,
      'sender', 'Wakti Admin Team'
    ),
    '/wakti-ai',
    now()
  );
  
  RETURN QUERY SELECT TRUE, current_extras;
END;
$function$;

-- Update admin gift translation credits function to queue notifications
CREATE OR REPLACE FUNCTION public.admin_gift_translation_credits(p_user_id uuid, p_translations integer, p_admin_id uuid)
RETURNS TABLE(success boolean, new_extra_translations integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  current_month TEXT := to_char(now(), 'YYYY-MM');
  current_extras INTEGER;
BEGIN
  -- Ensure user voice translation quota exists
  PERFORM public.get_or_create_voice_translation_quota(p_user_id);
  
  -- Add extra translations
  UPDATE public.user_voice_translation_quotas
  SET 
    extra_translations = extra_translations + p_translations,
    purchase_date = now(),
    updated_at = now()
  WHERE user_id = p_user_id AND monthly_date = current_month
  RETURNING extra_translations INTO current_extras;
  
  -- Log the admin gift in audit logs
  INSERT INTO public.audit_logs (
    action, table_name, record_id, user_id, details
  ) VALUES (
    'admin_gift', 'user_voice_translation_quotas', p_user_id::text, p_admin_id,
    jsonb_build_object(
      'gifted_to_user', p_user_id,
      'translations_gifted', p_translations,
      'type', 'translation_credits',
      'admin_action', true
    )
  );
  
  -- Queue notification for the user
  PERFORM public.queue_notification(
    p_user_id,
    'admin_gifts',
    '🎁 Gift from Wakti Admin Team!',
    format('You have received %s translation credits as a gift from the Wakti Admin Team. Enjoy your extra credits!', p_translations),
    jsonb_build_object(
      'gift_type', 'translation_credits',
      'amount', p_translations,
      'new_balance', current_extras,
      'sender', 'Wakti Admin Team'
    ),
    '/wakti-ai',
    now()
  );
  
  RETURN QUERY SELECT TRUE, current_extras;
END;
$function$;
