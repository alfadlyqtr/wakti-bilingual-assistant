
-- 1. Add an 'is_favorite' boolean column to the contacts table
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

-- 2. (Optional) Existing contacts will be non-favorite by default.
-- No data migration is needed since default is false.
