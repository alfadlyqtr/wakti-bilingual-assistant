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
  const [currentStatus, setCurrentStatus] = useState(submission.status);
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
      
      // Fetch the latest submission data
      const { data: latestSubmission, error } = await supabase
        .from('contact_submissions')
        .select('*')
        .eq('id', submission.id)
        .single();
      
      if (error) throw error;
      setCurrentStatus(latestSubmission.status);
      
      const messageList: ChatMessage[] = [];
      
      // Add initial message
      messageList.push({
        id: `initial_${submission.id}`,
        content: latestSubmission.message,
        sender_type: 'user',
        sender_id: null,
        created_at: latestSubmission.created_at,
        sender_name: latestSubmission.name
      });
      
      // Add all messages from the messages array
      if (latestSubmission.messages && Array.isArray(latestSubmission.messages)) {
        latestSubmission.messages.forEach((msg: any, index: number) => {
          messageList.push({
            id: `msg_${submission.id}_${index}`,
            content: msg.content,
            sender_type: msg.sender_type,
            sender_id: msg.sender_id || null,
            created_at: msg.created_at,
            sender_name: msg.sender_name
          });
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
          setCurrentStatus(updatedSubmission.status);
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
    if (currentStatus === 'closed') {
      toast.info('Chat is closed by WAKTI Support');
      return;
    }
    setNewMessage('');
    setIsSending(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Best-effort insert into chat_messages for realtime admin thread (user messages only)
      if (!isAdmin && user?.id) {
        try {
          await supabase
            .from('chat_messages')
            .insert({
              contact_submission_id: submission.id,
              sender_type: 'user',
              sender_id: user.id,
              content: messageContent,
            });
        } catch (e) {
          console.error('Best-effort chat_messages insert failed:', e);
          // Continue with JSON update fallback below
        }
      }
      
      // Get current messages array
      const { data: currentSubmission, error: fetchError } = await supabase
        .from('contact_submissions')
        .select('messages')
        .eq('id', submission.id)
        .single();
      
      if (fetchError) throw fetchError;
      
      const messages = currentSubmission?.messages || [];
      
      // Add new message to array
      messages.push({
        content: messageContent,
        sender_type: isAdmin ? 'admin' : 'user',
        sender_id: user?.id || null,
        sender_name: isAdmin ? 'WAKTI Support' : submission.name,
        created_at: new Date().toISOString()
      });
      
      // Update the submission with new messages array
      const updateData: any = {
        messages: messages,
        updated_at: new Date().toISOString()
      };
      
      // If admin is responding, also update status
      if (isAdmin && submission.status !== 'responded') {
        updateData.status = 'responded';
        updateData.responded_at = new Date().toISOString();
        updateData.responded_by = user?.id || null;
      }
      
      const { error: updateError } = await supabase
        .from('contact_submissions')
        .update(updateData)
        .eq('id', submission.id);
      
      if (updateError) throw updateError;
      
      // Reload messages to show the new one
      await loadMessages();
      
      toast.success('Message sent');
    } catch (error: any) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
      toast.error('Failed to send message. Please try again.');
      setNewMessage(messageContent); // Restore message on error
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
      case 'closed': return 'bg-gray-600';
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
            <Badge className={getStatusColor(currentStatus)}>
              {currentStatus}
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

        {currentStatus === 'closed' && (
          <div className="flex justify-center">
            <Badge variant="secondary" className="text-xs">Closed by WAKTI Support</Badge>
          </div>
        )}

        {/* Message input */}
        <div className="flex gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={currentStatus === 'closed' ? 'Chat closed by WAKTI Support' : 'Type your message...'}
            rows={2}
            className="flex-1"
            disabled={currentStatus === 'closed'}
          />
          <Button
            onClick={sendMessage}
            disabled={isSending || !newMessage.trim() || currentStatus === 'closed'}
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