-- Add last_seen timestamp to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_seen timestamp with time zone DEFAULT now();

-- Create saved_messages table
CREATE TABLE IF NOT EXISTS public.saved_messages (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message_id uuid NOT NULL,
    saved_at timestamp with time zone DEFAULT now(),
    conversation_id text NOT NULL,
    
    CONSTRAINT fk_saved_message_user 
      FOREIGN KEY (user_id) 
      REFERENCES auth.users(id) 
      ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_saved_messages_user 
  ON public.saved_messages(user_id);

-- Enable RLS for saved_messages
ALTER TABLE public.saved_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for saved_messages
CREATE POLICY "Users can view their saved messages"
  ON public.saved_messages
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can save messages"
  ON public.saved_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave messages"
  ON public.saved_messages
  FOR DELETE
  USING (auth.uid() = user_id);
