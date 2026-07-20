create table if not exists public.email_send_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('imap', 'gmail')),
  send_id text not null,
  connection_id uuid references public.email_connections(id) on delete set null,
  transport_message_id text,
  message_id text,
  thread_id text,
  mailbox_login text,
  sent_folder text,
  saved_to_sent boolean not null default false,
  subject text not null default '',
  to_recipients text[] not null default '{}',
  cc_recipients text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider, send_id)
);

create index if not exists idx_email_send_receipts_user_provider_sent_at
  on public.email_send_receipts(user_id, provider, sent_at desc);

create index if not exists idx_email_send_receipts_connection_sent_at
  on public.email_send_receipts(connection_id, sent_at desc)
  where connection_id is not null;

alter table public.email_send_receipts enable row level security;

create policy "Users can read own email send receipts"
  on public.email_send_receipts
  for select
  to authenticated
  using (auth.uid() = user_id);
