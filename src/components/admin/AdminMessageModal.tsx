
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

interface ChatMessage {
  id: string;
  content: string;
  sender_type: 'user' | 'admin';
  sender_id: string | null;
  created_at: string;
  sender_name?: string;
}

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (message && isOpen) {
      loadMessages();
      const cleanup = setupRealtimeSubscription();
      return cleanup;
    }
  }, [message?.id, isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    if (!message) return;
    
    try {
      setIsLoadingMessages(true);
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          sender:profiles(display_name)
        `)
        .eq('contact_submission_id', message.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formattedMessages = data.map(msg => ({
        ...msg,
        sender_name: msg.sender?.display_name || (msg.sender_type === 'admin' ? 'WAKTI Support' : message.name)
      }));

      setMessages(formattedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!message) return () => {};
    
    const channel = supabase
      .channel(`admin_chat_messages_${message.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `contact_submission_id=eq.${message.id}`
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages(prev => [...prev, {
            ...newMsg,
            sender_name: newMsg.sender_type === 'admin' ? 'WAKTI Support' : message.name
          }]);
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
      
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          contact_submission_id: message.id,
          sender_type: 'admin',
          sender_id: user?.id || null,
          content: response.trim()
        })
        .select()
        .single();

      if (error) throw error;

      // Update submission status
      await supabase
        .from('contact_submissions')
        .update({ 
          status: 'responded',
          responded_at: new Date().toISOString(),
          responded_by: user?.id || null
        })
        .eq('id', message.id);

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
    setMessages([]);
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
              {isLoadingMessages ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : messages.length > 0 ? (
                <>
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_type === 'admin' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${
                          msg.sender_type === 'admin'
                            ? 'bg-blue-500 text-white'
                            : 'bg-primary text-primary-foreground'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-medium">
                            {msg.sender_name}
                          </span>
                          <span className="text-xs opacity-75 ml-2">
                            {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No messages yet. Start the conversation by sending a response below.
                </p>
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
