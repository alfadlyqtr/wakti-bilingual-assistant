-- Allow system to create system profiles (like WAKTI SUPPORT)
CREATE POLICY "System can create system profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  id = '00000000-0000-0000-0000-000000000001'::uuid OR
  id = '00000000-0000-0000-0000-000000000002'::uuid
);

-- Allow system to create contacts involving system profiles
CREATE POLICY "System can create system contacts" 
ON public.contacts 
FOR INSERT 
WITH CHECK (
  user_id = '00000000-0000-0000-0000-000000000001'::uuid OR
  contact_id = '00000000-0000-0000-0000-000000000001'::uuid OR
  user_id = '00000000-0000-0000-0000-000000000002'::uuid OR
  contact_id = '00000000-0000-0000-0000-000000000002'::uuid
);

-- Allow system profiles to send messages to any user
CREATE POLICY "System profiles can send messages to any user" 
ON public.messages 
FOR INSERT 
WITH CHECK (
  sender_id = '00000000-0000-0000-0000-000000000001'::uuid OR
  sender_id = '00000000-0000-0000-0000-000000000002'::uuid
);

-- Allow users to view messages from system profiles
CREATE POLICY "Users can view messages from system profiles" 
ON public.messages 
FOR SELECT 
USING (
  sender_id = '00000000-0000-0000-0000-000000000001'::uuid OR
  sender_id = '00000000-0000-0000-0000-000000000002'::uuid OR
  recipient_id = auth.uid()
);