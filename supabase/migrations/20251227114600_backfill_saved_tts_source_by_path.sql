-- Backfill saved_tts.source based on storage_path conventions
-- NOTE: This can only tag rows that already follow the /tts/ vs /translate/ path structure.

-- Mark translate saves
UPDATE public.saved_tts
SET source = 'translate'
WHERE storage_path IS NOT NULL
  AND storage_path LIKE '%/translate/%';

-- Mark tts saves
UPDATE public.saved_tts
SET source = 'tts'
WHERE storage_path IS NOT NULL
  AND storage_path LIKE '%/tts/%';
