-- Enable realtime for chat_messages table
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

-- Add chat_messages to realtime publication
ALTER publication supabase_realtime ADD TABLE public.chat_messages;

-- Make sender_id nullable to allow admin messages without profiles
ALTER TABLE public.chat_messages ALTER COLUMN sender_id DROP NOT NULL;

-- Drop the foreign key constraint if it exists
ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_sender_id_fkey;