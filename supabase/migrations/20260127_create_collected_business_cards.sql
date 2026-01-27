-- Collected (scanned) business cards
create table if not exists public.collected_business_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  share_slug text not null,
  owner_user_id uuid,
  card_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists collected_business_cards_user_share_slug_uq
  on public.collected_business_cards (user_id, share_slug);

create index if not exists collected_business_cards_user_created_at_idx
  on public.collected_business_cards (user_id, created_at desc);

alter table public.collected_business_cards enable row level security;

do $$ begin
  create policy "Collected cards are readable by owner"
    on public.collected_business_cards
    for select
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Collected cards are insertable by owner"
    on public.collected_business_cards
    for insert
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Collected cards are deletable by owner"
    on public.collected_business_cards
    for delete
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
