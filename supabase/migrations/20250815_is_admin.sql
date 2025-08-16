-- Admins table
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text default 'admin',
  created_at timestamptz not null default now()
);

-- Enable RLS (not required for is_admin(), but good hygiene)
alter table public.admins enable row level security;

-- Optional policies (not strictly needed for is_admin, which is security definer)
-- Example: allow an admin to read their own row
create policy if not exists admins_select_self on public.admins
  for select using (auth.uid() = user_id);

-- is_admin() function
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.admins a
    where a.user_id = auth.uid()
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- Seed first admin (replace UUID before running or run manually)
-- insert into public.admins (user_id, role) values ('00000000-0000-0000-0000-000000000000', 'super_admin') on conflict do nothing;
