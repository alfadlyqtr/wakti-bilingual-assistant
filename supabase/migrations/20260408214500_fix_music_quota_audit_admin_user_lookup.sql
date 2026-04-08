insert into public.admin_users (
  id,
  email,
  password_hash,
  full_name,
  role,
  permissions,
  is_active,
  auth_user_id
)
select
  coalesce(au.id, gen_random_uuid()) as id,
  u.email::text as email,
  coalesce(au.password_hash, concat('disabled:', gen_random_uuid()::text)) as password_hash,
  coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1))::text as full_name,
  'super_admin'::text as role,
  coalesce(
    au.permissions,
    (
      select au_template.permissions
      from public.admin_users au_template
      where lower(au_template.email) = 'admin@tmw.qa'
      limit 1
    ),
    '{}'::jsonb
  ) as permissions,
  true as is_active,
  u.id as auth_user_id
from auth.users u
left join public.admin_users au on lower(au.email) = lower(u.email)
where lower(coalesce(u.email, '')) in ('admin@tmw.qa', 'alfadly@me.com', 'alfadlyqatar@gmail.com')
on conflict (email) do update
set
  full_name = excluded.full_name,
  role = excluded.role,
  permissions = excluded.permissions,
  is_active = true,
  auth_user_id = excluded.auth_user_id,
  updated_at = now();

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

  v_result := jsonb_build_object(
    'user_id', p_user_id,
    'month', p_month,
    'delta', p_delta,
    'extra_generations', v_row.extra_generations
  );

  return v_result;
end;
$function$;
