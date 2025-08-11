-- Create WAKTI SUPPORT system profile that the admin-reply-to-user function needs
-- First, ensure the system user exists in auth.users (this is handled by Supabase)
-- Then create the profile

INSERT INTO public.profiles (
  id, 
  display_name, 
  email, 
  avatar_url,
  created_at, 
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'WAKTI SUPPORT',
  'support@wakti.app',
  '/lovable-uploads/logo.png',
  now(),
  now()
) ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  email = EXCLUDED.email,
  avatar_url = EXCLUDED.avatar_url,
  updated_at = now();