
import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Send, MessageSquare, User, Clock, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from 'date-fns';


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
  const [currentMessage, setCurrentMessage] = useState<ContactSubmission | null>(null);

  useEffect(() => {
    if (message && isOpen) {
      setCurrentMessage(message);
      const cleanup = setupRealtimeSubscription();
      return cleanup;
    }
  }, [message?.id, isOpen]);

  const setupRealtimeSubscription = () => {
    if (!message) return () => {};
    
    const channel = supabase
      .channel(`contact_submission_${message.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'contact_submissions',
          filter: `id=eq.${message.id}`
        },
        (payload) => {
          const updatedMessage = payload.new as ContactSubmission;
          setCurrentMessage(updatedMessage);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSendResponse = async () => {
    if (!message || !response.trim()) {
      toast.error("Please write a response");
      return;
    }

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('contact_submissions')
        .update({ 
          admin_response: response.trim(),
          status: 'responded',
          responded_at: new Date().toISOString(),
          responded_by: user?.id || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', message.id);

      if (error) throw error;

      toast.success(`Response sent to ${message.name}`);
      setResponse("");
      onResponded();
    } catch (error) {
      console.error('Error sending response:', error);
      toast.error("Failed to send response");
    } finally {
      setIsSending(false);
    }
  };

  const handleEndChat = async () => {
    if (!message) return;
    
    try {
      await supabase
        .from('contact_submissions')
        .update({ 
          status: 'closed',
          updated_at: new Date().toISOString()
        })
        .eq('id', message.id);
      
      toast.success('Chat ended');
      onResponded();
      handleClose();
    } catch (error) {
      console.error('Error ending chat:', error);
      toast.error('Failed to end chat');
    }
  };

  const handleClose = () => {
    setResponse("");
    setCurrentMessage(null);
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
              <Label className="text-sm font-medium">Initial Message</Label>
              <p className="text-sm mt-1 whitespace-pre-wrap">{message.message}</p>
            </div>
            
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Received: {new Date(message.created_at).toLocaleString()}</span>
            </div>
          </div>

          {/* Chat Thread */}
          <div className="border rounded-lg p-4">
            <Label className="text-sm font-medium mb-3 block">Chat Thread</Label>
            <div className="bg-background border rounded-lg p-3 max-h-80 overflow-y-auto space-y-3">
              {/* User Message */}
              <div className="flex justify-end">
                <div className="max-w-xs lg:max-w-md px-3 py-2 rounded-lg bg-primary text-primary-foreground">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-medium">{message.name}</span>
                    <span className="text-xs opacity-75 ml-2">
                      {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                </div>
              </div>

              {/* Admin Response */}
              {(currentMessage?.admin_response || message.admin_response) && (
                <div className="flex justify-start">
                  <div className="max-w-xs lg:max-w-md px-3 py-2 rounded-lg bg-blue-500 text-white">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-medium">WAKTI Support</span>
                      <span className="text-xs opacity-75 ml-2">
                        {formatDistanceToNow(new Date((currentMessage?.responded_at || message.responded_at || message.updated_at)), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{currentMessage?.admin_response || message.admin_response}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Response Section */}
          <div>
            <Label htmlFor="response">Admin Response</Label>
            <Textarea
              id="response"
              placeholder="Type your response to the user here..."
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={3}
              className="mt-1"
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleEndChat}
              className="flex items-center space-x-2"
            >
              <X className="h-4 w-4" />
              <span>End Chat</span>
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
