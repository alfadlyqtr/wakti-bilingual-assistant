-- Table for Poster & Captions (KIE mp4 generated branded visuals)
create table if not exists public.user_music_posters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id uuid not null references public.user_music_tracks(id) on delete cascade,
  kie_task_id text not null,
  kie_audio_id text not null,
  kie_poster_task_id text,
  author text,
  status text not null default 'generating',
  video_url text,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.user_music_posters enable row level security;

create policy "Users can manage their own posters"
  on public.user_music_posters
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_user_music_posters_user_id on public.user_music_posters(user_id);
create index if not exists idx_user_music_posters_track_id on public.user_music_posters(track_id);
