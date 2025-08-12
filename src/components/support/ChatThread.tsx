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
  admin_response?: string;
  responded_at?: string;
  updated_at?: string;
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
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    const cleanup = setupRealtimeSubscription();
    return cleanup;
  }, [submission.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      setError(null);
      // For support chat, we only have the initial message and admin responses in contact_submissions
      // Create a simple message list from the contact submission data
      const messageList: ChatMessage[] = [];
      
      // Add initial user message
      messageList.push({
        id: `initial_${submission.id}`,
        content: submission.message,
        sender_type: 'user',
        sender_id: null,
        created_at: submission.created_at,
        sender_name: submission.name
      });
      
      // Add admin response if exists
      if (submission.admin_response) {
        messageList.push({
          id: `admin_response_${submission.id}`,
          content: submission.admin_response,
          sender_type: 'admin', 
          sender_id: null,
          created_at: submission.responded_at || submission.updated_at,
          sender_name: 'WAKTI Support'
        });
      }

      setMessages(messageList);
    } catch (error: any) {
      console.error('Error loading messages:', error);
      setError('Failed to load messages');
      toast.error('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`contact_submission_${submission.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'contact_submissions',
          filter: `id=eq.${submission.id}`
        },
        (payload) => {
          const updatedSubmission = payload.new as any;
          // Reload messages when contact_submissions is updated (admin response added)
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const messageContent = newMessage.trim();
    const tempId = `temp_${Date.now()}`;
    
    // Optimistic update - add message immediately
    const optimisticMessage: ChatMessage = {
      id: tempId,
      content: messageContent,
      sender_type: isAdmin ? 'admin' : 'user',
      sender_id: null,
      created_at: new Date().toISOString(),
      sender_name: isAdmin ? 'WAKTI Support' : submission.name
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    setIsSending(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (isAdmin) {
        // Admin sending response - update contact_submissions table
        const { error } = await supabase
          .from('contact_submissions')
          .update({ 
            admin_response: messageContent,
            status: 'responded',
            responded_at: new Date().toISOString(),
            responded_by: user?.id || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', submission.id);

        if (error) throw error;

        // Replace optimistic message with real one
        setMessages(prev => prev.map(msg => 
          msg.id === tempId 
            ? { 
                id: `admin_response_${submission.id}`,
                content: messageContent,
                sender_type: 'admin',
                sender_id: user?.id || null,
                created_at: new Date().toISOString(),
                sender_name: 'WAKTI Support'
              }
            : msg
        ));
      } else {
        // User sending new message - this shouldn't happen in support chat
        // Users can only send the initial message through contact form
        throw new Error('Users cannot send additional messages in support chat');
      }

    } catch (error: any) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
      toast.error('Failed to send message. Please try again.');
      
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      
      // Restore the message content
      setNewMessage(messageContent);
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