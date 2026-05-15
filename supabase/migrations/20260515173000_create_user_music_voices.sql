create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.user_music_voices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  voice_type text not null check (voice_type in ('male', 'female', 'custom')),
  accent_note text not null default '',
  source_kind text not null check (source_kind in ('record', 'upload')),
  clip_label text not null default '',
  source_storage_path text,
  source_audio_url text,
  source_duration_seconds integer,
  validate_task_id text,
  validate_phrase text,
  validate_language text,
  verify_storage_path text,
  verify_audio_url text,
  generation_task_id text,
  kie_voice_id text,
  status text not null default 'phrase_pending' check (status in ('local_only', 'phrase_pending', 'phrase_ready', 'voice_pending', 'ready', 'failed')),
  status_detail text,
  error_message text,
  is_available boolean not null default false,
  availability_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_music_voices_user_id on public.user_music_voices(user_id);
create index if not exists idx_user_music_voices_status on public.user_music_voices(status);
create unique index if not exists idx_user_music_voices_validate_task_id on public.user_music_voices(validate_task_id) where validate_task_id is not null;
create unique index if not exists idx_user_music_voices_generation_task_id on public.user_music_voices(generation_task_id) where generation_task_id is not null;
create index if not exists idx_user_music_voices_kie_voice_id on public.user_music_voices(kie_voice_id) where kie_voice_id is not null;

alter table public.user_music_voices enable row level security;

drop policy if exists "Users can view own music voices" on public.user_music_voices;
create policy "Users can view own music voices"
on public.user_music_voices
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can create own music voices" on public.user_music_voices;
create policy "Users can create own music voices"
on public.user_music_voices
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own music voices" on public.user_music_voices;
create policy "Users can update own music voices"
on public.user_music_voices
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own music voices" on public.user_music_voices;
create policy "Users can delete own music voices"
on public.user_music_voices
for delete
to authenticated
using (user_id = auth.uid());

drop trigger if exists set_updated_at_on_user_music_voices on public.user_music_voices;
create trigger set_updated_at_on_user_music_voices
before update on public.user_music_voices
for each row
execute function public.set_updated_at_timestamp();
