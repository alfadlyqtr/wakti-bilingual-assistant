create or replace function public.admin_list_audience_groups()
returns table(
  id uuid,
  name text,
  description text,
  audience_type text,
  target_user_ids uuid[],
  target_countries text[],
  target_languages text[],
  audience_filter jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  usage_count bigint
)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Not authorized';
  end if;

  return query
  select g.id,
         g.name,
         g.description,
         g.audience_type,
         g.target_user_ids,
         g.target_countries,
         g.target_languages,
         g.audience_filter,
         g.created_at,
         g.updated_at,
         count(a.id)::bigint as usage_count
  from public.announcement_audience_groups g
  left join public.announcements a on a.target_group_id = g.id
  group by g.id
  order by g.updated_at desc, g.created_at desc;
end;
$$;

create or replace function public.admin_upsert_audience_group(p_payload jsonb, p_id uuid default null)
returns public.announcement_audience_groups
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row public.announcement_audience_groups;
  v_type text := coalesce(nullif(p_payload->>'audience_type', ''), 'all');
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Not authorized';
  end if;

  if v_type = 'saved_group' then
    raise exception 'Audience groups cannot reference another saved group';
  end if;

  if p_id is null then
    insert into public.announcement_audience_groups (
      name,
      description,
      audience_type,
      target_user_ids,
      target_countries,
      target_languages,
      audience_filter,
      created_by
    ) values (
      nullif(trim(p_payload->>'name'), ''),
      nullif(trim(p_payload->>'description'), ''),
      v_type,
      coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p_payload->'target_user_ids', '[]'::jsonb)) x), '{}'::uuid[]),
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_payload->'target_countries', '[]'::jsonb)) x), '{}'::text[]),
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_payload->'target_languages', '[]'::jsonb)) x), '{}'::text[]),
      coalesce(p_payload->'audience_filter', '{}'::jsonb),
      auth.uid()
    )
    returning * into v_row;
  else
    update public.announcement_audience_groups
    set name = coalesce(nullif(trim(p_payload->>'name'), ''), name),
        description = case when p_payload ? 'description' then nullif(trim(p_payload->>'description'), '') else description end,
        audience_type = v_type,
        target_user_ids = case
          when p_payload ? 'target_user_ids' then coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p_payload->'target_user_ids', '[]'::jsonb)) x), '{}'::uuid[])
          else target_user_ids
        end,
        target_countries = case
          when p_payload ? 'target_countries' then coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_payload->'target_countries', '[]'::jsonb)) x), '{}'::text[])
          else target_countries
        end,
        target_languages = case
          when p_payload ? 'target_languages' then coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_payload->'target_languages', '[]'::jsonb)) x), '{}'::text[])
          else target_languages
        end,
        audience_filter = coalesce(p_payload->'audience_filter', audience_filter),
        updated_at = now()
    where id = p_id
    returning * into v_row;
  end if;

  if v_row.id is null then
    raise exception 'Audience group not found';
  end if;

  return v_row;
end;
$$;

create or replace function public.admin_delete_audience_group(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Not authorized';
  end if;

  if exists (select 1 from public.announcements where target_group_id = p_id) then
    raise exception 'This audience group is still used by one or more announcements';
  end if;

  delete from public.announcement_audience_groups where id = p_id;
end;
$$;

create or replace function public.admin_preview_announcement_audience(p_payload jsonb)
returns table(total_count bigint, sample_users jsonb, audience_source text, group_name text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_type text := coalesce(nullif(p_payload->>'audience_type', ''), 'all');
  v_group_id uuid := nullif(p_payload->>'target_group_id', '')::uuid;
  v_group public.announcement_audience_groups;
  v_users uuid[] := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p_payload->'target_user_ids', '[]'::jsonb)) x), '{}'::uuid[]);
  v_countries text[] := coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_payload->'target_countries', '[]'::jsonb)) x), '{}'::text[]);
  v_languages text[] := coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_payload->'target_languages', '[]'::jsonb)) x), '{}'::text[]);
  v_filter jsonb := coalesce(p_payload->'audience_filter', '{}'::jsonb);
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Not authorized';
  end if;

  if v_type = 'saved_group' then
    if v_group_id is null then
      return query select 0::bigint, '[]'::jsonb, 'group'::text, null::text;
      return;
    end if;

    select * into v_group from public.announcement_audience_groups where id = v_group_id;
    if v_group.id is null then
      raise exception 'Audience group not found';
    end if;

    v_type := v_group.audience_type;
    v_users := v_group.target_user_ids;
    v_countries := v_group.target_countries;
    v_languages := v_group.target_languages;
    v_filter := v_group.audience_filter;
  end if;

  return query
  with matched as (
    select p.id, p.email, p.display_name
    from public.profiles p
    where public.announcement_user_matches_filters(v_type, v_users, v_countries, v_languages, v_filter, p.id)
  ),
  sampled as (
    select jsonb_agg(jsonb_build_object('id', m.id, 'email', m.email, 'display_name', m.display_name) order by m.email nulls last, m.display_name nulls last) as payload
    from (
      select * from matched order by email nulls last, display_name nulls last limit 8
    ) m
  )
  select (select count(*)::bigint from matched),
         coalesce((select payload from sampled), '[]'::jsonb),
         case when v_group.id is null then 'direct' else 'group' end,
         v_group.name;
