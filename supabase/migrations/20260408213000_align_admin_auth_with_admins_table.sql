insert into public.admins (user_id, role)
select u.id, 'super_admin'
from auth.users u
where lower(coalesce(u.email, '')) in ('admin@tmw.qa', 'alfadly@me.com', 'alfadlyqatar@gmail.com')
on conflict (user_id) do update set role = excluded.role;

create or replace function public.get_admin_by_auth_id(auth_user_id uuid)
returns table(admin_id uuid, email text, full_name text, role text, permissions jsonb, is_active boolean)
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
begin
  return query
    select
      u.id::uuid as admin_id,
      u.email::text as email,
      coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), split_part(coalesce(u.email, ''), '@', 1))::text as full_name,
      coalesce(a.role, 'admin')::text as role,
      '{}'::jsonb as permissions,
      true::boolean as is_active
    from auth.users u
    join public.admins a on a.user_id = u.id
    where u.id = auth_user_id
    limit 1;
end
$$;
