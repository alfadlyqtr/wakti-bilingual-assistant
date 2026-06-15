-- Add midday_reflection field to journal_days table
ALTER TABLE public.journal_days
ADD COLUMN IF NOT EXISTS midday_reflection TEXT;
