-- Session lock table to enforce single active session per user
-- Creates a per-user nonce row that clients upsert on sign-in. Changes are broadcast via Realtime.

create table if not exists public.user_session_locks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nonce text not null,
  updated_at timestamp with time zone not null default now()
);

-- Keep updated_at fresh on updates
create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_on_user_session_locks on public.user_session_locks;
create trigger set_updated_at_on_user_session_locks
before update on public.user_session_locks
for each row
execute function public.set_updated_at_timestamp();

-- RLS: only the authenticated user can read/insert/update their own lock row
alter table public.user_session_locks enable row level security;

create policy "Allow select own lock"
  on public.user_session_locks
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Allow insert own lock"
  on public.user_session_locks
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Allow update own lock"
  on public.user_session_locks
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Enable Realtime on this table
alter publication supabase_realtime add table public.user_session_locks;
