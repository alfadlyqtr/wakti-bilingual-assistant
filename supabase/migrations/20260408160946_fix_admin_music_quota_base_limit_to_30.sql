CREATE OR REPLACE FUNCTION public.admin_get_music_generations_monthly(p_user_id uuid, p_month text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_is_admin boolean;
  v_month_start date := to_date(p_month || '-01', 'YYYY-MM-DD');
  v_next_month_start date := (to_date(p_month || '-01', 'YYYY-MM-DD') + interval '1 month')::date;
  v_generated int := 0;
  v_extra int := 0;
begin
  select public.is_admin() into v_is_admin;
  if not coalesce(v_is_admin, false) then
    raise exception 'Not authorized';
  end if;

  select count(*)::int into v_generated
  from public.user_music_tracks
  where user_id = p_user_id
    and created_at >= v_month_start
    and created_at < v_next_month_start;

  select coalesce(extra_generations, 0) into v_extra
  from public.user_music_generations_quotas
  where user_id = p_user_id and monthly_date = p_month;

  return jsonb_build_object(
    'generated', coalesce(v_generated, 0),
    'extra_generations', coalesce(v_extra, 0),
    'base_limit', 30,
    'total_limit', 30 + coalesce(v_extra, 0)
  );
end;
$function$;
