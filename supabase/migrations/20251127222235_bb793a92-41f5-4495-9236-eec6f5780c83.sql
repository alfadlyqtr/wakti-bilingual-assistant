-- Backfill trial_popup_shown for existing users who have already started their trial
-- If free_access_start_at is NOT NULL, it means they already saw the popup and started the trial
UPDATE profiles
SET trial_popup_shown = true
WHERE free_access_start_at IS NOT NULL 
  AND trial_popup_shown = false;

COMMENT ON COLUMN profiles.trial_popup_shown IS 'Tracks if user has seen the trial welcome popup (shows only once per user lifetime). Backfilled for existing users based on free_access_start_at.';
