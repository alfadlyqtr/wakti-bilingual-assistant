-- Fix search path security issue for the function
CREATE OR REPLACE FUNCTION public.create_admin_message_from_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_profile RECORD;
BEGIN
  -- Get user profile information
  SELECT display_name, email INTO user_profile
  FROM public.profiles 
  WHERE id = NEW.user_id;
  
  -- Create contact submission from support ticket
  INSERT INTO public.contact_submissions (
    name,
    email,
    subject,
    message,
    submission_type,
    status,
    created_at
  ) VALUES (
    COALESCE(user_profile.display_name, 'Support User'),
    COALESCE(user_profile.email, 'support@wakti.com'),
    NEW.subject,
    'Support Ticket Type: ' || NEW.type || E'\n\n' || NEW.subject,
    'support',
    'unread',
    NEW.created_at
  );
  
  RETURN NEW;
END;
$function$;