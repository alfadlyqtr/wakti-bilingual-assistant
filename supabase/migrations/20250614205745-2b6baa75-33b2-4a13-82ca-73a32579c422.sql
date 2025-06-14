
-- Add the is_logged_in flag to profiles for simple single-session logic
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_logged_in boolean DEFAULT false;

-- Make sure only one session can be active:
-- When user logs in, set is_logged_in to TRUE; block if already TRUE.
-- When user logs out, set is_logged_in to FALSE.

-- No extra triggers or policies needed—will manage in app logic.
