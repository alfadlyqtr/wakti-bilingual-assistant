UPDATE public.user_music_tracks
SET share_code = 'wk' || lower(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 8))
WHERE share_code IS NULL OR share_code = '' OR share_code !~ '^wk[a-z0-9]{8}$';

ALTER TABLE public.user_music_tracks
  ALTER COLUMN share_code SET DEFAULT 'wk' || lower(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 8));

COMMENT ON COLUMN public.user_music_tracks.share_code IS 'Public branded short share code for music track links, format wkxxxxxxxx.';
