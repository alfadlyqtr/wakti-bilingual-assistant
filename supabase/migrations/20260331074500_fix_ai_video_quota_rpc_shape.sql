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
  v_monthly_limit integer := 80;
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

DROP FUNCTION IF EXISTS public.increment_ai_video_usage(uuid);

CREATE FUNCTION public.increment_ai_video_usage(p_user_id uuid DEFAULT NULL)
RETURNS TABLE(
  success boolean,
  videos_generated integer,
  extra_videos integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_user_id uuid;
  v_videos_generated integer := 0;
  v_extra_videos integer := 0;
  current_month text := to_char(now(), 'YYYY-MM');
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;

  INSERT INTO public.user_ai_video_quotas (user_id, videos_generated, extra_videos, monthly_date)
  VALUES (v_user_id, 1, 0, current_month)
  ON CONFLICT (user_id, monthly_date) DO UPDATE
  SET
    videos_generated = CASE
      WHEN user_ai_video_quotas.monthly_date != current_month THEN 1
      ELSE user_ai_video_quotas.videos_generated + 1
    END,
    monthly_date = current_month,
    updated_at = now();

  SELECT
    uavq.videos_generated,
    uavq.extra_videos
  INTO
    v_videos_generated,
    v_extra_videos
  FROM public.user_ai_video_quotas uavq
  WHERE uavq.user_id = v_user_id;

  RETURN QUERY SELECT true, COALESCE(v_videos_generated, 0), COALESCE(v_extra_videos, 0);
END;
$function$;
