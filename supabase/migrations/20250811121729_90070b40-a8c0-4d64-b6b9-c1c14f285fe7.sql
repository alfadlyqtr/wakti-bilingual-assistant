-- Drop the existing trigger first
DROP TRIGGER IF EXISTS support_ticket_to_admin_message ON support_tickets;

-- Update the function to insert into contact_submissions instead of admin_messages
CREATE OR REPLACE FUNCTION public.create_admin_message_from_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Recreate the trigger with the updated function
CREATE TRIGGER support_ticket_to_admin_message
  AFTER INSERT ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION create_admin_message_from_ticket();