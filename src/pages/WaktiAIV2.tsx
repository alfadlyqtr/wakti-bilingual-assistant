
import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { 
  Menu, 
  Send, 
  Mic, 
  MicOff, 
  Settings as SettingsIcon,
  MessageSquare,
  Zap,
  Search,
  Image as ImageIcon,
  User,
  Bot,
  ChevronLeft,
  Volume2,
  VolumeX,
  Plus
} from 'lucide-react';

// Import AI components
import { ChatBubble } from '@/components/wakti-ai-v2/ChatBubble';
import { TypingIndicator } from '@/components/wakti-ai-v2/TypingIndicator';
import { QuickActionsPanel } from '@/components/wakti-ai-v2/QuickActionsPanel';
import { ConversationsList } from '@/components/wakti-ai-v2/ConversationsList';
import { SearchModeIndicator } from '@/components/wakti-ai-v2/SearchModeIndicator';
import { BrowsingIndicator } from '@/components/wakti-ai-v2/BrowsingIndicator';
import { QuotaIndicator } from '@/components/wakti-ai-v2/QuotaIndicator';

// Services and hooks
import { WaktiAIV2Service } from '@/services/WaktiAIV2Service';
import { useQuotaManagement } from '@/hooks/useQuotaManagement';

// Types
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    trigger_mode?: string;
    browsing_used?: boolean;
    search_results?: any[];
    confidence_level?: string;
    intent?: string;
    action_taken?: string;
    action_result?: any;
  };
}

interface Conversation {
  id: string;
  title: string;
  last_message_at: string;
  created_at: string;
}

type TriggerMode = 'chat' | 'search' | 'advanced_search' | 'image';

