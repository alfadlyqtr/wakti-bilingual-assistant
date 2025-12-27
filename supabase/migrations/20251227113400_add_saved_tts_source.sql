-- Add source column to distinguish where saved audio came from
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'saved_tts'
      AND column_name = 'source'
  ) THEN
    ALTER TABLE public.saved_tts
      ADD COLUMN source TEXT;
  END IF;
END $$;

-- Backfill existing rows (treat existing as TTS by default)
UPDATE public.saved_tts
SET source = 'tts'
WHERE source IS NULL;

-- Enforce not null + allowed values
ALTER TABLE public.saved_tts
  ALTER COLUMN source SET DEFAULT 'tts';

ALTER TABLE public.saved_tts
  ALTER COLUMN source SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'saved_tts_source_check'
  ) THEN
    ALTER TABLE public.saved_tts
      ADD CONSTRAINT saved_tts_source_check
      CHECK (source IN ('tts', 'translate'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_saved_tts_user_source_created_at
  ON public.saved_tts (user_id, source, created_at DESC);
