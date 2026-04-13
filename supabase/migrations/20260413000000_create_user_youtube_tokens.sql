-- Create table to securely store YouTube OAuth tokens per user
CREATE TABLE IF NOT EXISTS public.user_youtube_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token    TEXT NOT NULL,
  refresh_token   TEXT,
  expires_at      TIMESTAMPTZ,
  channel_id      TEXT,
  channel_title   TEXT,
  channel_thumbnail TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- RLS: only the owning user can read their own row
ALTER TABLE public.user_youtube_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own youtube tokens"
  ON public.user_youtube_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE from frontend — only edge functions (service role) write here
-- updated_at auto-refresh
CREATE OR REPLACE FUNCTION public.set_updated_at_youtube_tokens()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_youtube_tokens_updated_at
  BEFORE UPDATE ON public.user_youtube_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_youtube_tokens();
