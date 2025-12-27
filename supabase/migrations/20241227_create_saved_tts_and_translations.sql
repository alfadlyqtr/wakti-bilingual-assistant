-- Saved TTS table
CREATE TABLE IF NOT EXISTS public.saved_tts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  voice_name TEXT NOT NULL,
  voice_id TEXT,
  audio_url TEXT NOT NULL,
  storage_path TEXT,
  duration_seconds NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '20 days')
);

-- Saved Translations table
CREATE TABLE IF NOT EXISTS public.saved_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  source_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '20 days')
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_saved_tts_user_id ON public.saved_tts(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_tts_expires_at ON public.saved_tts(expires_at);
CREATE INDEX IF NOT EXISTS idx_saved_translations_user_id ON public.saved_translations(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_translations_expires_at ON public.saved_translations(expires_at);

-- RLS policies for saved_tts
ALTER TABLE public.saved_tts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own saved TTS"
  ON public.saved_tts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved TTS"
  ON public.saved_tts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved TTS"
  ON public.saved_tts FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for saved_translations
ALTER TABLE public.saved_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own saved translations"
  ON public.saved_translations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved translations"
  ON public.saved_translations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved translations"
  ON public.saved_translations FOR DELETE
  USING (auth.uid() = user_id);
