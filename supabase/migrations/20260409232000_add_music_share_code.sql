ALTER TABLE public.user_music_tracks
  ADD COLUMN IF NOT EXISTS share_code text;

UPDATE public.user_music_tracks
SET share_code = lower(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 10))
WHERE share_code IS NULL OR share_code = '';

ALTER TABLE public.user_music_tracks
  ALTER COLUMN share_code SET DEFAULT lower(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 10));

ALTER TABLE public.user_music_tracks
  ALTER COLUMN share_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_music_tracks_share_code_key
  ON public.user_music_tracks (share_code);

COMMENT ON COLUMN public.user_music_tracks.share_code IS 'Public short share code for music track links.';