end;
$$;

create or replace function public.admin_explain_announcement_user(
  p_payload jsonb,
  p_user_id uuid,
  p_announcement_id uuid default null,
  p_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_profile public.profiles;
  v_existing public.announcements;
  v_group public.announcement_audience_groups;
  v_status text := coalesce(nullif(p_payload->>'status', ''), 'live');
  v_key text;
  v_type text := coalesce(nullif(p_payload->>'audience_type', ''), 'all');
  v_group_id uuid := nullif(p_payload->>'target_group_id', '')::uuid;
  v_users uuid[] := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p_payload->'target_user_ids', '[]'::jsonb)) x), '{}'::uuid[]);
  v_countries text[] := coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_payload->'target_countries', '[]'::jsonb)) x), '{}'::text[]);
  v_languages text[] := coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_payload->'target_languages', '[]'::jsonb)) x), '{}'::text[]);
  v_filter jsonb := coalesce(p_payload->'audience_filter', '{}'::jsonb);
  v_include text[] := coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_payload->'include_routes', '[]'::jsonb)) x), '{}'::text[]);
  v_exclude text[] := coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_payload->'exclude_routes', '[]'::jsonb)) x), '{}'::text[]);
  v_frequency text := coalesce(nullif(p_payload->>'frequency', ''), 'show_once');
  v_max_shows integer := greatest(coalesce(nullif(p_payload->>'max_shows', '')::int, 1), 1);
  v_starts_at timestamptz := nullif(p_payload->>'starts_at', '')::timestamptz;
  v_ends_at timestamptz := nullif(p_payload->>'ends_at', '')::timestamptz;
  v_event public.user_announcement_events;
  v_show public.announcement_show_counts;
  v_test_override boolean := false;
  v_status_ok boolean := true;
  v_schedule_ok boolean := true;
  v_route_ok boolean := true;
  v_audience_ok boolean := false;
  v_frequency_ok boolean := true;
  v_eligible boolean := false;
  v_reasons jsonb := '[]'::jsonb;
  v_now timestamptz := now();
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Not authorized';
  end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if v_profile.id is null then
    return jsonb_build_object(
      'eligible', false,
      'reasons', jsonb_build_array('User profile not found')
    );
  end if;

  if p_announcement_id is not null then
    select * into v_existing from public.announcements where id = p_announcement_id;
    if v_existing.id is not null then
      v_status := coalesce(nullif(p_payload->>'status', ''), v_existing.status);
      v_key := coalesce(nullif(trim(p_payload->>'announcement_key'), ''), v_existing.announcement_key);
      v_type := coalesce(nullif(p_payload->>'audience_type', ''), v_existing.audience_type);
      v_group_id := coalesce(nullif(p_payload->>'target_group_id', '')::uuid, v_existing.target_group_id);
      if not (p_payload ? 'target_user_ids') then v_users := v_existing.target_user_ids; end if;
      if not (p_payload ? 'target_countries') then v_countries := v_existing.target_countries; end if;
      if not (p_payload ? 'target_languages') then v_languages := v_existing.target_languages; end if;
      if not (p_payload ? 'audience_filter') then v_filter := v_existing.audience_filter; end if;
      if not (p_payload ? 'include_routes') then v_include := v_existing.include_routes; end if;
      if not (p_payload ? 'exclude_routes') then v_exclude := v_existing.exclude_routes; end if;
      if not (p_payload ? 'frequency') then v_frequency := v_existing.frequency; end if;
      if not (p_payload ? 'max_shows') then v_max_shows := v_existing.max_shows; end if;
      if not (p_payload ? 'starts_at') then v_starts_at := v_existing.starts_at; end if;
      if not (p_payload ? 'ends_at') then v_ends_at := v_existing.ends_at; end if;
    end if;
  else
    v_key := nullif(trim(p_payload->>'announcement_key'), '');
  end if;

  if v_type = 'saved_group' then
    if v_group_id is null then
      v_reasons := v_reasons || jsonb_build_array('No saved audience group is selected');
    else
      select * into v_group from public.announcement_audience_groups where id = v_group_id;
      if v_group.id is null then
        v_reasons := v_reasons || jsonb_build_array('The selected saved audience group no longer exists');
      else
        v_type := v_group.audience_type;
        v_users := v_group.target_user_ids;
        v_countries := v_group.target_countries;
        v_languages := v_group.target_languages;
        v_filter := v_group.audience_filter;
      end if;
    end if;
  end if;

  if p_announcement_id is not null then
    v_test_override := exists (
      select 1
      from public.announcement_test_recipients tr
      where tr.announcement_id = p_announcement_id
        and tr.user_id = p_user_id
        and tr.consumed_at is null
        and tr.expires_at >= v_now
    );
  end if;

  v_status_ok := v_test_override or v_status = 'live';
  v_schedule_ok := v_test_override or ((v_starts_at is null or v_starts_at <= v_now) and (v_ends_at is null or v_ends_at >= v_now));

  if coalesce(nullif(trim(p_path), ''), '') <> '' then
    v_route_ok := v_test_override or public.announcement_route_matches(p_path, v_include, v_exclude);
  end if;

  v_audience_ok := v_test_override or public.announcement_user_matches_filters(v_type, v_users, v_countries, v_languages, v_filter, p_user_id);

  if v_key is not null then
    select * into v_event
    from public.user_announcement_events
    where user_id = p_user_id and announcement_key = v_key;
  end if;

  if p_announcement_id is not null then
    select * into v_show
    from public.announcement_show_counts
    where user_id = p_user_id and announcement_id = p_announcement_id;
  end if;

  if not v_test_override then
    v_frequency_ok := case
      when v_frequency = 'show_once' then v_event.id is null
      when v_frequency = 'show_until_acted' then v_event.status is null or v_event.status <> 'acted'
      when v_frequency = 'show_n_times' then coalesce(v_show.shown_count, 0) < v_max_shows
      else true
    end;
  end if;

  if v_test_override then
    v_reasons := v_reasons || jsonb_build_array('A test-send override is active for this user');
  end if;

  if not v_status_ok then
    v_reasons := v_reasons || jsonb_build_array('This announcement is not live yet');
  end if;

  if not v_schedule_ok then
    v_reasons := v_reasons || jsonb_build_array('This user is outside the scheduled date window');
  end if;

  if coalesce(nullif(trim(p_path), ''), '') <> '' and not v_route_ok then
    v_reasons := v_reasons || jsonb_build_array('The selected page path does not match the route rules');
  end if;

  if not v_audience_ok and not v_test_override then
    v_reasons := v_reasons || jsonb_build_array(
      case v_type
        when 'specific_users' then 'This user is not in the selected customer list'
        when 'paid' then 'This user is not currently a paid subscriber'
        when 'free' then 'This user is not currently in the free-user segment'
        when 'trial' then 'This user is not currently in the trial segment'
        when 'gifted' then 'This user is not currently in the gifted segment'
        when 'by_country' then 'This user does not match the selected countries'
        when 'by_language' then 'This user does not match the selected languages'
        else 'This user does not match the audience rules'
      end
    );
  end if;

  if not v_frequency_ok then
    v_reasons := v_reasons || jsonb_build_array(
      case v_frequency
        when 'show_once' then 'This user already received this announcement once'
        when 'show_until_acted' then 'This user already acted on this announcement'
        when 'show_n_times' then 'This user already reached the maximum show count'
        else 'This user is blocked by frequency rules'
      end
    );
  end if;

  v_eligible := v_status_ok and v_schedule_ok and v_route_ok and v_audience_ok and v_frequency_ok;

  if v_eligible and jsonb_array_length(v_reasons) = 0 then
    v_reasons := jsonb_build_array('This user is eligible to receive the announcement');
  end if;

  return jsonb_build_object(
    'eligible', v_eligible,
    'status_ok', v_status_ok,
    'schedule_ok', v_schedule_ok,
    'route_ok', case when coalesce(nullif(trim(p_path), ''), '') = '' then null else v_route_ok end,
    'audience_ok', v_audience_ok,
    'frequency_ok', v_frequency_ok,
    'test_override', v_test_override,
    'effective_audience_type', v_type,
    'group', case when v_group.id is null then null else jsonb_build_object('id', v_group.id, 'name', v_group.name) end,
    'event_status', v_event.status,
    'shown_count', coalesce(v_show.shown_count, 0),
    'reasons', v_reasons
  );
