create or replace function public.admin_adjust_voice_characters(p_user_id uuid, p_month text, p_delta integer, p_reason text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_is_admin boolean;
  v_admin_id uuid;
  v_row public.user_voice_characters_quotas;
  v_new_extra integer;
begin
  select public.is_admin() into v_is_admin;
  if not coalesce(v_is_admin, false) then
    raise exception 'Not authorized';
  end if;

  select au.id into v_admin_id
  from public.admin_users au
  where au.auth_user_id = auth.uid()
    and coalesce(au.is_active, true) = true
  limit 1;

  if v_admin_id is null then
    raise exception 'Admin not found for current session';
  end if;

  v_row := public.ensure_user_voice_characters_quota(p_user_id, p_month);
  v_new_extra := greatest(v_row.extra_characters + p_delta, 0);

  update public.user_voice_characters_quotas
  set extra_characters = v_new_extra,
      updated_at = now()
  where user_id = p_user_id and monthly_date = p_month
  returning * into v_row;

  insert into public.admin_quota_gift_events(user_id, admin_id, feature, delta, reason)
  values (p_user_id, v_admin_id, 'voice_characters_monthly', p_delta, coalesce(p_reason, ''));

  if p_delta > 0 then
    insert into public.notification_history (user_id, type, title, body, data, deep_link, is_read, push_sent, created_at)
    values (
      p_user_id,
      'admin_gifts',
      'A little gift from Wakti',
      format('You received %s voice characters. Compliments of the Wakti team. Enjoy.', p_delta),
      jsonb_build_object(
        'gift_type', 'voice_characters_monthly',
        'amount', p_delta,
        'month', p_month,
        'new_balance', v_row.extra_characters,
        'sender', 'Wakti team'
      ),
      '/account',
      false,
      false,
      now()
    );
  end if;

  return jsonb_build_object(
    'user_id', p_user_id,
    'month', p_month,
    'extra_characters', v_row.extra_characters
  );
end;
$function$;

create or replace function public.admin_adjust_music_generations(p_user_id uuid, p_month text, p_delta integer, p_reason text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_is_admin boolean;
  v_admin_id uuid;
  v_row public.user_music_generations_quotas;
  v_new_extra integer;
  v_result jsonb;
begin
  select public.is_admin() into v_is_admin;
  if not coalesce(v_is_admin, false) then
    raise exception 'Not authorized';
  end if;

  select au.id into v_admin_id
  from public.admin_users au
  where au.auth_user_id = auth.uid()
    and coalesce(au.is_active, true) = true
  limit 1;

  if v_admin_id is null then
    raise exception 'Admin not found for current session';
  end if;

  v_row := public.ensure_user_music_generations_quota(p_user_id, p_month);
  v_new_extra := greatest(v_row.extra_generations + p_delta, 0);

  update public.user_music_generations_quotas
  set extra_generations = v_new_extra,
      updated_at = now()
  where user_id = p_user_id and monthly_date = p_month
  returning * into v_row;

  insert into public.admin_quota_gift_events(user_id, admin_id, feature, delta, reason)
  values (p_user_id, v_admin_id, 'music_generations', p_delta, coalesce(p_reason, ''));

  if p_delta > 0 then
    insert into public.notification_history (user_id, type, title, body, data, deep_link, is_read, push_sent, created_at)
    values (
      p_user_id,
      'admin_gifts',
      'A little gift from Wakti',
      format('You received %s music generations. Compliments of the Wakti team. Enjoy.', p_delta),
      jsonb_build_object(
        'gift_type', 'music_generations',
        'amount', p_delta,
        'month', p_month,
        'new_balance', v_row.extra_generations,
        'sender', 'Wakti team'
      ),
      '/music',
      false,
      false,
      now()
    );
  end if;

  v_result := jsonb_build_object(
    'user_id', p_user_id,
    'month', p_month,
    'delta', p_delta,
    'extra_generations', v_row.extra_generations
  );

  return v_result;
end;
$function$;
