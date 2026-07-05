create table if not exists public.project_shares (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  source_project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  note text null,
  sender_snapshot jsonb not null default '{}'::jsonb,
  project_snapshot jsonb not null default '{}'::jsonb,
  accepted_project_id uuid null references public.projects(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz null,
  constraint project_shares_no_self_share check (sender_id <> recipient_id)
);

create index if not exists project_shares_recipient_status_idx on public.project_shares (recipient_id, status, created_at);
create index if not exists project_shares_sender_idx on public.project_shares (sender_id, created_at desc);

alter table public.project_shares enable row level security;
alter table public.project_shares replica identity full;

drop policy if exists "Users can create project shares to mutual contacts" on public.project_shares;
create policy "Users can create project shares to mutual contacts"
on public.project_shares
for insert
with check (
  auth.uid() = sender_id
  and sender_id <> recipient_id
  and exists (
    select 1
    from public.projects p
    where p.id = project_shares.source_project_id
      and p.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.contacts c1
    where c1.user_id = project_shares.sender_id
      and c1.contact_id = project_shares.recipient_id
      and c1.status = 'approved'
  )
  and exists (
    select 1
    from public.contacts c2
    where c2.user_id = project_shares.recipient_id
      and c2.contact_id = project_shares.sender_id
      and c2.status = 'approved'
  )
);

drop policy if exists "Users can view their project shares" on public.project_shares;
create policy "Users can view their project shares"
on public.project_shares
for select
using (
  auth.uid() = sender_id
  or auth.uid() = recipient_id
);

-- ============================================================================
-- accept_project_share
-- Copies the sender's project (row + files) into a brand-new project owned
-- by the recipient. Sender keeps their original untouched.
--
-- Guarantees enforced here (server-side, cannot be bypassed by the client):
--   1) Recipient must have an open project slot (max 3 projects).
--   2) The new copy is completely disconnected from GitHub (no repo/branch).
--   3) Any project-backend-api calls baked into the copied files are
--      rewritten to point at the NEW project's id, not the sender's.
-- ============================================================================
create or replace function public.accept_project_share(p_share_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share public.project_shares%rowtype;
  v_source public.projects%rowtype;
  v_new_project_id uuid;
  v_new_slug text;
  v_project_count int;
begin
  select *
  into v_share
  from public.project_shares
  where id = p_share_id
  for update;

  if not found then
    raise exception 'Share request not found';
  end if;

  if v_share.recipient_id <> auth.uid() then
    raise exception 'Not allowed';
  end if;

  if v_share.status = 'accepted' and v_share.accepted_project_id is not null then
    return v_share.accepted_project_id;
  end if;

  if v_share.status <> 'pending' then
    raise exception 'Share request is no longer pending';
  end if;

  if not exists (
    select 1 from public.contacts c1
    where c1.user_id = v_share.sender_id
      and c1.contact_id = v_share.recipient_id
      and c1.status = 'approved'
  ) or not exists (
    select 1 from public.contacts c2
    where c2.user_id = v_share.recipient_id
      and c2.contact_id = v_share.sender_id
      and c2.status = 'approved'
  ) then
    raise exception 'You must both be in each other''s contacts';
  end if;

  -- Guarantee #1: recipient must have an open slot (max 3 projects)
  select count(*) into v_project_count
  from public.projects
  where user_id = auth.uid();

  if v_project_count >= 3 then
    raise exception 'PROJECT_LIMIT_REACHED';
  end if;

  select *
  into v_source
  from public.projects
  where id = v_share.source_project_id
    and user_id = v_share.sender_id;

  if not found then
    raise exception 'Source project not found';
  end if;

  v_new_slug := lower(regexp_replace(regexp_replace(v_source.name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
                || '-' || to_char(extract(epoch from now())::bigint, 'FM99999999999');

  -- Guarantee #2: new copy starts as a private draft, fully disconnected
  -- from GitHub/custom domain/live deployment.
  insert into public.projects (
    user_id,
    name,
    slug,
    description,
    template_type,
    status,
    published_url,
    deployment_id,
    published_at,
    require_login,
    thumbnail_url,
    subdomain,
    bundled_code,
    github_repo,
    github_branch,
    custom_domain
  ) values (
    auth.uid(),
    v_source.name,
    v_new_slug,
    v_source.description,
    v_source.template_type,
    'draft',
    null,
    null,
    null,
    coalesce(v_source.require_login, false),
    v_source.thumbnail_url,
    null,
    v_source.bundled_code,
    null,
    null,
    null
  ) returning id into v_new_project_id;

  -- Guarantee #3: copy files, rewriting any occurrence of the sender's
  -- project id (baked into backend_api calls) to the new project's id.
  insert into public.project_files (project_id, path, content)
  select
    v_new_project_id,
    path,
    replace(content, v_share.source_project_id::text, v_new_project_id::text)
  from public.project_files
  where project_id = v_share.source_project_id;

  -- Fresh backend connection for the copy (no business data carried over).
  insert into public.project_backends (project_id, user_id, enabled, enabled_at, features)
  values (v_new_project_id, auth.uid(), true, now(), '{"forms": true}'::jsonb)
  on conflict (project_id) do nothing;

  update public.project_shares
  set status = 'accepted',
      responded_at = now(),
      accepted_project_id = v_new_project_id
  where id = p_share_id;

  return v_new_project_id;
end;
$$;

create or replace function public.decline_project_share(p_share_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share public.project_shares%rowtype;
begin
  select *
  into v_share
  from public.project_shares
  where id = p_share_id
  for update;

  if not found then
    raise exception 'Share request not found';
  end if;

  if v_share.recipient_id <> auth.uid() then
    raise exception 'Not allowed';
  end if;

  if v_share.status <> 'pending' then
    return;
  end if;

  update public.project_shares
  set status = 'declined',
      responded_at = now()
  where id = p_share_id;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'project_shares'
  ) then
    alter publication supabase_realtime add table public.project_shares;
  end if;
end
$$;
