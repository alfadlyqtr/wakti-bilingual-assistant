import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ModeToggle } from '@/components/ModeToggle';
import { QuickActionsPanel } from '@/components/wakti-ai-v2/QuickActionsPanel';
import { PageContainer } from '@/components/PageContainer';
import { MessagesPanel } from '@/components/wakti-ai-v2/MessagesPanel';
import { ConversationsList } from '@/components/wakti-ai-v2/ConversationsList';
import { SearchModeIndicator } from '@/components/wakti-ai-v2/SearchModeIndicator';
import { QuotaIndicator } from '@/components/wakti-ai-v2/QuotaIndicator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast"
import { cn } from '@/lib/utils';
import { AdvancedSearchModeIndicator } from '@/components/wakti-ai-v2/AdvancedSearchModeIndicator';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const WaktiAIV2 = () => {
  const { language } = useTheme();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [activeTrigger, setActiveTrigger] = useState<'chat' | 'search' | 'advanced_search' | 'image'>('chat');
  const [userContext, setUserContext] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [currentConversation, setCurrentConversation] = useState<any>(null);

  // Load trigger from localStorage on initial load
  useEffect(() => {
    const storedTrigger = localStorage.getItem('wakti-ai-active-trigger') as 'chat' | 'search' | 'advanced_search' | 'image' | null;
    if (storedTrigger) {
      setActiveTrigger(storedTrigger);
    }
  }, []);

  // Load user context on initial load
  useEffect(() => {
    const fetchUserContext = async () => {
      if (user) {
        // Simulate fetching user context (replace with actual data fetching)
        const context = {
          name: user.email?.split('@')[0] || 'User',
          email: user.email,
          lastLogin: new Date().toLocaleDateString()
        };
        setUserContext(context);
      }
    };

    fetchUserContext();
  }, [user]);

  const handleSendMessage = useCallback(async (messageContent: string) => {
    if (!messageContent.trim()) return;

    const userMessage: Message = { role: 'user', content: messageContent };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setNewMessage('');
    setIsThinking(true);

    try {
      const response = await fetch('/api/wakti-ai-v2-brain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          messages: [...messages, userMessage],
          activeTrigger: activeTrigger,
          language: language,
          userContext: userContext
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const aiMessage: Message = { role: 'assistant', content: data.content };
      setMessages(prevMessages => [...prevMessages, aiMessage]);

      // Save the conversation if a current conversation exists
      if (currentConversation) {
        await saveMessageToConversation(currentConversation.id, userMessage.content, aiMessage.content);
      }
    } catch (error) {
      console.error('Could not send message:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل إرسال الرسالة' : 'Failed to send message',
        variant: 'destructive'
      });
      setMessages(prevMessages => [...prevMessages, { role: 'assistant', content: language === 'ar' ? 'عذراً، حدث خطأ ما' : 'Sorry, something went wrong' }]);
    } finally {
      setIsThinking(false);
    }
  }, [messages, activeTrigger, language, userContext, currentConversation, toast]);

  const handleNewConversation = useCallback(async () => {
    // Clear messages and create a new conversation
    setMessages([]);
    setCurrentConversation(null);

    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user?.id,
          title: language === 'ar' ? 'محادثة جديدة' : 'New Conversation',
          language: language
        })
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      // Optimistically update the conversations list
      setConversations(prevConversations => [data, ...prevConversations]);
      setCurrentConversation(data);
    } catch (error) {
      console.error('Error creating new conversation:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل إنشاء محادثة جديدة' : 'Failed to create new conversation',
        variant: 'destructive'
      });
    }
  }, [user, language, toast]);

  const handleSelectConversation = useCallback(async (conversation: any) => {
    setCurrentConversation(conversation);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      // Map the messages to the correct format
      const formattedMessages = data.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      }));

      setMessages(formattedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل جلب الرسائل' : 'Failed to fetch messages',
        variant: 'destructive'
      });
      setMessages([{ role: 'assistant', content: language === 'ar' ? 'عذراً، حدث خطأ ما' : 'Sorry, something went wrong' }]);
    }
  }, [language, toast]);

  const handleDeleteConversation = useCallback(async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (error) {
        throw error;
      }

      // Optimistically update the conversations list
      setConversations(prevConversations => prevConversations.filter(c => c.id !== conversationId));
      // If the deleted conversation is the current one, clear the messages and current conversation
      if (currentConversation?.id === conversationId) {
        setMessages([]);
        setCurrentConversation(null);
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل حذف المحادثة' : 'Failed to delete conversation',
        variant: 'destructive'
      });
    }
  }, [currentConversation, language, toast]);

  const saveMessageToConversation = useCallback(async (conversationId: string, userMessage: string, aiMessage: string) => {
    try {
      // Insert both user and AI messages into the messages table
      const messagesToInsert = [
        { conversation_id: conversationId, role: 'user', content: userMessage },
        { conversation_id: conversationId, role: 'assistant', content: aiMessage },
      ];

      const { error } = await supabase
        .from('messages')
        .insert(messagesToInsert);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error saving message to conversation:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل حفظ الرسالة في المحادثة' : 'Failed to save message to conversation',
        variant: 'destructive'
      });
    }
  }, [toast]);

  // Fetch conversations on initial load and whenever the user changes
  useEffect(() => {
    const fetchConversations = async () => {
      if (user) {
        try {
          const { data, error } = await supabase
            .from('conversations')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (error) {
            throw error;
          }

          setConversations(data || []);
        } catch (error) {
          console.error('Error fetching conversations:', error);
          toast({
            title: language === 'ar' ? 'خطأ' : 'Error',
            description: language === 'ar' ? 'فشل جلب المحادثات' : 'Failed to fetch conversations',
            variant: 'destructive'
          });
        }
      }
    };

    fetchConversations();
  }, [user, toast]);

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {language === 'ar' ? 'وقتي الذكي' : 'Wakti AI'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' ? 'مساعدك الذكي المتطور' : 'Your Advanced AI Assistant'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <SearchModeIndicator isVisible={activeTrigger === 'search'} />
          <AdvancedSearchModeIndicator isVisible={activeTrigger === 'advanced_search'} />
          <QuotaIndicator />
          <ConversationsList 
            conversations={conversations}
            currentConversation={currentConversation}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
            onDeleteConversation={handleDeleteConversation}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-150px)]">
        {/* Left Panel: Quick Actions */}
        <aside className="col-span-1 lg:col-span-1 h-full">
          <QuickActionsPanel
            onSendMessage={handleSendMessage}
            activeTrigger={activeTrigger}
            onTriggerChange={setActiveTrigger}
          />
        </aside>

        {/* Right Panel: Messages */}
        <main className="col-span-1 lg:col-span-3 flex flex-col h-full">
          <MessagesPanel 
            messages={messages}
            isThinking={isThinking}
          />

          {/* Message Input */}
          <div className="mt-4 flex items-center gap-3 border-t border-border/50 pt-4">
            <Input
              type="text"
              placeholder={language === 'ar' ? 'اكتب رسالتك هنا...' : 'Type your message here...'}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(newMessage);
                }
              }}
              disabled={isThinking}
              className="flex-1"
            />
            <Button onClick={() => handleSendMessage(newMessage)} disabled={isThinking}>
              {language === 'ar' ? 'إرسال' : 'Send'}
            </Button>
          </div>
        </main>
      </div>
    </PageContainer>
  );
};

export default WaktiAIV2;
