
-- Create function for admins to gift voice credits to users
CREATE OR REPLACE FUNCTION public.admin_gift_voice_credits(
  p_user_id uuid,
  p_characters integer,
  p_admin_id uuid
)
RETURNS TABLE(new_extra_characters integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_extras INTEGER;
BEGIN
  -- Ensure user voice usage record exists
  INSERT INTO public.user_voice_usage (
    user_id,
    characters_used,
    characters_limit,
    extra_characters
  )
  VALUES (
    p_user_id,
    0,
    5000,
    0
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Add extra characters
  UPDATE public.user_voice_usage
  SET 
    extra_characters = extra_characters + p_characters,
    purchase_date = now(),
    updated_at = now()
  WHERE user_id = p_user_id
  RETURNING extra_characters INTO current_extras;

  -- Log the admin action
  INSERT INTO public.admin_activity_logs (
    admin_user_id,
    action,
    target_type,
    target_id,
    details
  ) VALUES (
    p_admin_id,
    'gift_voice_credits',
    'user',
    p_user_id::text,
    jsonb_build_object(
      'characters_gifted', p_characters,
      'new_extra_total', current_extras
    )
  );

  RETURN QUERY SELECT current_extras;
END;
$$;
