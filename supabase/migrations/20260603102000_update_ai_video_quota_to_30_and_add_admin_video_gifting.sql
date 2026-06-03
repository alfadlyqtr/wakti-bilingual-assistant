CREATE OR REPLACE FUNCTION public.can_generate_ai_video(p_user_id uuid DEFAULT NULL)
RETURNS TABLE(
  can_generate boolean,
  videos_generated integer,
  videos_limit integer,
  extra_videos integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_user_id uuid;
  v_videos_generated integer := 0;
  v_extra_videos integer := 0;
  v_monthly_limit integer := 30;
  current_month text := to_char(now(), 'YYYY-MM');
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 0, v_monthly_limit, 0;
    RETURN;
  END IF;

  INSERT INTO public.user_ai_video_quotas (user_id, videos_generated, extra_videos, monthly_date)
  VALUES (v_user_id, 0, 0, current_month)
  ON CONFLICT (user_id, monthly_date) DO NOTHING;

  SELECT
    uavq.videos_generated,
    uavq.extra_videos
  INTO
    v_videos_generated,
    v_extra_videos
  FROM public.user_ai_video_quotas uavq
  WHERE uavq.user_id = v_user_id
    AND uavq.monthly_date = current_month;

  RETURN QUERY SELECT
    (COALESCE(v_videos_generated, 0) < v_monthly_limit + COALESCE(v_extra_videos, 0)),
    COALESCE(v_videos_generated, 0),
    v_monthly_limit,
    COALESCE(v_extra_videos, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_get_ai_video_monthly(p_user_id uuid, p_month text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean;
  v_row public.user_ai_video_quotas;
  v_base_limit integer := 30;
BEGIN
  SELECT public.is_admin() INTO v_is_admin;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.user_ai_video_quotas (user_id, videos_generated, extra_videos, monthly_date)
  VALUES (p_user_id, 0, 0, p_month)
  ON CONFLICT (user_id, monthly_date) DO NOTHING;

  SELECT *
  INTO v_row
  FROM public.user_ai_video_quotas
  WHERE user_id = p_user_id
    AND monthly_date = p_month
  LIMIT 1;

  RETURN jsonb_build_object(
    'generated', COALESCE(v_row.videos_generated, 0),
    'extra_videos', COALESCE(v_row.extra_videos, 0),
    'base_limit', v_base_limit,
    'total_limit', v_base_limit + COALESCE(v_row.extra_videos, 0),
    'can_generate', COALESCE(v_row.videos_generated, 0) < v_base_limit + COALESCE(v_row.extra_videos, 0)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_adjust_ai_video_quota(p_user_id uuid, p_month text, p_delta integer, p_reason text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean;
  v_admin_id uuid;
  v_row public.user_ai_video_quotas;
BEGIN
  SELECT public.is_admin() INTO v_is_admin;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT au.id INTO v_admin_id
  FROM public.admin_users au
  WHERE au.auth_user_id = auth.uid()
    AND COALESCE(au.is_active, true) = true
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin not found for current session';
  END IF;

  INSERT INTO public.user_ai_video_quotas (user_id, videos_generated, extra_videos, monthly_date)
  VALUES (p_user_id, 0, 0, p_month)
  ON CONFLICT (user_id, monthly_date) DO NOTHING;

  UPDATE public.user_ai_video_quotas
  SET extra_videos = GREATEST(extra_videos + p_delta, 0),
      updated_at = now()
  WHERE user_id = p_user_id
    AND monthly_date = p_month
  RETURNING * INTO v_row;

  INSERT INTO public.admin_quota_gift_events(user_id, admin_id, feature, delta, reason)
  VALUES (p_user_id, v_admin_id, 'ai_video_monthly', p_delta, COALESCE(p_reason, ''));

  IF p_delta > 0 THEN
    INSERT INTO public.admin_gift_popups (user_id, gift_type, amount, sender, title, body, month, meta)
    VALUES (
      p_user_id,
      'ai_video_monthly',
      p_delta,
      'Wakti team',
      'A little gift from Wakti',
      format('You received %s AI video generations. Compliments of the Wakti team. Enjoy.', p_delta),
      p_month,
      jsonb_build_object(
        'new_balance', COALESCE(v_row.extra_videos, 0),
        'reason', COALESCE(p_reason, '')
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'month', p_month,
    'delta', p_delta,
    'extra_videos', COALESCE(v_row.extra_videos, 0)
  );
END;
$function$;
