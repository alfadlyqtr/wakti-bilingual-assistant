
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageSquare, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChatThread } from "@/components/support/ChatThread";

// Use the same interface as in the parent AdminMessages component
interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  subject?: string; // Make optional to match existing data
  message: string;
  submission_type: string;
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
  const [isEndingChat, setIsEndingChat] = useState(false);

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

  const handleEndChat = async () => {
    if (!message) return;

    setIsEndingChat(true);
    try {
      await supabase
        .from('contact_submissions')
        .update({ 
          status: 'resolved',
          updated_at: new Date().toISOString()
        })
        .eq('id', message.id);
      
      toast.success('Chat ended and marked as resolved');
      onResponded();
      onClose();
    } catch (error) {
      console.error('Error ending chat:', error);
      toast.error('Failed to end chat');
    } finally {
      setIsEndingChat(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  if (!message) return null;

  // Mark as read when modal opens
  if (message.status === 'unread') {
    markAsRead();
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5" />
              <span>Support Chat</span>
              <Badge 
                variant={
                  message.status === 'unread' ? 'destructive' :
                  message.status === 'responded' ? 'default' : 
                  message.status === 'resolved' ? 'outline' : 'secondary'
                }
                className="text-xs"
              >
                {message.status}
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleEndChat}
                disabled={isEndingChat || message.status === 'resolved'}
                className="text-xs"
              >
                {isEndingChat ? 'Ending...' : 'End Chat'}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-6 pt-0">
          <ChatThread 
            submission={{
              ...message,
              subject: message.subject || 'Support Request'
            }} 
            onClose={handleClose} 
            isAdmin={true}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
