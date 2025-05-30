import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { QuickActionsPanel } from '@/components/wakti-ai-v2/QuickActionsPanel';
import { PageContainer } from '@/components/PageContainer';
import { ConversationsList } from '@/components/wakti-ai-v2/ConversationsList';
import { NewConversationButton } from '@/components/wakti-ai-v2/NewConversationButton';
import { SearchModeIndicator } from '@/components/wakti-ai-v2/SearchModeIndicator';
import { QuotaIndicator } from '@/components/wakti-ai-v2/QuotaIndicator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { AdvancedSearchModeIndicator } from '@/components/wakti-ai-v2/AdvancedSearchModeIndicator';
import { ChatBubble } from '@/components/wakti-ai-v2/ChatBubble';
import { TypingIndicator } from '@/components/wakti-ai-v2/TypingIndicator';
import { cn } from '@/lib/utils';
import { AIMessage } from '@/services/WaktiAIV2Service';
import { MessageSquare, Camera, Mic, Settings, Send } from 'lucide-react';

const WaktiAIV2 = () => {
  const { language } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [activeTrigger, setActiveTrigger] = useState<'chat' | 'search' | 'advanced_search' | 'image'>('chat');
  const [userContext, setUserContext] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [currentConversation, setCurrentConversation] = useState<any>(null);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [conversationsDialogOpen, setConversationsDialogOpen] = useState(false);

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

  // Fetch conversations on initial load and whenever the user changes
  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  const handleSendMessage = useCallback(async (messageContent: string) => {
    if (!messageContent.trim()) return;

    const userMessage: AIMessage = { 
      id: crypto.randomUUID(),
      role: 'user', 
      content: messageContent,
      timestamp: new Date()
    };
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
      const aiMessage: AIMessage = { 
        id: crypto.randomUUID(),
        role: 'assistant', 
        content: data.content,
        timestamp: new Date()
      };
      setMessages(prevMessages => [...prevMessages, aiMessage]);

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
      setMessages(prevMessages => [...prevMessages, { 
        id: crypto.randomUUID(),
        role: 'assistant', 
        content: language === 'ar' ? 'عذراً، حدث خطأ ما' : 'Sorry, something went wrong',
        timestamp: new Date()
      }]);
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

  const handleSelectConversation = useCallback(async (conversationId: string) => {
    const conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) return;
    
    setCurrentConversation(conversation);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      // Map the messages to the correct format
      const formattedMessages: AIMessage[] = data.map((msg: any) => ({
        id: msg.id || crypto.randomUUID(),
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.created_at)
      }));

      setMessages(formattedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل جلب الرسائل' : 'Failed to fetch messages',
        variant: 'destructive'
      });
      setMessages([{ 
        id: crypto.randomUUID(),
        role: 'assistant', 
        content: language === 'ar' ? 'عذراً، حدث خطأ ما' : 'Sorry, something went wrong',
        timestamp: new Date()
      }]);
    }
  }, [conversations, language, toast]);

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

  const refreshConversations = useCallback(async () => {
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
  }, [user, toast]);

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

  return (
    <PageContainer>
      <div className="min-h-screen flex w-full relative">
        {/* Header */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-foreground">
                {language === 'ar' ? 'وقتي الذكي' : 'WAKTI AI'}
              </h1>
              <SearchModeIndicator isVisible={activeTrigger === 'search'} />
              <AdvancedSearchModeIndicator isVisible={activeTrigger === 'advanced_search'} />
            </div>

            <div className="flex items-center gap-3">
              <QuotaIndicator />
              <NewConversationButton onNewConversation={handleNewConversation} />
              
              <Dialog open={conversationsDialogOpen} onOpenChange={setConversationsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    {language === 'ar' ? 'المحادثات' : 'Conversations'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      {language === 'ar' ? 'المحادثات' : 'Conversations'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="max-h-96 overflow-y-auto">
                    <ConversationsList 
                      conversations={conversations}
                      currentConversationId={currentConversation?.id}
                      onSelectConversation={(id) => {
                        handleSelectConversation(id);
                        setConversationsDialogOpen(false);
                      }}
                      onDeleteConversation={handleDeleteConversation}
                      onRefresh={refreshConversations}
                    />
                  </div>
                </DialogContent>
              </Dialog>

              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowQuickActions(!showQuickActions)}
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                {language === 'ar' ? 'الإجراءات' : 'Actions'}
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 pt-20 pb-4">
          {/* Messages Area */}
          <div className="flex-1 flex flex-col h-[calc(100vh-120px)]">
            {/* Messages Panel */}
            <div className="flex-1 overflow-y-auto px-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <div className="text-6xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      {language === 'ar' ? 'وقتي الذكي' : 'WAKTI AI'}
                    </div>
                    <p className="text-lg font-medium mb-2">
                      {language === 'ar' ? 'مرحباً بك في وقتي الذكي' : 'Welcome to Wakti AI'}
                    </p>
                    <p className="text-sm">
                      {language === 'ar' ? 'ابدأ محادثة جديدة أو استخدم الإجراءات السريعة' : 'Start a new conversation or use quick actions'}
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message, index) => (
                  <ChatBubble key={`${message.id}-${index}`} message={message} />
                ))
              )}
              
              {isThinking && <TypingIndicator />}
            </div>

            {/* Message Input */}
            <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4">
              <div className="flex items-center gap-3 max-w-4xl mx-auto">
                <Button variant="ghost" size="icon" className="flex-shrink-0">
                  <Camera className="h-4 w-4" />
                </Button>
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
                <Button variant="ghost" size="icon" className="flex-shrink-0">
                  <Mic className="h-4 w-4" />
                </Button>
                <Button 
                  onClick={() => handleSendMessage(newMessage)} 
                  disabled={isThinking || !newMessage.trim()}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Quick Actions */}
        <div className={cn(
          "fixed top-20 right-0 h-[calc(100vh-80px)] w-80 bg-background border-l transform transition-transform duration-300 ease-in-out z-40",
          showQuickActions ? "translate-x-0" : "translate-x-full"
        )}>
          <div className="h-full overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-lg flex items-center justify-between">
                {language === 'ar' ? 'الإجراءات السريعة' : 'Quick Actions'}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowQuickActions(false)}
                  className="h-6 w-6 p-0"
                >
                  ×
                </Button>
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <QuickActionsPanel
                onSendMessage={(message) => {
                  handleSendMessage(message);
                  setShowQuickActions(false);
                }}
                activeTrigger={activeTrigger}
                onTriggerChange={setActiveTrigger}
              />
            </div>
          </div>
        </div>

        {/* Overlay */}
        {showQuickActions && (
          <div 
            className="fixed inset-0 bg-black/20 z-30 top-20"
            onClick={() => setShowQuickActions(false)}
          />
        )}
      </div>
    </PageContainer>
  );
};

export default WaktiAIV2;
