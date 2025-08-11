-- Support Ticketing System Migration

-- 1. Staff registry table
CREATE TABLE IF NOT EXISTS public.staff_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 2. Function to check if user is staff
CREATE OR REPLACE FUNCTION public.is_staff(uid UUID)
RETURNS BOOLEAN 
LANGUAGE SQL 
STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.staff_users WHERE id = uid);
$$;

-- 3. Support tickets table
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('support','feedback','abuse')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','solved','closed')),
  subject TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

-- 4. Support messages table
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','staff')),
  body TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Enable RLS on all support tables
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for support_tickets
CREATE POLICY "user_can_see_own_tickets"
  ON public.support_tickets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE POLICY "user_can_create_own_tickets"
  ON public.support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_can_close_own_ticket"
  ON public.support_tickets FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND status = 'closed');

CREATE POLICY "staff_full_access_to_tickets"
  ON public.support_tickets FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- 7. RLS Policies for support_messages
CREATE POLICY "user_read_messages_of_own_tickets"
  ON public.support_messages FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = support_messages.ticket_id
      AND (t.user_id = auth.uid() OR public.is_staff(auth.uid()))
  ));

CREATE POLICY "user_add_message_to_own_open_pending_tickets"
  ON public.support_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    role = 'user'
    AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_messages.ticket_id
        AND t.user_id = auth.uid()
        AND t.status IN ('open','pending')
    )
  );

CREATE POLICY "staff_add_message_to_any_ticket"
  ON public.support_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    role = 'staff' 
    AND public.is_staff(auth.uid()) 
    AND sender_id = auth.uid()
  );

-- 8. Storage bucket for support attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('support-attachments', 'support-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- 9. Storage policies for support attachments
CREATE POLICY "user_crud_own_support_files"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'support-attachments'
  AND split_part(name, '/', 1) = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'support-attachments'
  AND split_part(name, '/', 1) = auth.uid()::text
);

CREATE POLICY "staff_read_all_support_files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'support-attachments' AND public.is_staff(auth.uid()));

-- 10. Update triggers for support_tickets
CREATE OR REPLACE FUNCTION public.update_support_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_support_tickets_updated_at();