
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Send, MessageSquare, User, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  subject?: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
  admin_response?: string;
  responded_at?: string;
  responded_by?: string;
}

interface AdminMessageModalProps {
  message: ContactSubmission | null;
  isOpen: boolean;
  onClose: () => void;
  onResponded: () => void;
}

export const AdminMessageModal = ({ message, isOpen, onClose, onResponded }: AdminMessageModalProps) => {
  const [response, setResponse] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSendResponse = async () => {
    if (!message || !response.trim()) {
      toast.error("Please write a response");
      return;
    }

    setIsSending(true);
    try {
      // Get admin session
      const adminSession = localStorage.getItem('admin_session');
      if (!adminSession) {
        toast.error("Admin session not found");
        return;
      }

      const session = JSON.parse(adminSession);
      
      // First, find the user profile by email to get their user_id
      const { data: userProfile, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', message.email)
        .single();

      if (userError) {
        console.error('Error finding user:', userError);
        toast.error("User not found. Unable to send direct message.");
        return;
      }

      // Create/ensure WAKTI SUPPORT system contact exists
      const WAKTI_SUPPORT_ID = '00000000-0000-0000-0000-000000000001';
      
      // Create system profile if it doesn't exist
      await supabase
        .from('profiles')
        .upsert({
          id: WAKTI_SUPPORT_ID,
          display_name: 'WAKTI SUPPORT',
          email: 'support@wakti.app',
          avatar_url: '/lovable-uploads/logo.png', // Wakti logo
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      // Add WAKTI SUPPORT to user's contacts if not already added
      await supabase
        .from('contacts')
        .upsert({
          user_id: userProfile.id,
          contact_id: WAKTI_SUPPORT_ID,
          status: 'accepted',
          is_favorite: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,contact_id' });

      // Send the admin response as a direct message from WAKTI SUPPORT
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          sender_id: WAKTI_SUPPORT_ID,
          recipient_id: userProfile.id,
          message_type: 'text',
          content: `Re: ${message.subject || 'Your Message'}\n\n${response.trim()}`,
          created_at: new Date().toISOString(),
          is_read: false
        });

      if (messageError) {
        console.error('Error sending direct message:', messageError);
        toast.error("Failed to send direct message");
        return;
      }

      // Update the contact submission with admin response
      const { error } = await supabase
        .from('contact_submissions')
        .update({
          admin_response: response.trim(),
          status: 'responded',
          responded_at: new Date().toISOString(),
          responded_by: session.admin_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', message.id);

      if (error) {
        console.error('Error updating submission:', error);
        toast.error("Failed to update submission status");
        return;
      }

      toast.success(`Response sent to ${message.name} via direct message`);
      setResponse("");
      onResponded();
    } catch (error) {
      console.error('Error sending response:', error);
      toast.error("Failed to send response");
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setResponse("");
    onClose();
  };

  const markAsRead = async () => {
    if (!message || message.status !== 'unread') return;

    try {
      await supabase
        .from('contact_submissions')
        .update({ 
          status: 'read',
          updated_at: new Date().toISOString()
        })
        .eq('id', message.id);
      
      onResponded();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  if (!message) return null;

  // Mark as read when modal opens
  if (message.status === 'unread') {
    markAsRead();
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5" />
            <span>Support Message</span>
            <Badge 
              variant={
                message.status === 'unread' ? 'destructive' :
                message.status === 'responded' ? 'default' : 'secondary'
              }
              className="text-xs"
            >
              {message.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Message Details */}
          <div className="bg-muted p-4 rounded-lg space-y-3">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4" />
              <span className="font-medium">{message.name}</span>
              <span className="text-muted-foreground">({message.email})</span>
            </div>
            
            {message.subject && (
              <div>
                <Label className="text-sm font-medium">Subject</Label>
                <p className="text-sm mt-1">{message.subject}</p>
              </div>
            )}
            
            <div>
              <Label className="text-sm font-medium">Message</Label>
              <p className="text-sm mt-1 whitespace-pre-wrap">{message.message}</p>
            </div>
            
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Received: {new Date(message.created_at).toLocaleString()}</span>
            </div>
          </div>

          {/* Previous Response (if any) */}
          {message.admin_response && (
            <div className="bg-accent/20 p-4 rounded-lg">
              <Label className="text-sm font-medium">Previous Admin Response</Label>
              <p className="text-sm mt-1 whitespace-pre-wrap">{message.admin_response}</p>
              {message.responded_at && (
                <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-2">
                  <Clock className="h-3 w-3" />
                  <span>Responded: {new Date(message.responded_at).toLocaleString()}</span>
                </div>
              )}
            </div>
          )}

          {/* Response Section */}
          <div>
            <Label htmlFor="response">Admin Response</Label>
            <Textarea
              id="response"
              placeholder="Type your response to the user here..."
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={6}
              className="mt-1"
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
            <Button 
              onClick={handleSendResponse}
              disabled={isSending || !response.trim()}
              className="flex items-center space-x-2"
            >
              <Send className="h-4 w-4" />
              <span>{isSending ? "Sending..." : "Send Response"}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
