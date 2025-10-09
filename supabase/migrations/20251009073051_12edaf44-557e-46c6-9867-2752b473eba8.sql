-- Add gratitude fields to journal_days table
ALTER TABLE public.journal_days 
ADD COLUMN IF NOT EXISTS gratitude_1 TEXT,
ADD COLUMN IF NOT EXISTS gratitude_2 TEXT,
ADD COLUMN IF NOT EXISTS gratitude_3 TEXT;