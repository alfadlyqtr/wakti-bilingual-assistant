-- Moves project-share creation server-side so we can enforce, before any
-- row is written, that the RECIPIENT actually has an open project slot
-- (max 3). The sender gets a specific error instead of a silently created
-- share the recipient can never accept.
create or replace function public.send_project_share(
  p_recipient_id uuid,
  p_project_id uuid,
  p_note text default null
)
returns public.project_shares
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_profile record;
  v_recipient_count int;
  v_share public.project_shares%rowtype;
begin
  if v_sender_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_sender_id = p_recipient_id then
    raise exception 'Cannot share a project with yourself';
  end if;

  select *
  into v_project
  from public.projects
  where id = p_project_id
    and user_id = v_sender_id;

  if not found then
    raise exception 'Project not found';
  end if;

  if not exists (
    select 1 from public.contacts c1
    where c1.user_id = v_sender_id
      and c1.contact_id = p_recipient_id
      and c1.status = 'approved'
  ) or not exists (
    select 1 from public.contacts c2
    where c2.user_id = p_recipient_id
      and c2.contact_id = v_sender_id
      and c2.status = 'approved'
  ) then
    raise exception 'You must both be in each other''s contacts';
  end if;

  -- Block up front if the recipient has no open project slot.
  select count(*) into v_recipient_count
  from public.projects
  where user_id = p_recipient_id;

  if v_recipient_count >= 3 then
    raise exception 'RECIPIENT_PROJECT_LIMIT_REACHED';
  end if;

  select display_name, username, avatar_url
  into v_profile
  from public.profiles
  where id = v_sender_id;

  insert into public.project_shares (
    sender_id,
    recipient_id,
    source_project_id,
    note,
    sender_snapshot,
    project_snapshot
  ) values (
    v_sender_id,
    p_recipient_id,
    p_project_id,
    nullif(trim(p_note), ''),
    jsonb_build_object(
      'display_name', v_profile.display_name,
      'username', v_profile.username,
      'avatar_url', v_profile.avatar_url
    ),
    jsonb_build_object(
      'name', v_project.name,
      'description', v_project.description,
      'thumbnail_url', v_project.thumbnail_url
    )
  )
  returning * into v_share;

  return v_share;
end;
$$;
