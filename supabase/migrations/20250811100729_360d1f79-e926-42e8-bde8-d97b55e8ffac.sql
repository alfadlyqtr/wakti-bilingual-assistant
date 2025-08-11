-- Add RLS policies for support tickets and messages to allow admin access
-- Enable RLS if not already enabled
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Allow admin users to manage all support tickets
CREATE POLICY "Admin users can manage all support tickets" 
ON public.support_tickets 
FOR ALL 
USING (public.is_staff(auth.uid()));

-- Allow admin users to manage all support messages  
CREATE POLICY "Admin users can manage all support messages"
ON public.support_messages
FOR ALL
USING (public.is_staff(auth.uid()));