export default function WaktiAIV2() {
  const { user } = useAuth();
  const { language } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeTrigger, setActiveTrigger] = useState<TriggerMode>('chat');
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [autoSpeech, setAutoSpeech] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [conversationsOpen, setConversationsOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { quota, checkQuota } = useQuotaManagement(language);

  // Load saved trigger mode from localStorage
  useEffect(() => {
    const savedTrigger = localStorage.getItem('wakti-ai-active-trigger') as TriggerMode;
    if (savedTrigger && ['chat', 'search', 'advanced_search', 'image'].includes(savedTrigger)) {
      setActiveTrigger(savedTrigger);
    }
  }, []);

  // Listen for trigger changes from QuickActionsPanel
  useEffect(() => {
    const handleTriggerChange = () => {
      const savedTrigger = localStorage.getItem('wakti-ai-active-trigger') as TriggerMode;
      if (savedTrigger && ['chat', 'search', 'advanced_search', 'image'].includes(savedTrigger)) {
        setActiveTrigger(savedTrigger);
      }
    };

    window.addEventListener('ai-trigger-change', handleTriggerChange);
    return () => window.removeEventListener('ai-trigger-change', handleTriggerChange);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load conversations on mount
  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  // Load conversation messages when selected
  useEffect(() => {
    if (currentConversationId) {
      loadConversationMessages(currentConversationId);
    }
  }, [currentConversationId]);

  const loadConversations = async () => {
    if (!user) return;
    
    try {
      console.log('🔍 WAKTI AI: Loading conversations for user:', user.id);
      const convos = await WaktiAIV2Service.getConversations(user.id);
      console.log('🔍 WAKTI AI: Loaded conversations:', convos);
      setConversations(convos);
    } catch (error) {
      console.error('🔍 WAKTI AI: Error loading conversations:', error);
    }
  };

  const loadConversationMessages = async (conversationId: string) => {
    if (!user) return;
    
    try {
      console.log('🔍 WAKTI AI: Loading messages for conversation:', conversationId);
      const msgs = await WaktiAIV2Service.getConversationMessages(conversationId);
      console.log('🔍 WAKTI AI: Loaded messages:', msgs);
      
      const formattedMessages: Message[] = msgs.map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: new Date(msg.created_at),
        metadata: {
          trigger_mode: msg.metadata?.trigger_mode,
          browsing_used: msg.browsing_used,
          search_results: msg.browsing_data?.search_results,
          confidence_level: msg.confidence_level,
          intent: msg.intent,
          action_taken: msg.action_taken,
          action_result: msg.action_result
        }
      }));
      
      setMessages(formattedMessages);
    } catch (error) {
      console.error('🔍 WAKTI AI: Error loading conversation messages:', error);
    }
  };

  const handleSendMessage = async (messageContent?: string) => {
    const content = messageContent || inputValue.trim();
    if (!content || !user) return;

    console.log('🔍 WAKTI AI: Sending message with trigger mode:', activeTrigger);

    // Check quota before proceeding
    const quotaCheck = await checkQuota(activeTrigger);
    if (!quotaCheck.canProceed) {
      console.log('🔍 WAKTI AI: Quota exceeded, cannot proceed');
      return;
    }

    // Clear input
    setInputValue('');
    setIsLoading(true);
    setIsBrowsing(['search', 'advanced_search'].includes(activeTrigger));

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      console.log('🔍 WAKTI AI: Processing message with brain service');
      const response = await WaktiAIV2Service.processMessage({
        message: content,
        userId: user.id,
        conversationId: currentConversationId,
        triggerMode: activeTrigger,
        language
      });

      console.log('🔍 WAKTI AI: Received response:', response);

      if (response.success && response.data) {
        // Update conversation ID if new conversation was created
        if (response.data.conversation_id && !currentConversationId) {
          setCurrentConversationId(response.data.conversation_id);
          // Reload conversations to show the new one
          await loadConversations();
        }

        // Add assistant message
        const assistantMessage: Message = {
          id: response.data.id,
          role: 'assistant',
          content: response.data.content,
          timestamp: new Date(),
          metadata: {
            trigger_mode: response.data.metadata?.trigger_mode,
            browsing_used: response.data.browsing_used,
            search_results: response.data.browsing_data?.search_results,
            confidence_level: response.data.confidence_level,
            intent: response.data.intent,
            action_taken: response.data.action_taken,
            action_result: response.data.action_result
          }
        };

        setMessages(prev => [...prev, assistantMessage]);

        // Auto-speak if enabled
        if (autoSpeech && response.data.content) {
          console.log('🔍 WAKTI AI: Auto-speaking response');
          WaktiAIV2Service.speakText(response.data.content, language);
        }
      } else {
        console.error('🔍 WAKTI AI: Failed to get valid response:', response);
        // Add error message
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: language === 'ar' 
            ? 'عذراً، حدث خطأ في معالجة رسالتك. يرجى المحاولة مرة أخرى.'
            : 'Sorry, there was an error processing your message. Please try again.',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('🔍 WAKTI AI: Error sending message:', error);
      // Add error message
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: language === 'ar' 
          ? 'عذراً، حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى.'
          : 'Sorry, there was a connection error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsBrowsing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const startNewConversation = () => {
    console.log('🔍 WAKTI AI: Starting new conversation');
    setCurrentConversationId(null);
    setMessages([]);
    inputRef.current?.focus();
  };

  const handleSelectConversation = (conversationId: string) => {
    console.log('🔍 WAKTI AI: Selecting conversation:', conversationId);
    setCurrentConversationId(conversationId);
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (!user) return;
    
    try {
      console.log('🔍 WAKTI AI: Deleting conversation:', conversationId);
      await WaktiAIV2Service.deleteConversation(conversationId, user.id);
      
      // If we're currently viewing the deleted conversation, start a new one
      if (currentConversationId === conversationId) {
        startNewConversation();
      }
      
      // Reload conversations
      await loadConversations();
      console.log('🔍 WAKTI AI: Successfully deleted conversation');
    } catch (error) {
      console.error('🔍 WAKTI AI: Error deleting conversation:', error);
    }
  };

  const handleTextGenerated = (text: string, mode: 'compose' | 'reply') => {
    if (mode === 'compose') {
      setInputValue(text);
      inputRef.current?.focus();
    } else if (mode === 'reply') {
      handleSendMessage(text);
    }
  };

  const getTriggerIcon = () => {
    switch (activeTrigger) {
      case 'search': return Search;
      case 'advanced_search': return Zap;
      case 'image': return ImageIcon;
      default: return MessageSquare;
    }
  };

  const getTriggerColor = () => {
    switch (activeTrigger) {
      case 'search': return 'text-green-500';
      case 'advanced_search': return 'text-purple-500';
      case 'image': return 'text-orange-500';
      default: return 'text-blue-500';
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">W</span>
              </div>
              <h1 className="text-lg font-semibold">
                {language === 'ar' ? 'وقتي الذكي' : 'WAKTI AI'}
              </h1>
            </div>
            
            {/* Current AI Mode Indicator */}
            <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-full bg-muted/50">
              {React.createElement(getTriggerIcon(), { className: cn("h-3 w-3", getTriggerColor()) })}
              <span className="text-xs font-medium">
                {activeTrigger === 'chat' && (language === 'ar' ? 'محادثة' : 'Chat')}
                {activeTrigger === 'search' && (language === 'ar' ? 'بحث' : 'Search')}
                {activeTrigger === 'advanced_search' && (language === 'ar' ? 'بحث متقدم' : 'Advanced Search')}
                {activeTrigger === 'image' && (language === 'ar' ? 'صورة' : 'Image')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Browsing/Search Indicator */}
            {isBrowsing && <BrowsingIndicator />}
            
            {/* Search Mode Indicator */}
            {(['search', 'advanced_search'].includes(activeTrigger)) && (
              <SearchModeIndicator mode={activeTrigger} />
            )}
            
            {/* Auto Speech Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAutoSpeech(!autoSpeech)}
              className={cn("h-8 w-8", autoSpeech && "text-primary")}
            >
              {autoSpeech ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>

            {/* New Conversation Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={startNewConversation}
              className="h-8 w-8"
            >
              <Plus className="h-4 w-4" />
            </Button>

            {/* Conversations Drawer */}
            <Drawer open={conversationsOpen} onOpenChange={setConversationsOpen}>
              <DrawerTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </DrawerTrigger>
              <DrawerContent className="h-[80vh]">
                <div className="p-4 h-full">
                  <ConversationsList
                    conversations={conversations}
                    currentConversationId={currentConversationId}
                    onSelectConversation={(id) => {
                      handleSelectConversation(id);
                      setConversationsOpen(false);
                    }}
                    onDeleteConversation={handleDeleteConversation}
                    onRefresh={loadConversations}
                  />
                </div>
              </DrawerContent>
            </Drawer>

            {/* Quick Actions Drawer */}
            <Drawer open={quickActionsOpen} onOpenChange={setQuickActionsOpen}>
              <DrawerTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Menu className="h-4 w-4" />
                </Button>
              </DrawerTrigger>
              <DrawerContent className="h-[80vh]">
                <div className="p-4 h-full">
                  <QuickActionsPanel
                    onSendMessage={handleSendMessage}
                    activeTrigger={activeTrigger}
                    onTriggerChange={setActiveTrigger}
                    onTextGenerated={handleTextGenerated}
                    onDrawerClose={() => setQuickActionsOpen(false)}
                  />
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        </div>

        {/* Quota Indicator */}
        <QuotaIndicator activeTrigger={activeTrigger} />
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4 min-h-full flex flex-col">
            {messages.length === 0 && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-4 max-w-md mx-auto">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto">
                    <MessageSquare className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold mb-2">
                      {language === 'ar' ? 'مرحباً! أنا وقتي الذكي' : 'Hello! I\'m WAKTI AI'}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      {language === 'ar' 
                        ? 'كيف يمكنني مساعدتك اليوم؟'
                        : 'How can I help you today?'
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {messages.map((message) => (
              <ChatBubble 
                key={message.id} 
                message={message} 
                onSpeak={(text) => WaktiAIV2Service.speakText(text, language)}
              />
            ))}
            
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 border-t bg-card/50 backdrop-blur-sm p-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={language === 'ar' 
                ? 'اكتب رسالتك أو استخدم الصوت...'
                : 'Type your message or use voice...'
              }
              disabled={isLoading}
              className="pr-12"
            />
            
            {/* Voice Recording Button */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "absolute right-1 top-1 h-8 w-8",
                isRecording && "text-red-500 animate-pulse"
              )}
              onClick={() => {
                // TODO: Implement voice recording
                console.log('Voice recording not yet implemented');
              }}
              disabled={isLoading}
            >
              {isRecording ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </Button>
          </div>
          
          <Button 
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim() || isLoading}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
