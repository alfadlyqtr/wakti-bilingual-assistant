-- Add is_ended flag to journal_days table to track whether a day has been formally ended
ALTER TABLE public.journal_days
ADD COLUMN IF NOT EXISTS is_ended BOOLEAN DEFAULT FALSE;
