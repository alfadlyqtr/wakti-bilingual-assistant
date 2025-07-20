
-- Add country and country_code columns to the profiles table
ALTER TABLE public.profiles 
ADD COLUMN country TEXT,
ADD COLUMN country_code TEXT;

-- Add a comment for documentation
COMMENT ON COLUMN public.profiles.country IS 'Full country name (e.g., "Qatar", "United Arab Emirates")';
COMMENT ON COLUMN public.profiles.country_code IS 'ISO 3166-1 alpha-2 country code (e.g., "QA", "AE")';
