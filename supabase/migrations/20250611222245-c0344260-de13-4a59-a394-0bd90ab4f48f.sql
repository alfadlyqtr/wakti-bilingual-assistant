
-- Add missing columns to user_search_quotas table
ALTER TABLE public.user_search_quotas 
ADD COLUMN IF NOT EXISTS monthly_date text DEFAULT to_char(now(), 'YYYY-MM'),
ADD COLUMN IF NOT EXISTS regular_search_count integer DEFAULT 0;

-- Update existing records to have proper monthly_date values
UPDATE public.user_search_quotas 
SET monthly_date = to_char(created_at, 'YYYY-MM')
WHERE monthly_date IS NULL;

-- Update existing records to have default regular_search_count
UPDATE public.user_search_quotas 
SET regular_search_count = 0
WHERE regular_search_count IS NULL;

-- Make monthly_date NOT NULL after setting defaults
ALTER TABLE public.user_search_quotas 
ALTER COLUMN monthly_date SET NOT NULL;

-- Make regular_search_count NOT NULL after setting defaults
ALTER TABLE public.user_search_quotas 
ALTER COLUMN regular_search_count SET NOT NULL;

-- Create index for better performance on monthly queries
CREATE INDEX IF NOT EXISTS idx_user_search_quotas_monthly 
ON public.user_search_quotas(user_id, monthly_date);