end;
$$;

create or replace function public.admin_reset_announcement_for_user(p_announcement_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_key text;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Not authorized';
  end if;

  select announcement_key into v_key from public.announcements where id = p_announcement_id;
  if v_key is null then
    raise exception 'Announcement not found';
  end if;

  delete from public.user_announcement_events
  where user_id = p_user_id and announcement_key = v_key;

  delete from public.announcement_show_counts
  where user_id = p_user_id and announcement_id = p_announcement_id;

  update public.announcement_test_recipients
  set consumed_at = null,
      expires_at = greatest(expires_at, now() + interval '1 day')
  where user_id = p_user_id and announcement_id = p_announcement_id;
end;
$$;

create or replace function public.admin_test_send_announcement(p_announcement_id uuid, p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_target uuid := coalesce(p_user_id, auth.uid());
  v_row public.announcements;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Not authorized';
  end if;

  if v_target is null then
    raise exception 'No target user available';
  end if;

  select * into v_row from public.announcements where id = p_announcement_id;
  if v_row.id is null then
    raise exception 'Announcement not found';
  end if;

  insert into public.announcement_test_recipients (
    announcement_id,
    user_id,
    created_by,
    expires_at,
    consumed_at,
    created_at
  ) values (
    p_announcement_id,
    v_target,
    auth.uid(),
    now() + interval '1 day',
    null,
    now()
  )
  on conflict (announcement_id, user_id) do update
    set created_by = excluded.created_by,
        expires_at = excluded.expires_at,
        consumed_at = null,
        created_at = now();

  delete from public.user_announcement_events
  where user_id = v_target and announcement_key = v_row.announcement_key;

  delete from public.announcement_show_counts
  where user_id = v_target and announcement_id = p_announcement_id;

  return jsonb_build_object(
    'announcement_id', p_announcement_id,
    'user_id', v_target,
    'ok', true
  );
end;
$$;

drop function if exists public.admin_list_announcements();

create or replace function public.admin_list_announcements()
returns table(
  id uuid,
  announcement_key text,
  is_system boolean,
  title_en text,
  title_ar text,
  body_en text,
  body_ar text,
  icon text,
  color text,
  cta_enabled boolean,
  cta_label_en text,
  cta_label_ar text,
  cta_action_type text,
  cta_action_value text,
  display_type text,
  trigger_type text,
  trigger_event_key text,
  delay_seconds integer,
  include_routes text[],
  exclude_routes text[],
  audience_type text,
  target_user_ids uuid[],
  target_countries text[],
  target_languages text[],
  target_group_id uuid,
  audience_filter jsonb,
  frequency text,
  max_shows integer,
  starts_at timestamptz,
  ends_at timestamptz,
  priority text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  total_events bigint,
  seen_count bigint,
  acted_count bigint,
  dismissed_count bigint,
  unique_users bigint
)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Not authorized';
  end if;

  return query
  select a.id,
         a.announcement_key,
         a.is_system,
         a.title_en,
         a.title_ar,
         a.body_en,
         a.body_ar,
         a.icon,
         a.color,
         a.cta_enabled,
         a.cta_label_en,
         a.cta_label_ar,
         a.cta_action_type,
         a.cta_action_value,
         a.display_type,
         a.trigger_type,
         a.trigger_event_key,
         a.delay_seconds,
         a.include_routes,
         a.exclude_routes,
         a.audience_type,
         a.target_user_ids,
         a.target_countries,
         a.target_languages,
         a.target_group_id,
         a.audience_filter,
         a.frequency,
         a.max_shows,
         a.starts_at,
         a.ends_at,
         a.priority,
         a.status,
         a.created_at,
         a.updated_at,
         coalesce(s.total_events, 0) as total_events,
         coalesce(s.seen_count, 0) as seen_count,
         coalesce(s.acted_count, 0) as acted_count,
         coalesce(s.dismissed_count, 0) as dismissed_count,
         coalesce(s.unique_users, 0) as unique_users
  from public.announcements a
  left join (
    select e.announcement_key as ann_key,
           count(*)::bigint as total_events,
           count(*) filter (where e.status = 'seen')::bigint as seen_count,
           count(*) filter (where e.status = 'acted')::bigint as acted_count,
           count(*) filter (where e.status = 'dismissed')::bigint as dismissed_count,
           count(distinct e.user_id)::bigint as unique_users
    from public.user_announcement_events e
    group by e.announcement_key
  ) s on s.ann_key = a.announcement_key
  order by (a.status <> 'live'), a.updated_at desc;
end;
$$;

create or replace function public.admin_upsert_announcement(p_payload jsonb, p_id uuid default null)
returns public.announcements
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row public.announcements;
  v_key text;
  v_caller uuid := auth.uid();
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Not authorized';
  end if;

  v_key := coalesce(nullif(trim(p_payload->>'announcement_key'), ''), null);
  if p_id is null and v_key is null then
    raise exception 'announcement_key is required for new announcements';
  end if;

  if p_id is null then
    insert into public.announcements (
      announcement_key,
      title_en, title_ar, body_en, body_ar, icon, color,
      cta_enabled, cta_label_en, cta_label_ar, cta_action_type, cta_action_value,
      display_type, trigger_type, trigger_event_key, delay_seconds,
      include_routes, exclude_routes,
      audience_type, target_user_ids, target_countries, target_languages, target_group_id, audience_filter,
      frequency, max_shows,
      starts_at, ends_at,
      priority, status,
      created_by
    )
    values (
      v_key,
      p_payload->>'title_en', p_payload->>'title_ar', p_payload->>'body_en', p_payload->>'body_ar',
      p_payload->>'icon', p_payload->>'color',
      coalesce((p_payload->>'cta_enabled')::boolean, false),
      p_payload->>'cta_label_en', p_payload->>'cta_label_ar',
      nullif(p_payload->>'cta_action_type', ''), p_payload->>'cta_action_value',
      coalesce(p_payload->>'display_type', 'popup'),
      coalesce(p_payload->>'trigger_type', 'on_first_login'),
      p_payload->>'trigger_event_key',
      coalesce((p_payload->>'delay_seconds')::int, 0),
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_payload->'include_routes', '[]'::jsonb)) x), '{}'::text[]),
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_payload->'exclude_routes', '[]'::jsonb)) x), '{}'::text[]),
      coalesce(p_payload->>'audience_type', 'all'),
      coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p_payload->'target_user_ids', '[]'::jsonb)) x), '{}'::uuid[]),
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_payload->'target_countries', '[]'::jsonb)) x), '{}'::text[]),
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_payload->'target_languages', '[]'::jsonb)) x), '{}'::text[]),
      nullif(p_payload->>'target_group_id', '')::uuid,
      coalesce(p_payload->'audience_filter', '{}'::jsonb),
      coalesce(p_payload->>'frequency', 'show_once'),
      coalesce((p_payload->>'max_shows')::int, 1),
      nullif(p_payload->>'starts_at', '')::timestamptz,
      nullif(p_payload->>'ends_at', '')::timestamptz,
      coalesce(p_payload->>'priority', 'normal'),
      coalesce(p_payload->>'status', 'draft'),
      v_caller
    )
    returning * into v_row;
  else
    update public.announcements set
      announcement_key = coalesce(v_key, announcement_key),
      title_en = coalesce(p_payload->>'title_en', title_en),
      title_ar = coalesce(p_payload->>'title_ar', title_ar),
      body_en = coalesce(p_payload->>'body_en', body_en),
      body_ar = coalesce(p_payload->>'body_ar', body_ar),
      icon = coalesce(p_payload->>'icon', icon),
      color = coalesce(p_payload->>'color', color),
      cta_enabled = coalesce((p_payload->>'cta_enabled')::boolean, cta_enabled),
      cta_label_en = coalesce(p_payload->>'cta_label_en', cta_label_en),
      cta_label_ar = coalesce(p_payload->>'cta_label_ar', cta_label_ar),
      cta_action_type = coalesce(nullif(p_payload->>'cta_action_type', ''), cta_action_type),
      cta_action_value = coalesce(p_payload->>'cta_action_value', cta_action_value),
      display_type = coalesce(p_payload->>'display_type', display_type),
      trigger_type = coalesce(p_payload->>'trigger_type', trigger_type),
      trigger_event_key = coalesce(p_payload->>'trigger_event_key', trigger_event_key),
      delay_seconds = coalesce((p_payload->>'delay_seconds')::int, delay_seconds),
      include_routes = case
        when p_payload ? 'include_routes' then coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_payload->'include_routes', '[]'::jsonb)) x), '{}'::text[])
        else include_routes
      end,
      exclude_routes = case
        when p_payload ? 'exclude_routes' then coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_payload->'exclude_routes', '[]'::jsonb)) x), '{}'::text[])
        else exclude_routes
      end,
      audience_type = coalesce(p_payload->>'audience_type', audience_type),
      target_user_ids = case
        when p_payload ? 'target_user_ids' then coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p_payload->'target_user_ids', '[]'::jsonb)) x), '{}'::uuid[])
        else target_user_ids
      end,
      target_countries = case
        when p_payload ? 'target_countries' then coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_payload->'target_countries', '[]'::jsonb)) x), '{}'::text[])
        else target_countries
      end,
      target_languages = case
        when p_payload ? 'target_languages' then coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_payload->'target_languages', '[]'::jsonb)) x), '{}'::text[])
        else target_languages
      end,
      target_group_id = case
        when p_payload ? 'target_group_id' then nullif(p_payload->>'target_group_id', '')::uuid
        else target_group_id
      end,
      audience_filter = coalesce(p_payload->'audience_filter', audience_filter),
      frequency = coalesce(p_payload->>'frequency', frequency),
      max_shows = coalesce((p_payload->>'max_shows')::int, max_shows),
      starts_at = case when p_payload ? 'starts_at' then nullif(p_payload->>'starts_at', '')::timestamptz else starts_at end,
      ends_at = case when p_payload ? 'ends_at' then nullif(p_payload->>'ends_at', '')::timestamptz else ends_at end,
      priority = coalesce(p_payload->>'priority', priority),
      status = coalesce(p_payload->>'status', status)
    where id = p_id
    returning * into v_row;

    if v_row.id is null then
      raise exception 'Announcement not found';
    end if;
  end if;

  return v_row;
