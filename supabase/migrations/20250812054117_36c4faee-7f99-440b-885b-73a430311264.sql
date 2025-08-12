-- Create chat_messages table for simple contact form to chat conversation
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_submission_id UUID NOT NULL REFERENCES public.contact_submissions(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'admin')),
  sender_id UUID REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view messages for their contact submissions"
ON public.chat_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contact_submissions cs
    WHERE cs.id = chat_messages.contact_submission_id
    AND cs.email IN (
      SELECT email FROM public.profiles WHERE id = auth.uid()
    )
  )
);

CREATE POLICY "Users can send messages to their contact submissions"
ON public.chat_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contact_submissions cs
    WHERE cs.id = chat_messages.contact_submission_id
    AND cs.email IN (
      SELECT email FROM public.profiles WHERE id = auth.uid()
    )
  )
  AND sender_id = auth.uid()
  AND sender_type = 'user'
);

CREATE POLICY "Admins can view all chat messages"
ON public.chat_messages
FOR SELECT
USING (true);

CREATE POLICY "Admins can send messages"
ON public.chat_messages
FOR INSERT
WITH CHECK (sender_type = 'admin');

-- Add trigger for updated_at
CREATE TRIGGER update_chat_messages_updated_at
  BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();