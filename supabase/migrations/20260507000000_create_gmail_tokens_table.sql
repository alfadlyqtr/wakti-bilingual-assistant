-- Create gmail_tokens table for storing Gmail OAuth tokens
CREATE TABLE IF NOT EXISTS gmail_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  email_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE gmail_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see their own tokens
CREATE POLICY "Users can read own gmail tokens"
  ON gmail_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: users can only update their own tokens
CREATE POLICY "Users can update own gmail tokens"
  ON gmail_tokens
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: users can only insert their own tokens
CREATE POLICY "Users can insert own gmail tokens"
  ON gmail_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: users can only delete their own tokens
CREATE POLICY "Users can delete own gmail tokens"
  ON gmail_tokens
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
