
-- Fix message_type constraint to include voice and pdf
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_message_type_check 
  CHECK (message_type IN ('text', 'image', 'voice', 'pdf'));

-- Create the message_attachments storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)  
VALUES ('message_attachments', 'message_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for message_attachments bucket
CREATE POLICY "Public Read Access for Message Attachments"
ON storage.objects FOR SELECT 
USING (bucket_id = 'message_attachments');

CREATE POLICY "Authenticated Users Can Upload Message Attachments"
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'message_attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Users Can Update Their Own Message Attachments"
ON storage.objects FOR UPDATE 
USING (bucket_id = 'message_attachments' AND auth.uid() = owner)
WITH CHECK (bucket_id = 'message_attachments' AND auth.uid() = owner);

CREATE POLICY "Users Can Delete Their Own Message Attachments"
ON storage.objects FOR DELETE 
USING (bucket_id = 'message_attachments' AND auth.uid() = owner);

-- Set up cron job for automatic message cleanup (every hour)
SELECT cron.schedule(
  'cleanup-old-messages',
  '0 * * * *', -- Every hour
  $$
  SELECT cleanup_old_messages();
  $$
);
