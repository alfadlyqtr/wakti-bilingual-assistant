
-- 1. Ensure `is_active` boolean column exists
ALTER TABLE public.user_sessions
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 2. Now add the unique partial index (one active session per user)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_user_id_active
ON public.user_sessions(user_id)
WHERE is_active = true;

-- 3. Add simple device_info column if missing (this is safe to repeat)
ALTER TABLE public.user_sessions
ADD COLUMN IF NOT EXISTS device_info text;
