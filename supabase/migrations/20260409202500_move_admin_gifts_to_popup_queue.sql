create table if not exists public.admin_gift_popups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gift_type text not null,
  amount integer not null check (amount > 0),
  sender text not null default 'Wakti team',
  title text,
  body text,
  month text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  seen_at timestamptz
);

alter table public.admin_gift_popups enable row level security;

alter table public.admin_gift_popups replica identity full;

alter publication supabase_realtime add table public.admin_gift_popups;

create policy "Users can view their own admin gift popups"
on public.admin_gift_popups
for select
using (auth.uid() = user_id);

create policy "Users can update their own admin gift popups"
on public.admin_gift_popups
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

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
    insert into public.admin_gift_popups (user_id, gift_type, amount, sender, title, body, month, meta)
    values (
      p_user_id,
      'voice_characters_monthly',
      p_delta,
      'Wakti team',
      'A little gift from Wakti',
      format('You received %s voice characters. Compliments of the Wakti team. Enjoy.', p_delta),
      p_month,
      jsonb_build_object(
        'new_balance', v_row.extra_characters,
        'reason', coalesce(p_reason, '')
      )
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
    insert into public.admin_gift_popups (user_id, gift_type, amount, sender, title, body, month, meta)
    values (
      p_user_id,
      'music_generations',
      p_delta,
      'Wakti team',
      'A little gift from Wakti',
      format('You received %s music generations. Compliments of the Wakti team. Enjoy.', p_delta),
      p_month,
      jsonb_build_object(
        'new_balance', v_row.extra_generations,
        'reason', coalesce(p_reason, '')
      )
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

update public.notification_history
set push_sent = true,
    push_sent_at = coalesce(push_sent_at, now()),
    is_read = true
where type = 'admin_gifts'
  and coalesce(push_sent, false) = false;
