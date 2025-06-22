
-- Add email_confirmed field to profiles table to track confirmation status
ALTER TABLE public.profiles 
ADD COLUMN email_confirmed boolean DEFAULT false;

-- Update existing users based on auth.users email_confirmed_at field
UPDATE public.profiles 
SET email_confirmed = true 
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE email_confirmed_at IS NOT NULL
);

-- Create a function to sync email confirmation status
CREATE OR REPLACE FUNCTION public.sync_email_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles 
  SET 
    email_confirmed = (NEW.email_confirmed_at IS NOT NULL),
    updated_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- Create trigger to sync email confirmation when auth.users is updated
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW 
  WHEN (OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at)
  EXECUTE FUNCTION public.sync_email_confirmation();
