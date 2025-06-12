
-- Reset all user quotas to zero for testing
-- This will clear usage counts and purchased extras

-- Reset translation quotas
UPDATE public.user_translation_quotas 
SET 
  daily_count = 0,
  extra_translations = 0,
  purchase_date = NULL,
  updated_at = now();

-- Reset voice usage quotas  
UPDATE public.user_voice_usage
SET
  characters_used = 0,
  extra_characters = 0,
  purchase_date = NULL,
  updated_at = now();

-- Reset search quotas
UPDATE public.user_search_quotas
SET
  daily_count = 0,
  regular_search_count = 0,
  extra_searches = 0,
  extra_regular_searches = 0,
  extra_advanced_searches = 0,
  purchase_date = NULL,
  updated_at = now();
