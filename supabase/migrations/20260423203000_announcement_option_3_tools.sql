create or replace function public.announcement_match_pattern(p_path text, p_pattern text)
returns boolean
language sql
immutable
as $$
  select case
    when coalesce(p_pattern, '') = '' then false
    when p_pattern = p_path then true
    when right(p_pattern, 1) = '*' then p_path like left(p_pattern, length(p_pattern) - 1) || '%'
    else p_path = p_pattern
  end;
$$;

create or replace function public.announcement_route_matches(p_path text, p_include text[], p_exclude text[])
returns boolean
language plpgsql
immutable
as $$
declare
  v_path text := coalesce(nullif(trim(p_path), ''), '/');
begin
  if exists (
    select 1
    from unnest(coalesce(p_exclude, '{}'::text[])) as x(pattern)
    where public.announcement_match_pattern(v_path, x.pattern)
  ) then
    return false;
  end if;

  if cardinality(coalesce(p_include, '{}'::text[])) = 0 then
    return true;
  end if;

  return exists (
    select 1
    from unnest(coalesce(p_include, '{}'::text[])) as x(pattern)
    where public.announcement_match_pattern(v_path, x.pattern)
  );
end;
$$;

create or replace function public.announcement_user_matches_filters(
  p_audience_type text,
  p_target_user_ids uuid[],
  p_target_countries text[],
  p_target_languages text[],
  p_audience_filter jsonb,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_profile public.profiles;
  v_lang text;
begin
  if p_user_id is null then
    return false;
  end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if v_profile.id is null then
    return false;
  end if;

  v_lang := lower(coalesce(v_profile.language, 'en'));

  return (
    p_audience_type = 'all'
    or (p_audience_type = 'paid' and coalesce(v_profile.is_subscribed, false) = true and coalesce(v_profile.admin_gifted, false) = false)
    or (p_audience_type = 'gifted' and coalesce(v_profile.admin_gifted, false) = true)
    or (p_audience_type = 'free' and coalesce(v_profile.is_subscribed, false) = false and coalesce(v_profile.admin_gifted, false) = false and v_profile.free_access_start_at is null)
    or (p_audience_type = 'trial' and v_profile.free_access_start_at is not null and coalesce(v_profile.is_subscribed, false) = false)
    or (p_audience_type = 'specific_users' and p_user_id = any(coalesce(p_target_user_ids, '{}'::uuid[])))
    or (
      p_audience_type = 'by_country'
      and exists (
        select 1
        from unnest(coalesce(p_target_countries, '{}'::text[])) as c(code)
        where upper(c.code) in (
          upper(coalesce(v_profile.country_code, '')),
          upper(coalesce(v_profile.country, ''))
        )
      )
    )
    or (
      p_audience_type = 'by_language'
      and exists (
        select 1
        from unnest(coalesce(p_target_languages, '{}'::text[])) as l(lang)
        where lower(l.lang) = v_lang
      )
    )
    or (p_audience_type = 'custom' and true)
  );
end;
$$;

create table if not exists public.announcement_audience_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  audience_type text not null,
  target_user_ids uuid[] not null default '{}'::uuid[],
  target_countries text[] not null default '{}'::text[],
  target_languages text[] not null default '{}'::text[],
  audience_filter jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcement_audience_groups_type_check check (audience_type in ('all', 'paid', 'free', 'gifted', 'trial', 'specific_users', 'by_country', 'by_language', 'custom'))
);

create index if not exists idx_announcement_audience_groups_created_at on public.announcement_audience_groups(created_at desc);

alter table public.announcement_audience_groups enable row level security;

drop policy if exists "Admins manage announcement audience groups" on public.announcement_audience_groups;
create policy "Admins manage announcement audience groups"
on public.announcement_audience_groups
for all
using (coalesce(public.is_admin(), false))
with check (coalesce(public.is_admin(), false));

alter table public.announcements
add column if not exists target_group_id uuid references public.announcement_audience_groups(id) on delete restrict;

create index if not exists idx_announcements_target_group_id on public.announcements(target_group_id);

alter table public.announcements drop constraint if exists announcements_audience_type_check;
alter table public.announcements
add constraint announcements_audience_type_check
check (
  audience_type = any (
    array['all'::text, 'paid'::text, 'free'::text, 'gifted'::text, 'trial'::text, 'specific_users'::text, 'by_country'::text, 'by_language'::text, 'custom'::text, 'saved_group'::text]
  )
);

create table if not exists public.announcement_test_recipients (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid,
  expires_at timestamptz not null default (now() + interval '1 day'),
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (announcement_id, user_id)
);

create index if not exists idx_announcement_test_recipients_lookup on public.announcement_test_recipients(user_id, announcement_id, expires_at);

alter table public.announcement_test_recipients enable row level security;

drop policy if exists "Admins manage announcement test recipients" on public.announcement_test_recipients;
create policy "Admins manage announcement test recipients"
on public.announcement_test_recipients
for all
using (coalesce(public.is_admin(), false))
with check (coalesce(public.is_admin(), false));
