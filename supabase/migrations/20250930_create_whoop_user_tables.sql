-- Create WHOOP user profile table
CREATE TABLE IF NOT EXISTS whoop_user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  whoop_user_id BIGINT,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create WHOOP user body measurements table
CREATE TABLE IF NOT EXISTS whoop_user_body (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  height_meter DECIMAL,
  weight_kilogram DECIMAL,
  max_heart_rate INTEGER,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE whoop_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE whoop_user_body ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own profile" ON whoop_user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own body measurements" ON whoop_user_body
  FOR SELECT USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_whoop_user_profiles_user_id ON whoop_user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_whoop_user_body_user_id ON whoop_user_body(user_id);

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_whoop_user_profiles_updated_at BEFORE UPDATE ON whoop_user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_whoop_user_body_updated_at BEFORE UPDATE ON whoop_user_body FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
