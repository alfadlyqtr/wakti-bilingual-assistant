import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
  subject: string;
  message: string;
  submission_type: string;
  status: string;
  created_at: string;
}

interface ChatThreadProps {
  submission: ContactSubmission;
  onClose: () => void;
  isAdmin?: boolean;
}

export const ChatThread: React.FC<ChatThreadProps> = ({
  submission,
  onClose,
  isAdmin = false,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    setupRealtimeSubscription();
  }, [submission.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          sender:profiles(display_name)
        `)
        .eq('contact_submission_id', submission.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formattedMessages = data.map(msg => ({
        ...msg,
        sender_name: msg.sender?.display_name || (msg.sender_type === 'admin' ? 'WAKTI Support' : submission.name)
      }));

      setMessages(formattedMessages);
    } catch (error: any) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('chat_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `contact_submission_id=eq.${submission.id}`
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages(prev => [...prev, {
            ...newMsg,
            sender_name: newMsg.sender_type === 'admin' ? 'WAKTI Support' : submission.name
          }]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          contact_submission_id: submission.id,
          sender_type: isAdmin ? 'admin' : 'user',
          sender_id: user?.id,
          content: newMessage.trim()
        });

      if (error) throw error;

      // Update submission status if admin is responding
      if (isAdmin) {
        await supabase
          .from('contact_submissions')
          .update({ 
            status: 'responded',
            responded_at: new Date().toISOString()
          })
          .eq('id', submission.id);
      }

      setNewMessage('');
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'unread': return 'bg-red-500';
      case 'read': return 'bg-yellow-500';
      case 'responded': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            {submission.subject}
            <Badge className={getStatusColor(submission.status)}>
              {submission.status}
            </Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {submission.name} • {submission.email} • {submission.submission_type}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Initial submission */}
        <div className="p-4 bg-secondary rounded-lg">
          <div className="flex justify-between items-start mb-2">
            <span className="font-medium">{submission.name}</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(submission.created_at), { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm">{submission.message}</p>
        </div>

        {/* Chat messages */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender_type === 'admin' ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.sender_type === 'admin'
                    ? 'bg-blue-500 text-white'
                    : 'bg-primary text-primary-foreground'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs font-medium">
                    {message.sender_name}
                  </span>
                  <span className="text-xs opacity-75 ml-2">
                    {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Message input */}
        <div className="flex gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            rows={2}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={isSending || !newMessage.trim()}
            size="sm"
            className="self-end"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};