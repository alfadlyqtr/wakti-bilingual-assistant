ALTER TABLE public.user_videos
  ADD COLUMN IF NOT EXISTS youtube_video_id text,
  ADD COLUMN IF NOT EXISTS youtube_video_url text,
  ADD COLUMN IF NOT EXISTS youtube_published_at timestamptz;

ALTER TABLE public.user_music_posters
  ADD COLUMN IF NOT EXISTS youtube_video_id text,
  ADD COLUMN IF NOT EXISTS youtube_video_url text,
  ADD COLUMN IF NOT EXISTS youtube_published_at timestamptz;
