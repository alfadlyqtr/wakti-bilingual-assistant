create table if not exists public.image_shares (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  source_image_id uuid not null references public.user_generated_images(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  note text null,
  sender_snapshot jsonb not null default '{}'::jsonb,
  image_snapshot jsonb not null default '{}'::jsonb,
  accepted_image_id uuid null references public.user_generated_images(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz null,
  constraint image_shares_no_self_share check (sender_id <> recipient_id)
);

create index if not exists image_shares_recipient_status_idx on public.image_shares (recipient_id, status, created_at);
create index if not exists image_shares_sender_idx on public.image_shares (sender_id, created_at desc);

alter table public.image_shares enable row level security;
alter table public.image_shares replica identity full;

drop policy if exists "Users can create image shares to mutual contacts" on public.image_shares;
create policy "Users can create image shares to mutual contacts"
on public.image_shares
for insert
with check (
  auth.uid() = sender_id
  and sender_id <> recipient_id
  and exists (
    select 1
    from public.user_generated_images i
    where i.id = image_shares.source_image_id
      and i.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.contacts c1
    where c1.user_id = image_shares.sender_id
      and c1.contact_id = image_shares.recipient_id
      and c1.status = 'approved'
  )
  and exists (
    select 1
    from public.contacts c2
    where c2.user_id = image_shares.recipient_id
      and c2.contact_id = image_shares.sender_id
      and c2.status = 'approved'
  )
);

drop policy if exists "Users can view their image shares" on public.image_shares;
create policy "Users can view their image shares"
on public.image_shares
for select
using (
  auth.uid() = sender_id
  or auth.uid() = recipient_id
);

create or replace function public.accept_image_share(p_share_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share public.image_shares%rowtype;
  v_source public.user_generated_images%rowtype;
  v_existing_image_id uuid;
  v_new_image_id uuid;
begin
  select *
  into v_share
  from public.image_shares
  where id = p_share_id
  for update;

  if not found then
    raise exception 'Share request not found';
  end if;

  if v_share.recipient_id <> auth.uid() then
    raise exception 'Not allowed';
  end if;

  if v_share.status = 'accepted' and v_share.accepted_image_id is not null then
    return v_share.accepted_image_id;
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

  select *
  into v_source
  from public.user_generated_images
  where id = v_share.source_image_id
    and user_id = v_share.sender_id;

  if not found then
    raise exception 'Source image not found';
  end if;

  select i.id
  into v_existing_image_id
  from public.user_generated_images i
  where i.user_id = auth.uid()
    and coalesce(i.meta->>'shared_share_id', '') = p_share_id::text
  limit 1;

  if v_existing_image_id is not null then
    update public.image_shares
    set status = 'accepted',
        responded_at = coalesce(responded_at, now()),
        accepted_image_id = v_existing_image_id
    where id = p_share_id;

    return v_existing_image_id;
  end if;

  insert into public.user_generated_images (
    user_id,
    image_url,
    prompt,
    submode,
    quality,
    meta,
    visibility,
    is_profile_visible,
    is_public
  ) values (
    auth.uid(),
    v_source.image_url,
    v_source.prompt,
    v_source.submode,
    v_source.quality,
    coalesce(v_source.meta, '{}'::jsonb) || jsonb_build_object(
      'shared_received', true,
      'shared_share_id', p_share_id,
      'shared_from_user_id', v_share.sender_id,
      'shared_at', now()
    ),
    'private',
    false,
    false
  ) returning id into v_new_image_id;

  update public.image_shares
  set status = 'accepted',
      responded_at = now(),
      accepted_image_id = v_new_image_id
  where id = p_share_id;

  return v_new_image_id;
end;
$$;

create or replace function public.decline_image_share(p_share_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share public.image_shares%rowtype;
begin
  select *
  into v_share
  from public.image_shares
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

  update public.image_shares
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
      and tablename = 'image_shares'
  ) then
    alter publication supabase_realtime add table public.image_shares;
  end if;
end
$$;
