-- Fixes accept_project_share: the copy previously got a blank backend
-- shell (hardcoded features, force-enabled) with NONE of the actual
-- content/structure data. Sites that render dynamic content via
-- project_collections (menu items, products, portfolio pieces, etc.)
-- showed up empty on the recipient's copy because that data was never
-- duplicated under the new project_id.
--
-- Still NEVER copied (real customer/business data stays with the sender
-- only): project_form_submissions, project_site_users, project_carts,
-- project_orders, project_bookings, project_chat_rooms, project_comments,
-- project_notifications.
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

  insert into public.project_files (project_id, path, content)
  select
    v_new_project_id,
    path,
    replace(content, v_share.source_project_id::text, v_new_project_id::text)
  from public.project_files
  where project_id = v_share.source_project_id;

  -- Mirror the source's actual backend enable state + features (not
  -- hardcoded). allowed_origins resets to empty since the copy has no
  -- subdomain of its own yet.
  insert into public.project_backends (project_id, user_id, enabled, enabled_at, features, allowed_origins)
  select
    v_new_project_id,
    auth.uid(),
    b.enabled,
    case when b.enabled then now() else null end,
    b.features,
    '{}'::text[]
  from public.project_backends b
  where b.project_id = v_share.source_project_id
  on conflict (project_id) do nothing;

  -- Copy CONTENT/STRUCTURE only (e.g. menu items, products, portfolio
  -- pieces) so the copy actually renders the same as the source.
  -- collection_item ids are remapped so inventory stays linked correctly.
  with mapping as (
    select
      id as old_id,
      gen_random_uuid() as new_id,
      collection_name,
      data,
      status,
      sort_order
    from public.project_collections
    where project_id = v_share.source_project_id
  ),
  ins_collections as (
    insert into public.project_collections (id, project_id, user_id, collection_name, data, status, sort_order)
    select new_id, v_new_project_id, auth.uid(), collection_name, data, status, sort_order
    from mapping
    returning id
  )
  insert into public.project_inventory (project_id, collection_name, collection_item_id, stock_quantity, low_stock_threshold, track_inventory)
  select
    v_new_project_id,
    m.collection_name,
    m.new_id,
    inv.stock_quantity,
    inv.low_stock_threshold,
    inv.track_inventory
  from mapping m
  join public.project_inventory inv
    on inv.project_id = v_share.source_project_id
    and inv.collection_item_id = m.old_id;

  insert into public.project_collection_schemas (project_id, user_id, collection_name, schema, display_name, icon)
  select v_new_project_id, auth.uid(), collection_name, schema, display_name, icon
  from public.project_collection_schemas
  where project_id = v_share.source_project_id;

  update public.project_shares
  set status = 'accepted',
      responded_at = now(),
      accepted_project_id = v_new_project_id
  where id = p_share_id;

  return v_new_project_id;
end;
$$;
