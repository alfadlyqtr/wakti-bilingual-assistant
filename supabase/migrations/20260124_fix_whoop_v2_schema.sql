-- Fix WHOOP v2 API Schema
-- Add missing created_at_ts column to WHOOP data tables for proper sync tracking

-- Add created_at_ts to whoop_sleep if it doesn't exist
ALTER TABLE public.whoop_sleep 
ADD COLUMN IF NOT EXISTS created_at_ts TIMESTAMPTZ DEFAULT NOW();

-- Add created_at_ts to whoop_workouts if it doesn't exist
ALTER TABLE public.whoop_workouts 
ADD COLUMN IF NOT EXISTS created_at_ts TIMESTAMPTZ DEFAULT NOW();

-- Add created_at_ts to whoop_cycles if it doesn't exist
ALTER TABLE public.whoop_cycles 
ADD COLUMN IF NOT EXISTS created_at_ts TIMESTAMPTZ DEFAULT NOW();

-- Add created_at_ts to whoop_recovery if it doesn't exist
ALTER TABLE public.whoop_recovery 
ADD COLUMN IF NOT EXISTS created_at_ts TIMESTAMPTZ DEFAULT NOW();

-- Create indexes on created_at_ts for better query performance
CREATE INDEX IF NOT EXISTS idx_whoop_sleep_created_at_ts ON public.whoop_sleep(created_at_ts DESC);
CREATE INDEX IF NOT EXISTS idx_whoop_workouts_created_at_ts ON public.whoop_workouts(created_at_ts DESC);
CREATE INDEX IF NOT EXISTS idx_whoop_cycles_created_at_ts ON public.whoop_cycles(created_at_ts DESC);
CREATE INDEX IF NOT EXISTS idx_whoop_recovery_created_at_ts ON public.whoop_recovery(created_at_ts DESC);

-- Create indexes on user_id + created_at_ts for better filtering
CREATE INDEX IF NOT EXISTS idx_whoop_sleep_user_created ON public.whoop_sleep(user_id, created_at_ts DESC);
CREATE INDEX IF NOT EXISTS idx_whoop_workouts_user_created ON public.whoop_workouts(user_id, created_at_ts DESC);
CREATE INDEX IF NOT EXISTS idx_whoop_cycles_user_created ON public.whoop_cycles(user_id, created_at_ts DESC);
CREATE INDEX IF NOT EXISTS idx_whoop_recovery_user_created ON public.whoop_recovery(user_id, created_at_ts DESC);
