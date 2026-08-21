-- ============================================================================
-- RECONSTRUCTION MIGRATION (documentation / fresh-environment rebuild)
-- These music tables were originally created by hand in the Supabase dashboard,
-- so fresh environments (or local supabase start) could not reproduce them.
-- This file mirrors the LIVE production schema exactly, captured 2026-08-21.
-- Everything is idempotent (IF NOT EXISTS / guarded DO blocks) so running it
-- against production is a harmless no-op.
-- NOTE: production user_music_tracks currently carries a duplicate set of
-- equivalent permissive owner policies ("Users * own music rows" AND
-- "owner_*_user_music_tracks"). This file intentionally creates ONE clean set.
-- ============================================================================

-- ── user_music_tracks ────────────────────────────────────────────────────────
create table if not exists public.user_music_tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  prompt text,
  include_styles text[] default '{}',
  exclude_styles text[] default '{}',
  requested_duration_seconds integer,
  provider text default 'kie',
  model text,
  storage_path text,
  signed_url text,
  mime text,
  meta jsonb default '{}'::jsonb,
  task_id text,
  title text,
  cover_url text,
  duration double precision,
  variant_index integer default 0,
  source_audio_url text,
  share_code text not null unique default ('wk'::text || lower(substr(md5((gen_random_uuid())::text || (clock_timestamp())::text), 1, 8))),
  is_public boolean not null default false
);

create index if not exists idx_user_music_tracks_user_id on public.user_music_tracks (user_id);
create index if not exists idx_user_music_tracks_task_id on public.user_music_tracks (task_id);

alter table public.user_music_tracks enable row level security;

drop policy if exists "Users select own music rows" on public.user_music_tracks;
create policy "Users select own music rows" on public.user_music_tracks
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users insert own music rows" on public.user_music_tracks;
create policy "Users insert own music rows" on public.user_music_tracks
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users update own music rows" on public.user_music_tracks;
create policy "Users update own music rows" on public.user_music_tracks
  for update to authenticated using (auth.uid() = user_id);
drop policy if exists "Users delete own music rows" on public.user_music_tracks;
create policy "Users delete own music rows" on public.user_music_tracks
  for delete to authenticated using (auth.uid() = user_id);
drop policy if exists "Public can read public music shares" on public.user_music_tracks;
create policy "Public can read public music shares" on public.user_music_tracks
  for select to anon, authenticated using (is_public = true);

-- ── user_music_generation_log (monthly quota counter source) ────────────────
create table if not exists public.user_music_generation_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_music_gen_log_user_month on public.user_music_generation_log (user_id, created_at);

alter table public.user_music_generation_log enable row level security;

drop policy if exists "Users can view own generation log" on public.user_music_generation_log;
create policy "Users can view own generation log" on public.user_music_generation_log
  for select using (auth.uid() = user_id);
drop policy if exists "Service role can insert generation log" on public.user_music_generation_log;
create policy "Service role can insert generation log" on public.user_music_generation_log
  for insert with check (true);

-- ── user_music_generations_quotas (admin-gifted extra generations) ───────────
create table if not exists public.user_music_generations_quotas (
  user_id uuid not null references auth.users(id) on delete cascade,
  monthly_date text not null,
  extra_generations integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, monthly_date)
);

alter table public.user_music_generations_quotas enable row level security;

drop policy if exists "user_music_generations_quotas_owner_select" on public.user_music_generations_quotas;
create policy "user_music_generations_quotas_owner_select" on public.user_music_generations_quotas
  for select to authenticated using (user_id = auth.uid());

-- ── user_music_minutes_quotas (reserved for future minutes gifting) ──────────
create table if not exists public.user_music_minutes_quotas (
  user_id uuid not null references auth.users(id) on delete cascade,
  monthly_date text not null,
  extra_minutes integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, monthly_date)
);

alter table public.user_music_minutes_quotas enable row level security;

drop policy if exists "user_music_minutes_quotas_owner_select" on public.user_music_minutes_quotas;
create policy "user_music_minutes_quotas_owner_select" on public.user_music_minutes_quotas
  for select to authenticated using (user_id = auth.uid());

-- ── user_music_quota (legacy chars-based quota, currently unused) ────────────
create table if not exists public.user_music_quota (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  chars_used integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, period_start)
);

alter table public.user_music_quota enable row level security;

drop policy if exists "select_own_music_quota" on public.user_music_quota;
create policy "select_own_music_quota" on public.user_music_quota
  for select using (auth.uid() = user_id);
drop policy if exists "insert_own_music_quota" on public.user_music_quota;
create policy "insert_own_music_quota" on public.user_music_quota
  for insert with check (auth.uid() = user_id);
drop policy if exists "update_own_music_quota" on public.user_music_quota;
create policy "update_own_music_quota" on public.user_music_quota
  for update using (auth.uid() = user_id);

-- ── user_music_playlists ─────────────────────────────────────────────────────
create table if not exists public.user_music_playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  track_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_music_playlists_user_id on public.user_music_playlists (user_id);

alter table public.user_music_playlists enable row level security;

drop policy if exists "Users can manage their own playlists" on public.user_music_playlists;
create policy "Users can manage their own playlists" on public.user_music_playlists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── music_track_shares (share a track to a mutual contact) ───────────────────
create table if not exists public.music_track_shares (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  source_track_id uuid not null references public.user_music_tracks(id) on delete cascade,
  status text not null default 'pending',
  note text,
  sender_snapshot jsonb not null default '{}'::jsonb,
  track_snapshot jsonb not null default '{}'::jsonb,
  accepted_track_id uuid,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists idx_music_track_shares_sender_created on public.music_track_shares (sender_id, created_at desc);
create index if not exists idx_music_track_shares_recipient_pending on public.music_track_shares (recipient_id, status, created_at desc);
create index if not exists idx_music_track_shares_source_track_id on public.music_track_shares (source_track_id);
create index if not exists idx_music_track_shares_accepted_track_id on public.music_track_shares (accepted_track_id);

alter table public.music_track_shares enable row level security;

drop policy if exists "Users can view their music track shares" on public.music_track_shares;
create policy "Users can view their music track shares" on public.music_track_shares
  for select to authenticated using (auth.uid() = sender_id or auth.uid() = recipient_id);
drop policy if exists "Users can create music track shares to mutual contacts" on public.music_track_shares;
create policy "Users can create music track shares to mutual contacts" on public.music_track_shares
  for insert to authenticated with check (
    auth.uid() = sender_id
    and sender_id <> recipient_id
    and exists (
      select 1 from public.user_music_tracks t
      where t.id = music_track_shares.source_track_id and t.user_id = auth.uid()
    )
    and exists (
      select 1 from public.contacts c1
      where c1.user_id = music_track_shares.sender_id
        and c1.contact_id = music_track_shares.recipient_id
        and c1.status = 'approved'
    )
    and exists (
      select 1 from public.contacts c2
      where c2.user_id = music_track_shares.recipient_id
        and c2.contact_id = music_track_shares.sender_id
        and c2.status = 'approved'
    )
  );
