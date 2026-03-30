-- Raise monthly AI video limit from 60 to 80
-- Updates the can_generate_ai_video function and existing quota rows

-- 1. Redefine can_generate_ai_video to use 80 as the monthly limit
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
  -- Resolve user id
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 0, v_monthly_limit, 0;
    RETURN;
  END IF;

  -- Get or create quota row
  INSERT INTO public.user_ai_video_quotas (user_id, videos_generated, extra_videos, monthly_date)
  VALUES (v_user_id, 0, 0, current_month)
  ON CONFLICT (user_id) DO NOTHING;

  -- Read current quota
  SELECT
    uavq.videos_generated,
    uavq.extra_videos,
    uavq.monthly_date
  INTO
    v_videos_generated,
    v_extra_videos
  FROM public.user_ai_video_quotas uavq
  WHERE uavq.user_id = v_user_id;

  -- Reset if new month
  IF (SELECT monthly_date FROM public.user_ai_video_quotas WHERE user_id = v_user_id) != current_month THEN
    UPDATE public.user_ai_video_quotas
    SET videos_generated = 0, monthly_date = current_month, updated_at = now()
    WHERE user_id = v_user_id;
    v_videos_generated := 0;
  END IF;

  RETURN QUERY SELECT
    (v_videos_generated < v_monthly_limit + v_extra_videos),
    v_videos_generated,
    v_monthly_limit,
    v_extra_videos;
END;
$function$;

-- 2. Also redefine get_or_create_user_ai_video_quota to return 80
CREATE OR REPLACE FUNCTION public.get_or_create_user_ai_video_quota(p_user_id uuid)
RETURNS TABLE(
  out_user_id uuid,
  out_videos_generated integer,
  out_extra_videos integer,
  out_monthly_date text,
  out_updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  current_month text := to_char(now(), 'YYYY-MM');
BEGIN
  -- Upsert quota row
  INSERT INTO public.user_ai_video_quotas (user_id, videos_generated, extra_videos, monthly_date)
  VALUES (p_user_id, 0, 0, current_month)
  ON CONFLICT (user_id) DO NOTHING;

  -- Reset if new month
  UPDATE public.user_ai_video_quotas
  SET videos_generated = 0, monthly_date = current_month, updated_at = now()
  WHERE user_id = p_user_id
    AND monthly_date != current_month;

  RETURN QUERY
  SELECT user_id, videos_generated, extra_videos, monthly_date, updated_at
  FROM public.user_ai_video_quotas
  WHERE user_id = p_user_id;
END;
$function$;

-- 3. Redefine increment_ai_video_usage to stay consistent
CREATE OR REPLACE FUNCTION public.increment_ai_video_usage(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  current_month text := to_char(now(), 'YYYY-MM');
BEGIN
  INSERT INTO public.user_ai_video_quotas (user_id, videos_generated, extra_videos, monthly_date)
  VALUES (p_user_id, 1, 0, current_month)
  ON CONFLICT (user_id) DO UPDATE
  SET
    videos_generated = CASE
      WHEN user_ai_video_quotas.monthly_date != current_month THEN 1
      ELSE user_ai_video_quotas.videos_generated + 1
    END,
    monthly_date = current_month,
    updated_at = now();
END;
$function$;
