ALTER TABLE public.user_music_tracks
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

UPDATE public.user_music_tracks
SET is_public = false
WHERE is_public IS DISTINCT FROM false;

DROP POLICY IF EXISTS "Allow public read for music sharing" ON public.user_music_tracks;

CREATE POLICY "Public can read public music shares"
ON public.user_music_tracks
FOR SELECT
TO anon, authenticated
USING (is_public = true);
