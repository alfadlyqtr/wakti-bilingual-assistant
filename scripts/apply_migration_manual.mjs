
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

console.log('Supabase URL:', supabaseUrl);

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase URL or Service Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sql = `
-- Add missing columns for new business card customization options
DO $$ 
BEGIN 
    -- Template
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_business_cards' AND column_name = 'template') THEN
        ALTER TABLE user_business_cards ADD COLUMN template TEXT DEFAULT 'geometric';
    END IF;

    -- Primary Color
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_business_cards' AND column_name = 'primary_color') THEN
        ALTER TABLE user_business_cards ADD COLUMN primary_color TEXT DEFAULT '#6366f1';
    END IF;

    -- Mosaic Palette ID
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_business_cards' AND column_name = 'mosaic_palette_id') THEN
        ALTER TABLE user_business_cards ADD COLUMN mosaic_palette_id TEXT DEFAULT 'rose';
    END IF;

    -- Mosaic Colors
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_business_cards' AND column_name = 'mosaic_colors') THEN
        ALTER TABLE user_business_cards ADD COLUMN mosaic_colors JSONB;
    END IF;

    -- Professional Colors
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_business_cards' AND column_name = 'professional_colors') THEN
        ALTER TABLE user_business_cards ADD COLUMN professional_colors JSONB;
    END IF;

    -- Fashion Colors
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_business_cards' AND column_name = 'fashion_colors') THEN
        ALTER TABLE user_business_cards ADD COLUMN fashion_colors JSONB;
    END IF;

    -- Minimal Colors
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_business_cards' AND column_name = 'minimal_colors') THEN
        ALTER TABLE user_business_cards ADD COLUMN minimal_colors JSONB;
    END IF;

    -- Clean Colors
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_business_cards' AND column_name = 'clean_colors') THEN
        ALTER TABLE user_business_cards ADD COLUMN clean_colors JSONB;
    END IF;

    -- Logo Position
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_business_cards' AND column_name = 'logo_position') THEN
        ALTER TABLE user_business_cards ADD COLUMN logo_position TEXT DEFAULT 'top-right';
    END IF;

    -- Photo Shape
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_business_cards' AND column_name = 'photo_shape') THEN
        ALTER TABLE user_business_cards ADD COLUMN photo_shape TEXT DEFAULT 'circle';
    END IF;

    -- Name Style
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_business_cards' AND column_name = 'name_style') THEN
        ALTER TABLE user_business_cards ADD COLUMN name_style JSONB;
    END IF;

    -- Title Style
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_business_cards' AND column_name = 'title_style') THEN
        ALTER TABLE user_business_cards ADD COLUMN title_style JSONB;
    END IF;

    -- Company Style
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_business_cards' AND column_name = 'company_style') THEN
        ALTER TABLE user_business_cards ADD COLUMN company_style JSONB;
    END IF;
END $$;
`;

// Try to execute via a known RPC function if available, or just log instructions
// This script is mostly to verify we have access and to print the SQL for the user
console.log('---------------------------------------------------');
console.log('Please execute the following SQL in your Supabase Dashboard SQL Editor:');
console.log('---------------------------------------------------');
console.log(sql);
console.log('---------------------------------------------------');
