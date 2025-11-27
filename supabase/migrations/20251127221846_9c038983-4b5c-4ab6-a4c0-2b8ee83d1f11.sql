-- Add trial_popup_shown column to profiles table to track if user has seen the trial popup
-- This is the single source of truth - no localStorage needed
ALTER TABLE profiles
ADD COLUMN trial_popup_shown BOOLEAN DEFAULT false;

-- Add helpful comment
COMMENT ON COLUMN profiles.trial_popup_shown IS 'Tracks if user has seen the trial welcome popup (shows only once per user lifetime)';
