-- Add messages column to store chat history as JSON array
ALTER TABLE contact_submissions 
ADD COLUMN IF NOT EXISTS messages jsonb DEFAULT '[]'::jsonb;