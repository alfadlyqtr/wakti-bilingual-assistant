-- Parking lot for RevenueCat webhook events that could not be matched to a user
-- (e.g. offer-code purchases made under anonymous RC IDs before account creation)

create table if not exists public.pending_rc_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text,
  app_user_id text,
  rc_customer_id text,
  store text,
  product_id text,
  price numeric,
  currency text,
  purchased_at timestamptz,
  expiration_at timestamptz,
  transaction_id text,
  raw_payload jsonb,
  status text not null default 'pending',
  matched_user_id uuid,
  notes text
);

alter table public.pending_rc_events enable row level security;

create index if not exists pending_rc_events_status_idx on public.pending_rc_events (status);
create index if not exists pending_rc_events_app_user_id_idx on public.pending_rc_events (app_user_id);
