import React, { useState, useEffect, useRef } from 'react';
import { PageContainer } from '@/components/PageContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Loader2, Search, ImagePlus, Trash2, MessageSquare, Menu, X, Upload, Mic, Send } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ConversationsList } from '@/components/wakti-ai-v2/ConversationsList';
import { QuickActionsPanel } from '@/components/wakti-ai-v2/QuickActionsPanel';
import { WaktiAIV2Service, AIMessage, AIConversation } from '@/services/WaktiAIV2Service';
import { ChatBubble } from '@/components/wakti-ai-v2/ChatBubble';
import { QuotaDisplay } from '@/components/wakti-ai-v2/QuotaDisplay';
import { TextGenModal } from '@/components/wakti-ai-v2/TextGenModal';
import { useToastHelper } from "@/hooks/use-toast-helper";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { supabase } from '@/integrations/supabase/client';

const WaktiAIV2 = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [showConversations, setShowConversations] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [quotaStatus, setQuotaStatus] = useState<any>(null);
  const [searchConfirmationRequired, setSearchConfirmationRequired] = useState(false);
  const [activeTrigger, setActiveTrigger] = useState<string>('chat');
  const [textGenParams, setTextGenParams] = useState<any>(null);
  const scrollAreaRef = useRef<any>(null);
  const { language } = useTheme();
  const { showSuccess, showError } = useToastHelper();

  // Enhanced state for session management
  const [sessionMessages, setSessionMessages] = useState<AIMessage[]>([]);
  const [hasLoadedSession, setHasLoadedSession] = useState(false);

  useEffect(() => {
    const fetchQuota = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const quota = await WaktiAIV2Service.getOrFetchQuota(user.id);
        setQuotaStatus(quota);
      } catch (error: any) {
        console.error('Error fetching quota:', error);
        setError(error.message || 'Failed to fetch quota');
      }
    };

    fetchQuota();
  }, []);

  // Load chat session on component mount
  useEffect(() => {
    if (!hasLoadedSession) {
      const savedSession = WaktiAIV2Service.loadChatSession();
      if (savedSession) {
        console.log('📂 Restoring chat session...');
        setSessionMessages(savedSession.messages || []);
        if (savedSession.conversationId) {
          setCurrentConversationId(savedSession.conversationId);
        }
      }
      setHasLoadedSession(true);
    }
  }, [hasLoadedSession]);

  // Save session whenever messages change
  useEffect(() => {
    if (hasLoadedSession && sessionMessages.length > 0) {
      WaktiAIV2Service.saveChatSession(sessionMessages, currentConversationId);
    }
  }, [sessionMessages, currentConversationId, hasLoadedSession]);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const fetchedConversations = await WaktiAIV2Service.getConversations();
        setConversations(fetchedConversations);
      } catch (error: any) {
        console.error('Error fetching conversations:', error);
        setError(error.message || 'Failed to fetch conversations');
      }
    };

    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const fetchedConversations = await WaktiAIV2Service.getConversations();
      setConversations(fetchedConversations);
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
      setError(error.message || 'Failed to fetch conversations');
    }
  };

  const quotaManagement = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const quota = await WaktiAIV2Service.getOrFetchQuota(user.id);
      setQuotaStatus(quota);
    } catch (error: any) {
      console.error('Error fetching quota:', error);
      setError(error.message || 'Failed to fetch quota');
    }
  };

  const handleSendMessage = async (message: string, inputType: 'text' | 'voice' = 'text') => {
    if (!message.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔄 WAKTI AI V2: === SEND MESSAGE START ===');
      console.log('🔄 WAKTI AI V2: Message:', message);
      console.log('🔄 WAKTI AI V2: Active Trigger (MAIN):', activeTrigger);
      console.log('🔄 WAKTI AI V2: Current Conversation ID:', currentConversationId);

      // Create user message
      const userMessage: AIMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date(),
        inputType
      };

      // Add user message to session (limit to 20 messages)
      const updatedMessages = [...sessionMessages, userMessage].slice(-20);
      setSessionMessages(updatedMessages);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Send message
      const response = await WaktiAIV2Service.sendMessage(
        message,
        user.id,
        language,
        currentConversationId,
        inputType,
        updatedMessages.slice(-10), // Send last 10 messages for context
        false, // confirmSearch
        activeTrigger,
        textGenParams
      );

      console.log('🔄 WAKTI AI V2: === RESPONSE RECEIVED ===');
      console.log('🔄 WAKTI AI V2: Response:', response.response?.substring(0, 100) + '...');
      console.log('🔄 WAKTI AI V2: Conversation ID:', response.conversationId);

      if (response.error) {
        throw new Error(response.error);
      }

      // Update conversation ID if new
      if (response.conversationId && response.conversationId !== currentConversationId) {
        setCurrentConversationId(response.conversationId);
        console.log('🔄 WAKTI AI V2: Updated conversation ID:', response.conversationId);
      }

      // Create assistant message
      const assistantMessage: AIMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        intent: response.intent,
        confidence: response.confidence as 'high' | 'medium' | 'low',
        actionTaken: !!response.actionTaken,
        browsingUsed: response.browsingUsed,
        browsingData: response.browsingData,
        quotaStatus: response.quotaStatus,
        requiresSearchConfirmation: response.requiresSearchConfirmation,
        imageUrl: response.imageUrl,
        isTextGenerated: activeTrigger === 'image' && !!response.imageUrl
      };

      // Add assistant message to session (limit to 20 messages)
      const finalMessages = [...updatedMessages, assistantMessage].slice(-20);
      setSessionMessages(finalMessages);

      // Update quota if present
      if (response.quotaStatus) {
        setQuotaStatus(response.quotaStatus);
      }

      // Handle search confirmation requirement
      if (response.requiresSearchConfirmation) {
        setSearchConfirmationRequired(true);
      }

      // Refresh conversations list
      fetchConversations();

    } catch (error: any) {
      console.error('🔄 WAKTI AI V2: ❌ Send message error:', error);
      setError(error.message || 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchConfirmation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const response = await WaktiAIV2Service.sendMessageWithSearchConfirmation(
        message,
        currentConversationId,
        language
      );

      if (response.error) {
        throw new Error(response.error);
      }

      // Update conversation ID if new
      if (response.conversationId && response.conversationId !== currentConversationId) {
        setCurrentConversationId(response.conversationId);
      }

      // Create assistant message
      const assistantMessage: AIMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        intent: response.intent,
        confidence: response.confidence as 'high' | 'medium' | 'low',
        actionTaken: !!response.actionTaken,
        browsingUsed: response.browsingUsed,
        browsingData: response.browsingData,
        quotaStatus: response.quotaStatus,
        requiresSearchConfirmation: response.requiresSearchConfirmation,
        imageUrl: response.imageUrl,
        isTextGenerated: activeTrigger === 'image' && !!response.imageUrl
      };

      // Add assistant message to session (limit to 20 messages)
      const finalMessages = [...sessionMessages, assistantMessage].slice(-20);
      setSessionMessages(finalMessages);

      // Update quota if present
      if (response.quotaStatus) {
        setQuotaStatus(response.quotaStatus);
      }

      setSearchConfirmationRequired(false);
      fetchConversations();

    } catch (error: any) {
      console.error('Error confirming search:', error);
      setError(error.message || 'Failed to confirm search');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewConversation = () => {
    console.log('🆕 Starting new conversation...');
    setCurrentConversationId(null);
    setSessionMessages([]);
    WaktiAIV2Service.clearChatSession();
    setSearchConfirmationRequired(false);
    setError(null);
    
    // Close conversations drawer on mobile
    setShowConversations(false);
  };

  const handleSelectConversation = async (conversationId: string) => {
    try {
      console.log('📂 Loading conversation:', conversationId);
      setIsLoading(true);
      
      const messages = await WaktiAIV2Service.getConversationMessages(conversationId);
      
      // Convert database messages to AIMessage format
      const convertedMessages: AIMessage[] = messages.map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: new Date(msg.created_at),
        intent: msg.intent,
        confidence: msg.confidence_level as 'high' | 'medium' | 'low',
        actionTaken: !!msg.action_taken,
        inputType: msg.input_type as 'text' | 'voice',
        browsingUsed: msg.browsing_used,
        browsingData: msg.browsing_data,
        quotaStatus: msg.quota_status
      }));
      
      // Limit to 20 most recent messages for the session
      const limitedMessages = convertedMessages.slice(-20);
      
      setCurrentConversationId(conversationId);
      setSessionMessages(limitedMessages);
      setSearchConfirmationRequired(false);
      setError(null);
      
      console.log('📂 Loaded conversation with', limitedMessages.length, 'messages');
      
    } catch (error: any) {
      console.error('❌ Error loading conversation:', error);
      setError('Failed to load conversation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    console.log('🗑️ Clearing current chat session...');
    setSessionMessages([]);
    WaktiAIV2Service.clearChatSession();
    setSearchConfirmationRequired(false);
    setError(null);
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await WaktiAIV2Service.deleteConversation(conversationId);
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      if (currentConversationId === conversationId) {
        setCurrentConversationId(null);
        setSessionMessages([]);
      }
      showSuccess(
        language === 'ar' ? 'تم حذف المحادثة بنجاح' : 'Conversation deleted successfully'
      );
    } catch (error: any) {
      console.error('Error deleting conversation:', error);
      setError(error.message || 'Failed to delete conversation');
      showError(
        error.message || (language === 'ar' ? 'فشل في حذف المحادثة' : 'Failed to delete conversation')
      );
    }
  };

  const handleTriggerChange = (trigger: string) => {
    setActiveTrigger(trigger);
    console.log('✨ Active trigger set to:', trigger);
  };

  const handleTextGenParams = (params: any) => {
    setTextGenParams(params);
    console.log('✨ Text gen params set to:', params);
  };

  const getTriggerDisplayName = () => {
    switch (activeTrigger) {
      case 'chat':
        return language === 'ar' ? 'محادثة' : 'Chat';
      case 'search':
        return language === 'ar' ? 'بحث' : 'Search';
      case 'image':
        return language === 'ar' ? 'صورة' : 'Image';
      case 'advanced_search':
        return language === 'ar' ? 'بحث متقدم' : 'Advanced';
      default:
        return language === 'ar' ? 'محادثة' : 'Chat';
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Left Drawer - Conversations */}
      <Sheet open={showConversations} onOpenChange={setShowConversations}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>{language === 'ar' ? 'المحادثات' : 'Conversations'}</SheetTitle>
            <SheetDescription>
              {language === 'ar'
                ? 'اختر محادثة موجودة أو ابدأ واحدة جديدة.'
                : 'Select an existing conversation or start a new one.'}
            </SheetDescription>
          </SheetHeader>
          <ConversationsList
            conversations={conversations}
            currentConversationId={currentConversationId}
            onSelectConversation={handleSelectConversation}
            onDeleteConversation={handleDeleteConversation}
            onRefresh={fetchConversations}
            onClose={() => setShowConversations(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Right Drawer - Quick Actions */}
      <Sheet open={showQuickActions} onOpenChange={setShowQuickActions}>
        <SheetContent side="right" className="w-80 p-4">
          <QuickActionsPanel
            onSendMessage={handleSendMessage}
            activeTrigger={activeTrigger as any}
            onTriggerChange={handleTriggerChange}
            onClose={() => setShowQuickActions(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative">
        {/* Active Mode Background Indicator */}
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-10 pointer-events-none">
          <div className="px-2 py-0.5 bg-muted/10 text-muted-foreground text-xs font-medium rounded-full border border-border/5 backdrop-blur-sm opacity-40">
            {getTriggerDisplayName()}
          </div>
        </div>
        
        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Search Confirmation */}
          {searchConfirmationRequired && (
            <div className="bg-yellow-100 border-b p-4">
              <p className="text-sm text-yellow-800">
                {language === 'ar'
                  ? 'هل تريد إجراء بحث على الإنترنت؟'
                  : 'Do you want to perform an internet search?'}
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={handleSearchConfirmation}>
                  {language === 'ar' ? 'نعم، ابحث' : 'Yes, Search'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchConfirmationRequired(false)}
                >
                  {language === 'ar' ? 'لا، شكراً' : 'No, Thanks'}
                </Button>
              </div>
            </div>
          )}
          
          {/* Error Display */}
          {error && (
            <div className="bg-red-100 border-b p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          
          {/* Chat Messages */}
          <ScrollArea 
            className="flex-1 px-4"
            ref={scrollAreaRef}
          >
            <div className="max-w-4xl mx-auto py-4 space-y-6">
              {sessionMessages.length === 0 && !isLoading && (
                <div className="text-center py-12">
                  <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">
                    {language === 'ar' ? 'مرحباً بك في WAKTI AI' : 'Welcome to WAKTI AI'}
                  </h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    {language === 'ar' 
                      ? 'ابدأ محادثة جديدة. يمكنني مساعدتك في المهام، البحث، إنشاء الصور والمزيد.'
                      : 'Start a new conversation. I can help with tasks, search, image generation, and more.'
                    }
                  </p>
                  <div className="mt-4 text-xs text-muted-foreground">
                    {language === 'ar' 
                      ? 'المحادثة الحالية تحتفظ بآخر 20 رسالة'
                      : 'Current chat keeps last 20 messages'
                    }
                  </div>
                </div>
              )}

              {/* Message Count Indicator */}
              {sessionMessages.length > 15 && (
                <div className="text-center py-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-muted rounded-full text-xs text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    <span>
                      {sessionMessages.length}/20 {language === 'ar' ? 'رسالة' : 'messages'}
                    </span>
                    {sessionMessages.length >= 20 && (
                      <span className="text-orange-500">
                        {language === 'ar' ? '(ممتلئ)' : '(full)'}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {sessionMessages.map((message) => (
                <ChatBubble
                  key={message.id}
                  message={message}
                  activeTrigger={activeTrigger}
                />
              ))}

              {isLoading && (
                <div className="flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    {language === 'ar' ? 'جارٍ التحميل...' : 'Loading...'}
                  </span>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Enhanced Input Area */}
          <div className="border-t bg-gradient-to-t from-background/95 to-background/90 backdrop-blur-md">
            {/* Clear Chat Button */}
            {sessionMessages.length > 0 && (
              <div className="px-6 py-3 border-b border-border/50">
                <div className="max-w-4xl mx-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearChat}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    {language === 'ar' ? 'مسح المحادثة' : 'Clear Chat'}
                  </Button>
                </div>
              </div>
            )}

            {/* Main Input Container */}
            <div className="px-6 py-6">
              <div className="max-w-4xl mx-auto">
                {/* Action Icons Above Input */}
                <div className="flex items-center justify-center gap-8 mb-4">
                  <div 
                    className="p-2 rounded-full bg-muted/50 hover:bg-muted cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95" 
                    onClick={() => setShowConversations(true)}
                  >
                    <MessageSquare className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                  </div>
                  {currentConversationId && (
                    <div 
                      className="p-2 rounded-full bg-muted/50 hover:bg-muted cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95" 
                      onClick={handleNewConversation}
                    >
                      <X className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                    </div>
                  )}
                  <div 
                    className="p-2 rounded-full bg-muted/50 hover:bg-muted cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95" 
                    onClick={() => setShowQuickActions(true)}
                  >
                    <Menu className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                  </div>
                </div>

                {/* Input Row with Send Button */}
                <div className="flex items-end gap-4 mb-4">
                  <div className="flex-1 relative">
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={
                        language === 'ar' ? 'اكتب رسالتك هنا...' : 'Type your message here...'
                      }
                      rows={1}
                      className="resize-none border-2 border-border/50 rounded-2xl px-4 py-3 pr-12 bg-muted/20 focus:bg-background focus:border-primary/50 transition-all duration-200 shadow-sm hover:shadow-md"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(message);
                          setMessage('');
                        }
                      }}
                    />
                  </div>
                  <Button
                    onClick={() => {
                      handleSendMessage(message);
                      setMessage('');
                    }}
                    disabled={isLoading || !message.trim()}
                    className="h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
                    size="icon"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </Button>
                </div>

                {/* Action Icons Below Input */}
                <div className="flex items-center justify-center gap-8">
                  <div className="p-2 rounded-full bg-muted/50 hover:bg-muted cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95">
                    <Upload className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                  </div>
                  <div className="p-2 rounded-full bg-muted/50 hover:bg-muted cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95">
                    <Mic className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaktiAIV2;
