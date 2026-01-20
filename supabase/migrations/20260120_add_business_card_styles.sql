-- Add missing columns for new business card customization options
ALTER TABLE user_business_cards 
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
  ADD COLUMN IF NOT EXISTS cover_photo_url TEXT;

-- Add comments for clarity
COMMENT ON COLUMN user_business_cards.template IS 'Card template ID (geometric, professional, fashion, etc.)';
COMMENT ON COLUMN user_business_cards.mosaic_colors IS 'Custom colors for Geometric/Mosaic template';
COMMENT ON COLUMN user_business_cards.professional_colors IS 'Custom colors for Professional template';
COMMENT ON COLUMN user_business_cards.fashion_colors IS 'Custom colors for Fashion template';
COMMENT ON COLUMN user_business_cards.minimal_colors IS 'Custom colors for Minimal template';
COMMENT ON COLUMN user_business_cards.clean_colors IS 'Custom colors for Clean template';
COMMENT ON COLUMN user_business_cards.logo_position IS 'Position of the logo on the card';
COMMENT ON COLUMN user_business_cards.photo_shape IS 'Shape of the profile photo (circle, square)';
