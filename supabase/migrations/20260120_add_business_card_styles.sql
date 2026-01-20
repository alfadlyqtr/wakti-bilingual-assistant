-- Add missing columns for new business card customization options
-- Add card_slot to support up to 2 cards per user (1 = primary, 2 = secondary)
ALTER TABLE user_business_cards 
  ADD COLUMN IF NOT EXISTS card_slot INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS card_name TEXT DEFAULT 'Primary Card',
  ADD COLUMN IF NOT EXISTS share_slug TEXT,
  ADD COLUMN IF NOT EXISTS template TEXT DEFAULT 'geometric',
  ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS mosaic_palette_id TEXT DEFAULT 'rose',
  ADD COLUMN IF NOT EXISTS mosaic_colors JSONB,
  ADD COLUMN IF NOT EXISTS professional_colors JSONB,
  ADD COLUMN IF NOT EXISTS fashion_colors JSONB,
  ADD COLUMN IF NOT EXISTS minimal_colors JSONB,
  ADD COLUMN IF NOT EXISTS clean_colors JSONB,
  ADD COLUMN IF NOT EXISTS logo_position TEXT DEFAULT 'top-right',
  ADD COLUMN IF NOT EXISTS photo_shape TEXT DEFAULT 'circle',
  ADD COLUMN IF NOT EXISTS name_style JSONB,
  ADD COLUMN IF NOT EXISTS title_style JSONB,
  ADD COLUMN IF NOT EXISTS company_style JSONB,
  ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS headline TEXT,
  ADD COLUMN IF NOT EXISTS cover_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS icon_style JSONB DEFAULT jsonb_build_object('showBackground', true, 'backgroundColor', '#000000', 'iconColor', '#ffffff', 'useBrandColors', true, 'colorIntensity', 50);

-- Ensure we can store up to 2 cards per user
ALTER TABLE user_business_cards
  DROP CONSTRAINT IF EXISTS user_business_cards_pkey;

ALTER TABLE user_business_cards
  ADD CONSTRAINT user_business_cards_pkey PRIMARY KEY (user_id, card_slot);

-- Backfill share slugs for existing cards (used for public share URLs)
UPDATE user_business_cards
SET share_slug = md5(random()::text || clock_timestamp()::text)
WHERE share_slug IS NULL OR share_slug = '';

ALTER TABLE user_business_cards
  ALTER COLUMN share_slug SET DEFAULT md5(random()::text || clock_timestamp()::text);

ALTER TABLE user_business_cards
  ALTER COLUMN share_slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_business_cards_share_slug_key
  ON user_business_cards (share_slug);

-- Public RPC: fetch a business card by share_slug (no login)
CREATE OR REPLACE FUNCTION public.get_business_card_by_share_slug(p_share_slug text)
RETURNS TABLE (
  user_id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  company_name text,
  job_title text,
  website text,
  logo_url text,
  profile_photo_url text,
  cover_photo_url text,
  department text,
  headline text,
  address text,
  social_links jsonb,
  template text,
  primary_color text,
  mosaic_palette_id text,
  mosaic_colors jsonb,
  professional_colors jsonb,
  fashion_colors jsonb,
  minimal_colors jsonb,
  clean_colors jsonb,
  logo_position text,
  photo_shape text,
  name_style jsonb,
  title_style jsonb,
  company_style jsonb,
  icon_style jsonb,
  card_slot integer,
  card_name text,
  share_slug text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ubc.user_id,
    ubc.first_name,
    ubc.last_name,
    ubc.email,
    ubc.phone,
    ubc.company_name,
    ubc.job_title,
    ubc.website,
    ubc.logo_url,
    ubc.profile_photo_url,
    ubc.cover_photo_url,
    ubc.department,
    ubc.headline,
    ubc.address,
    ubc.social_links,
    ubc.template,
    ubc.primary_color,
    ubc.mosaic_palette_id,
    ubc.mosaic_colors,
    ubc.professional_colors,
    ubc.fashion_colors,
    ubc.minimal_colors,
    ubc.clean_colors,
    ubc.logo_position,
    ubc.photo_shape,
    ubc.name_style,
    ubc.title_style,
    ubc.company_style,
    ubc.icon_style,
    ubc.card_slot,
    ubc.card_name,
    ubc.share_slug
  FROM public.user_business_cards ubc
  WHERE ubc.share_slug = p_share_slug
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_business_card_by_share_slug(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_business_card_by_share_slug(text) TO authenticated;

-- Add comments for clarity
COMMENT ON COLUMN user_business_cards.template IS 'Card template ID (geometric, professional, fashion, etc.)';
COMMENT ON COLUMN user_business_cards.mosaic_colors IS 'Custom colors for Geometric/Mosaic template';
COMMENT ON COLUMN user_business_cards.professional_colors IS 'Custom colors for Professional template';
COMMENT ON COLUMN user_business_cards.fashion_colors IS 'Custom colors for Fashion template';
COMMENT ON COLUMN user_business_cards.minimal_colors IS 'Custom colors for Minimal template';
COMMENT ON COLUMN user_business_cards.clean_colors IS 'Custom colors for Clean template';
COMMENT ON COLUMN user_business_cards.logo_position IS 'Position of the logo on the card';
COMMENT ON COLUMN user_business_cards.photo_shape IS 'Shape of the profile photo (circle, square)';
COMMENT ON COLUMN user_business_cards.icon_style IS 'Icon styling options (background, colors, intensity)';
