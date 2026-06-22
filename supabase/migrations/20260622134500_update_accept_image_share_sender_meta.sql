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
      'shared_at', now(),
      'sender_name', v_share.sender_snapshot->>'display_name',
      'sender_username', v_share.sender_snapshot->>'username',
      'sender_avatar_url', v_share.sender_snapshot->>'avatar_url'
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
