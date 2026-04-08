CREATE OR REPLACE FUNCTION public.admin_adjust_music_generations(p_user_id uuid, p_month text, p_delta integer, p_reason text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_is_admin boolean;
  v_row public.user_music_generations_quotas;
  v_new_extra integer;
  v_result jsonb;
begin
  select public.is_admin() into v_is_admin;
  if not coalesce(v_is_admin, false) then
    raise exception 'Not authorized';
  end if;

  v_row := public.ensure_user_music_generations_quota(p_user_id, p_month);
  v_new_extra := greatest(v_row.extra_generations + p_delta, 0);

  update public.user_music_generations_quotas
  set extra_generations = v_new_extra,
      updated_at = now()
  where user_id = p_user_id and monthly_date = p_month
  returning * into v_row;

  insert into public.admin_quota_gift_events(user_id, admin_id, feature, delta, reason)
  values (p_user_id, auth.uid(), 'music_generations', p_delta, coalesce(p_reason, ''));

  v_result := jsonb_build_object(
    'user_id', p_user_id,
    'month', p_month,
    'delta', p_delta,
    'extra_generations', v_row.extra_generations
  );

  return v_result;
end;
$function$;
