
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Send, Mic, Image, Paperclip, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { VoiceRecorder } from './VoiceRecorder';
import { useTheme } from '@/providers/ThemeProvider';

interface Contact {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
}

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  message_type: 'text' | 'voice' | 'image';
  attachment_url?: string;
  is_read: boolean;
  created_at: string;
  expires_at: string;
}

interface ChatPopupProps {
  contact: Contact;
  onClose: () => void;
}

export function ChatPopup({ contact, onClose }: ChatPopupProps) {
  const { user } = useAuth();
  const { language } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const t = {
    en: {
      chatWith: "Chat with",
      typeMessage: "Type a message...",
      send: "Send",
      voice: "Voice",
      image: "Image",
      attach: "Attach",
      expires: "Expires",
      today: "Today",
      yesterday: "Yesterday",
      noMessages: "No messages yet",
      startConversation: "Start a conversation",
    },
    ar: {
      chatWith: "محادثة مع",
      typeMessage: "اكتب رسالة...",
      send: "إرسال",
      voice: "صوت",
      image: "صورة",
      attach: "إرفاق",
      expires: "تنتهي في",
      today: "اليوم",
      yesterday: "أمس",
      noMessages: "لا توجد رسائل بعد",
      startConversation: "ابدأ محادثة",
    }
  }[language];

  useEffect(() => {
    fetchMessages();
    markMessagesAsRead();
  }, [contact.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${contact.id}),and(sender_id.eq.${contact.id},recipient_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const markMessagesAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('sender_id', contact.id)
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const handleSendMessage = async (content: string, messageType: 'text' | 'voice' | 'image' = 'text', attachmentUrl?: string) => {
    if (!user || !content.trim()) return;

    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          recipient_id: contact.id,
          content,
          message_type: messageType,
          attachment_url: attachmentUrl,
          expires_at: expiresAt.toISOString()
        });

      if (error) throw error;

      setNewMessage('');
      fetchMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const handleVoiceMessage = async (audioBlob: Blob, duration: number) => {
    if (!user) return;

    try {
      const fileName = `voice-${Date.now()}.wav`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('voice-messages')
        .upload(fileName, audioBlob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('voice-messages')
        .getPublicUrl(fileName);

      await handleSendMessage(`Voice message (${duration}s)`, 'voice', publicUrl);
      setShowVoiceRecorder(false);
    } catch (error) {
      console.error('Error sending voice message:', error);
      toast.error('Failed to send voice message');
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isYesterday) return `${t.yesterday} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return date.toLocaleDateString();
  };

  const getTimeUntilExpiry = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return 'Soon';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md h-[600px] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={contact.avatar_url} />
                <AvatarFallback>
                  {contact.display_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg">{contact.display_name}</CardTitle>
                <CardDescription>@{contact.username}</CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {loading ? (
              <div className="text-center py-8">Loading messages...</div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <div>{t.noMessages}</div>
                <div className="text-sm">{t.startConversation}</div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] p-3 rounded-lg ${
                        message.sender_id === user?.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="break-words">{message.content}</div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <div className="text-xs opacity-70">
                          {formatMessageTime(message.created_at)}
                        </div>
                        <div className="text-xs opacity-70 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {getTimeUntilExpiry(message.expires_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="border-t p-4 flex-shrink-0">
            {showVoiceRecorder ? (
              <VoiceRecorder
                onRecordingComplete={handleVoiceMessage}
                onCancel={() => setShowVoiceRecorder(false)}
              />
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowVoiceRecorder(true)}
                >
                  <Mic className="h-4 w-4" />
                </Button>
                <Input
                  placeholder={t.typeMessage}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSendMessage(newMessage);
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  onClick={() => handleSendMessage(newMessage)}
                  disabled={!newMessage.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