end;
$$;

create or replace function public.admin_duplicate_announcement(p_id uuid)
returns public.announcements
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_new public.announcements;
  v_caller uuid := auth.uid();
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Not authorized';
  end if;

  insert into public.announcements (
    announcement_key, title_en, title_ar, body_en, body_ar, icon, color,
    cta_enabled, cta_label_en, cta_label_ar, cta_action_type, cta_action_value,
    display_type, trigger_type, trigger_event_key, delay_seconds,
    include_routes, exclude_routes,
    audience_type, target_user_ids, target_countries, target_languages, target_group_id, audience_filter,
    frequency, max_shows, starts_at, ends_at,
    priority, status, is_system, created_by
  )
  select announcement_key || '_copy_' || substr(gen_random_uuid()::text, 1, 6),
         title_en, title_ar, body_en, body_ar, icon, color,
         cta_enabled, cta_label_en, cta_label_ar, cta_action_type, cta_action_value,
         display_type, trigger_type, trigger_event_key, delay_seconds,
         include_routes, exclude_routes,
         audience_type, target_user_ids, target_countries, target_languages, target_group_id, audience_filter,
         frequency, max_shows, starts_at, ends_at,
         priority, 'draft', false, v_caller
  from public.announcements
  where id = p_id
  returning * into v_new;

  if v_new.id is null then
    raise exception 'Announcement not found';
  end if;

  return v_new;
end;
$$;
