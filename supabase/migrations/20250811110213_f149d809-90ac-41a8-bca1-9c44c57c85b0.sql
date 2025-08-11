-- Create function to automatically create admin message when support ticket is created
CREATE OR REPLACE FUNCTION create_admin_message_from_ticket()
RETURNS TRIGGER AS $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Get the first admin user to receive the message
  SELECT id INTO admin_user_id FROM admin_users WHERE is_active = true LIMIT 1;
  
  IF admin_user_id IS NOT NULL THEN
    -- Create admin message from support ticket
    INSERT INTO admin_messages (
      recipient_id,
      admin_id, 
      subject,
      content,
      created_at
    ) VALUES (
      NEW.user_id,
      admin_user_id,
      'Support Ticket: ' || NEW.subject,
      NEW.subject || E'\n\nTicket Type: ' || NEW.type || E'\n\nPlease respond to this support request.',
      NEW.created_at
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;