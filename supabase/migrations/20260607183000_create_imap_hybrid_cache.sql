create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.email_connections
  add column if not exists preferred_imap_login text,
  add column if not exists preferred_sent_folder text,
  add column if not exists last_mail_sync_at timestamptz;

create table if not exists public.imap_mailbox_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.email_connections(id) on delete cascade,
  folder text not null,
  real_folder text not null default '',
  mailbox_login text,
  total_messages integer not null default 0,
  cached_page integer not null default 1,
  page_size integer not null default 20,
  has_more boolean not null default false,
  unread_count integer not null default 0,
  messages jsonb not null default '[]'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, folder)
);

create index if not exists idx_imap_mailbox_cache_user_id on public.imap_mailbox_cache(user_id);
create index if not exists idx_imap_mailbox_cache_connection_folder on public.imap_mailbox_cache(connection_id, folder);
create index if not exists idx_imap_mailbox_cache_updated_at on public.imap_mailbox_cache(updated_at desc);

create table if not exists public.imap_message_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.email_connections(id) on delete cascade,
  folder text not null,
  uid bigint not null,
  subject text not null default '',
  sender text not null default '',
  recipient text not null default '',
  sent_at text not null default '',
  snippet text not null default '',
  body_text text not null default '',
  body_html text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  synced_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, folder, uid)
);

create index if not exists idx_imap_message_cache_user_id on public.imap_message_cache(user_id);
create index if not exists idx_imap_message_cache_connection_folder_uid on public.imap_message_cache(connection_id, folder, uid);
create index if not exists idx_imap_message_cache_expires_at on public.imap_message_cache(expires_at);

alter table public.imap_mailbox_cache enable row level security;
alter table public.imap_message_cache enable row level security;

create policy "Users can view their own imap mailbox cache"
on public.imap_mailbox_cache
for select
using (auth.uid() = user_id);

create policy "Users can view their own imap message cache"
on public.imap_message_cache
for select
using (auth.uid() = user_id);

drop trigger if exists set_updated_at_on_imap_mailbox_cache on public.imap_mailbox_cache;
create trigger set_updated_at_on_imap_mailbox_cache
before update on public.imap_mailbox_cache
for each row
execute function public.set_updated_at_timestamp();

drop trigger if exists set_updated_at_on_imap_message_cache on public.imap_message_cache;
create trigger set_updated_at_on_imap_message_cache
before update on public.imap_message_cache
for each row
execute function public.set_updated_at_timestamp();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'imap_mailbox_cache'
  ) then
    alter publication supabase_realtime add table public.imap_mailbox_cache;
  end if;
end $$;
