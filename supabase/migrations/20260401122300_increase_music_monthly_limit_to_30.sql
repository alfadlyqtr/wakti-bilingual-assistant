CREATE OR REPLACE FUNCTION public.can_generate_music()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_month text := to_char(now(), 'YYYY-MM');
  v_month_start date := date_trunc('month', now())::date;
  v_next_month_start date := (date_trunc('month', now()) + interval '1 month')::date;
  v_generated int := 0;
  v_extra int := 0;
  v_limit int := 30;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select count(*)::int into v_generated
  from (
    select coalesce(task_id, id::text) as generation_key
    from public.user_music_tracks
    where user_id = v_user_id
      and created_at >= v_month_start
      and created_at < v_next_month_start
      and (meta->>'status' is null or meta->>'status' = 'completed')
    group by coalesce(task_id, id::text)
  ) counted_generations;

  select coalesce(extra_generations, 0) into v_extra
  from public.user_music_generations_quotas
  where user_id = v_user_id and monthly_date = v_month;

  v_extra := coalesce(v_extra, 0);

  return jsonb_build_object(
    'can_generate', v_generated < (v_limit + v_extra),
    'generated', v_generated,
    'limit', v_limit + v_extra,
    'remaining', greatest(0, (v_limit + v_extra) - v_generated)
  );
end;
$function$;
