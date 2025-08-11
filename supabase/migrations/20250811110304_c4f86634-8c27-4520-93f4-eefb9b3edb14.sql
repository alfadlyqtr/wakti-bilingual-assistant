-- Create trigger to automatically create admin messages from support tickets
CREATE TRIGGER support_ticket_to_admin_message
  AFTER INSERT ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION create_admin_message_from_ticket();