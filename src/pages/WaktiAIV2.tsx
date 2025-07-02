import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { WaktiAIV2Service, WaktiAIV2ServiceClass, AIMessage, AIConversation } from '@/services/WaktiAIV2Service';
import { useToastHelper } from "@/hooks/use-toast-helper";
import { useExtendedQuotaManagement } from '@/hooks/useExtendedQuotaManagement';
import { useQuotaManagement } from '@/hooks/useQuotaManagement';
import { useAIQuotaManagement } from '@/hooks/useAIQuotaManagement';
import { supabase } from '@/integrations/supabase/client';
import { ChatHeader } from '@/components/wakti-ai-v2/ChatHeader';
import { ChatMessages } from '@/components/wakti-ai-v2/ChatMessages';
import { ChatInput } from '@/components/wakti-ai-v2/ChatInput';
import { ChatDrawers } from '@/components/wakti-ai-v2/ChatDrawers';
import { NotificationBars } from '@/components/wakti-ai-v2/NotificationBars';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';

// Debounced request handler
const useDebounceCallback = (callback: Function, delay: number) => {
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  return useCallback((...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
};

const WaktiAIV2 = () => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [showConversations, setShowConversations] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [activeTrigger, setActiveTrigger] = useState<string>('chat');
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // ENHANCED: Task confirmation state - ONLY for explicit task creation
  const [showTaskConfirmation, setShowTaskConfirmation] = useState(false);
  const [pendingTaskData, setPendingTaskData] = useState<any>(null);
  const [pendingReminderData, setPendingReminderData] = useState<any>(null);
  const [taskConfirmationLoading, setTaskConfirmationLoading] = useState(false);
  
  // Request management state with timeout protection
  const [requestInProgress, setRequestInProgress] = useState(false);
  const [requestTimeout, setRequestTimeout] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // ENHANCED: Personal touch state
  const [personalTouch, setPersonalTouch] = useState<any>(null);
  
  // NEW: Scroll button state
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { language } = useTheme();
  const { showSuccess, showError } = useToastHelper();

  // Simplified quota management
  const { quota: aiQuota, fetchQuota: fetchAIQuota } = useAIQuotaManagement();
  const { refreshVoiceQuota } = useExtendedQuotaManagement(language);
  const {
    userQuota: translationQuota,
    refreshTranslationQuota,
    incrementTranslationCount,
    MAX_DAILY_TRANSLATIONS
  } = useQuotaManagement(language);

  // FIXED: Unified message state - no more separate session/conversation messages
  const [allMessages, setAllMessages] = useState<AIMessage[]>([]);
  const [hasLoadedSession, setHasLoadedSession] = useState(false);
  const [isNewConversation, setIsNewConversation] = useState(true);

  // NEW: Scroll detection for scroll button
  useEffect(() => {
    const checkScrollPosition = () => {
      if (scrollAreaRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        setShowScrollButton(!isNearBottom && allMessages.length > 3);
      }
    };

    const scrollContainer = scrollAreaRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', checkScrollPosition);
      // Check initial position
      checkScrollPosition();
      return () => scrollContainer.removeEventListener('scroll', checkScrollPosition);
    }
  }, [allMessages.length]);

  // Manual scroll to bottom function
  const handleScrollToBottom = () => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth'
      });
      setShowScrollButton(false);
    }
  };

  // ENHANCED: Load personal touch settings with better caching
  useEffect(() => {
    const loadPersonalTouch = () => {
      try {
        const stored = localStorage.getItem('wakti_personal_touch');
        if (stored) {
          const personalTouchData = JSON.parse(stored);
          setPersonalTouch(personalTouchData);
          console.log('🎯 Personal Touch Loaded:', personalTouchData);
        } else {
          // Set smart defaults based on language
          const defaultPersonalTouch = {
            nickname: '',
            tone: 'neutral',
            style: language === 'ar' ? 'detailed' : 'detailed',
            instruction: '',
            aiNickname: language === 'ar' ? 'وقتي' : 'Wakti'
          };
          setPersonalTouch(defaultPersonalTouch);
          console.log('🎯 Default Personal Touch Set:', defaultPersonalTouch);
        }
      } catch (error) {
        console.warn('Failed to load personal touch settings:', error);
      }
    };
    
    loadPersonalTouch();
  }, [language]);

  // ULTRA-FAST: Minimal user profile loading with caching
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        // Check cache first
        const cached = localStorage.getItem('wakti_user_profile');
        if (cached) {
          const { profile, expires } = JSON.parse(cached);
          if (Date.now() < expires) {
            setUserProfile(profile);
            return;
          }
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();

        setUserProfile(profile);
        
        // Cache for 10 minutes
        localStorage.setItem('wakti_user_profile', JSON.stringify({
          profile,
          expires: Date.now() + (10 * 60 * 1000)
        }));
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchUserProfile();
  }, []);

  // FIXED: Improved session loading with proper conversation persistence
  useEffect(() => {
    if (!hasLoadedSession) {
      const savedSession = WaktiAIV2Service.loadChatSession();
      if (savedSession && savedSession.messages && savedSession.messages.length > 0) {
        console.log('🔄 PERSISTENCE: Restoring previous session with', savedSession.messages.length, 'messages');
        setAllMessages(savedSession.messages);
        if (savedSession.conversationId) {
          setCurrentConversationId(savedSession.conversationId);
        }
        setIsNewConversation(false); // This is a continuing conversation
      } else {
        console.log('🔄 PERSISTENCE: No previous session found, starting fresh');
        setIsNewConversation(true);
      }
      setHasLoadedSession(true);
    }
  }, [hasLoadedSession]);

  // FIXED: Auto-save with proper persistence
  useEffect(() => {
    if (hasLoadedSession && allMessages.length > 0) {
      console.log('💾 PERSISTENCE: Auto-saving session with', allMessages.length, 'messages');
      WaktiAIV2Service.saveChatSession(allMessages, currentConversationId);
    }
  }, [allMessages, currentConversationId, hasLoadedSession]);

  // ULTRA-FAST: Lazy-load conversations
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const fetchedConversations = await WaktiAIV2Service.getConversations();
        setConversations(fetchedConversations);
      } catch (error: any) {
        console.error('Error fetching conversations:', error);
      }
    };

    // Only fetch when drawer is opened
    if (showConversations && conversations.length === 0) {
      fetchConversations();
    }
  }, [showConversations, conversations.length]);

  const handleTaskConfirmation = async (taskData: any) => {
    setTaskConfirmationLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('tr_tasks')
        .insert({
          user_id: user.id,
          title: taskData.title,
          description: taskData.description || '',
          due_date: taskData.due_date ? new Date(taskData.due_date).toISOString().split('T')[0] : null,
          due_time: taskData.due_time || null,
          priority: taskData.priority || 'normal',
          completed: false
        });

      if (error) throw new Error('Failed to create task');

      if (taskData.subtasks && taskData.subtasks.length > 0) {
        const { data: createdTask } = await supabase
          .from('tr_tasks')
          .select('id')
          .eq('user_id', user.id)
          .eq('title', taskData.title)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (createdTask) {
          const subtaskInserts = taskData.subtasks.map((subtask: string, index: number) => ({
            task_id: createdTask.id,
            title: subtask,
            completed: false,
            order_index: index
          }));

          await supabase.from('tr_subtasks').insert(subtaskInserts);
        }
      }

      const successMessage: AIMessage = {
        id: `success-${Date.now()}`,
        role: 'assistant',
        content: language === 'ar' 
          ? `تم إنشاء المهمة بنجاح! 👍\n\n**${taskData.title}**`
          : `Task created successfully! 👍\n\n**${taskData.title}**`,
        timestamp: new Date(),
        intent: 'task_created',
        confidence: 'high',
        actionTaken: true
      };

      setAllMessages(prev => [...prev, successMessage]);
      setPendingTaskData(null);
      setShowTaskConfirmation(false);
      showSuccess(language === 'ar' ? 'تم إنشاء المهمة!' : 'Task created!');

    } catch (error: any) {
      console.error('Task creation failed:', error);
      showError(error.message || (language === 'ar' ? 'فشل في إنشاء المهمة' : 'Failed to create task'));
    } finally {
      setTaskConfirmationLoading(false);
    }
  };

  const handleReminderConfirmation = async (reminderData: any) => {
    setTaskConfirmationLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('tr_reminders')
        .insert({
          user_id: user.id,
          title: reminderData.title,
          description: reminderData.description || '',
          due_date: reminderData.due_date ? new Date(reminderData.due_date).toISOString().split('T')[0] : null,
          due_time: reminderData.due_time || null
        });

      if (error) throw new Error('Failed to create reminder');

      const successMessage: AIMessage = {
        id: `success-${Date.now()}`,
        role: 'assistant',
        content: language === 'ar' 
          ? `تم إنشاء التذكير بنجاح! 👍\n\n**${reminderData.title}**`
          : `Reminder created successfully! 👍\n\n**${reminderData.title}**`,
        timestamp: new Date(),
        intent: 'reminder_created',
        confidence: 'high',
        actionTaken: true
      };

      setAllMessages(prev => [...prev, successMessage]);
      setPendingReminderData(null);
      setShowTaskConfirmation(false);
      showSuccess(language === 'ar' ? 'تم إنشاء التذكير!' : 'Reminder created!');

    } catch (error: any) {
      console.error('Reminder creation failed:', error);
      showError(error.message || (language === 'ar' ? 'فشل في إنشاء التذكير' : 'Failed to create reminder'));
    } finally {
      setTaskConfirmationLoading(false);
    }
  };

  const handleCancelTaskConfirmation = () => {
    setPendingTaskData(null);
    setPendingReminderData(null);
    setShowTaskConfirmation(false);
    
    const cancelMessage: AIMessage = {
      id: `cancel-${Date.now()}`,
      role: 'assistant',
      content: language === 'ar' 
        ? 'تم إلغاء الإنشاء.'
        : 'Creation cancelled.',
      timestamp: new Date(),
      intent: 'cancelled',
      confidence: 'high'
    };

    setAllMessages(prev => [...prev, cancelMessage]);
  };

  // ENHANCED: Lightning-fast message sending with FULL personalization
  const handleSendMessage = async (
    message: string, 
    inputType: 'text' | 'voice' = 'text',
    attachedFiles?: any[]
  ) => {
    if ((!message.trim() && !attachedFiles?.length) || isLoading || requestInProgress) return;

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setIsLoading(true);
    setRequestInProgress(true);
    setRequestTimeout(false);
    setError(null);
    
    // Create new abort controller for timeout protection
    abortControllerRef.current = new AbortController();

    try {
      console.log('🚀 ENHANCED AI: Lightning speed processing with FULL personalization');
      const startTime = Date.now();

      // ULTRA-FAST: Handle Voice quota check only if needed (non-blocking)
      if (inputType === 'voice') {
        incrementTranslationCount().catch(e => console.warn('Quota check failed:', e));
      }

      // ULTRA-FAST: Create user message immediately with instant UI update
      const userMessage: AIMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message || '[File attachment]',
        timestamp: new Date(),
        inputType,
        attachedFiles: attachedFiles || []
      };

      const updatedMessages = [...allMessages, userMessage];
      setAllMessages(updatedMessages);

      // ENHANCED: Dynamic timeout based on request type - longer for Vision
      const hasVisionFiles = attachedFiles && attachedFiles.length > 0;
      const timeoutDuration = hasVisionFiles ? 30000 : 15000; // 30s for Vision, 15s for regular

      // ENHANCED: Timeout-protected API call with FULL personalization
      const response = await Promise.race([
        WaktiAIV2ServiceClass.sendMessage(
          message,
          undefined, // userId will be handled by auth cache
          language,
          currentConversationId,
          inputType,
          updatedMessages.slice(-8), // ENHANCED context
          false,
          activeTrigger,
          '', // Let service handle conversation summary
          attachedFiles || []
        ),
        // Dynamic timeout protection
        new Promise((_, reject) => {
          const timeoutId = setTimeout(() => {
            setRequestTimeout(true);
            const timeoutMessage = hasVisionFiles 
              ? 'Image analysis is taking longer than expected - please try again'
              : 'AI is taking longer than expected - please try again';
            reject(new Error(timeoutMessage));
          }, timeoutDuration);
          
          // Cleanup timeout if request completes
          abortControllerRef.current?.signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
          });
        })
      ]) as any;

      // ENHANCED: Create assistant message with FULL personalization applied
      const assistantMessage: AIMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.response, // Already fully personalized
        timestamp: new Date(),
        intent: response.intent || 'enhanced_chat',
        confidence: response.confidence || 'high',
        actionTaken: response.actionTaken || false,
        imageUrl: response.imageUrl,
        browsingUsed: response.browsingUsed,
        browsingData: response.browsingData
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setAllMessages(finalMessages);
      
      const responseTime = Date.now() - startTime;
      console.log(`🚀 ENHANCED AI: Total time: ${responseTime}ms (FULLY PERSONALIZED)`);

      // FIXED: Handle EXPLICIT task creation only
      if (response.needsConfirmation && response.pendingTaskData) {
        console.log('📝 EXPLICIT TASK CREATION: Showing confirmation form');
        setPendingTaskData(response.pendingTaskData);
        setShowTaskConfirmation(true);
      } else if (response.needsConfirmation && response.pendingReminderData) {
        console.log('⏰ EXPLICIT REMINDER CREATION: Showing confirmation form');
        setPendingReminderData(response.pendingReminderData);
        setShowTaskConfirmation(true);
      }

      // FIRE-AND-FORGET: Background quota updates
      if (inputType === 'voice') {
        Promise.all([refreshTranslationQuota(), refreshVoiceQuota()])
          .catch(e => console.warn('Background quota update failed:', e));
      }

    } catch (error: any) {
      console.error('🚨 ENHANCED AI: Error:', error);
      
      // IMPROVED: Better error messages with Vision-specific handling
      if (error.message?.includes('timeout') || error.message?.includes('longer than expected')) {
        setRequestTimeout(true);
        const isVisionTimeout = error.message?.includes('Image analysis');
        const errorMsg = isVisionTimeout
          ? (language === 'ar' ? 'تحليل الصورة يستغرق وقتاً أطول - حاول مرة أخرى' : 'Image analysis taking longer - try again')
          : (language === 'ar' ? 'الذكاء الاصطناعي يستغرق وقتاً أطول - حاول مرة أخرى' : 'AI is taking longer than usual - try again');
        
        setError(errorMsg);
        showError(errorMsg);
      } else if (error.message?.includes('network') || error.message?.includes('connection')) {
        setError('Network connection issue - check your internet');
        showError(language === 'ar' ? 'مشكلة في الاتصال - تحقق من الإنترنت' : 'Network issue - check connection');
      } else if (error.message?.includes('unavailable') || error.message?.includes('busy')) {
        setError('AI service is temporarily busy - please try again');
        showError(language === 'ar' ? 'الخدمة مشغولة مؤقتاً - حاول مرة أخرى' : 'AI service is busy - try again');
      } else {
        setError('Something went wrong - please try again');
        showError(error.message || (language === 'ar' ? 'حدث خطأ - حاول مرة أخرى' : 'Something went wrong - try again'));
      }
    } finally {
      setIsLoading(false);
      setRequestInProgress(false);
      abortControllerRef.current = null;
    }
  };

  // Debounced version of handleSendMessage for rapid typing
  const debouncedSendMessage = useDebounceCallback(handleSendMessage, 300);

  // fetchConversations
  const fetchConversations = async () => {
    try {
      const fetchedConversations = await WaktiAIV2Service.getConversations();
      setConversations(fetchedConversations);
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
      setError(error.message || 'Failed to fetch conversations');
    }
  };

  // loadFullConversationHistory
  const loadFullConversationHistory = async (conversationId: string) => {
    try {
      console.log('📚 Loading full conversation history for:', conversationId);
      
      const messages = await WaktiAIV2Service.getConversationMessages(conversationId);
      
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
        browsingData: msg.browsing_data
      }));
      
      setAllMessages(convertedMessages);
      console.log('📚 Loaded full conversation history:', convertedMessages.length, 'messages');
      
    } catch (error) {
      console.error('❌ Error loading full conversation history:', error);
    }
  };

  // FIXED: Only start new conversation when explicitly requested
  const handleNewConversation = async () => {
    console.log('🆕 PERSISTENCE: User explicitly requested new conversation');
    
    // Cancel any in-progress request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setCurrentConversationId(null);
    setAllMessages([]);
    WaktiAIV2Service.clearChatSession();
    setError(null);
    setPendingTaskData(null);
    setPendingReminderData(null);
    setShowTaskConfirmation(false);
    setRequestInProgress(false);
    setIsNewConversation(true);
    
    showSuccess(language === 'ar' ? 'بدأت محادثة جديدة' : 'Started new conversation');
  };

  // FIXED: Load existing conversation without clearing current session
  const handleSelectConversation = async (conversationId: string) => {
    try {
      console.log('🔄 PERSISTENCE: Loading existing conversation:', conversationId);
      
      // Cancel any in-progress request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      setIsLoading(true);
      await loadFullConversationHistory(conversationId);
      
      setCurrentConversationId(conversationId);
      setError(null);
      setPendingTaskData(null);
      setPendingReminderData(null);
      setShowTaskConfirmation(false);
      setRequestInProgress(false);
      setIsNewConversation(false);
      
    } catch (error: any) {
      console.error('Error loading conversation:', error);
      setError('Failed to load conversation');
    } finally {
      setIsLoading(false);
    }
  };

  // FIXED: Clear current chat only (not start new conversation)
  const handleClearChat = () => {
    console.log('🧹 PERSISTENCE: Clearing current chat session');
    
    // Cancel any in-progress request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setAllMessages([]);
    WaktiAIV2Service.clearChatSession();
    setError(null);
    setPendingTaskData(null);
    setPendingReminderData(null);
    setShowTaskConfirmation(false);
    setRequestInProgress(false);
    setIsNewConversation(true);
    
    // Don't clear conversation ID - let user continue if they want
    showSuccess(language === 'ar' ? 'تم مسح الدردشة' : 'Chat cleared');
  };

  // handleDeleteConversation
  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await WaktiAIV2Service.deleteConversation(conversationId);
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      if (currentConversationId === conversationId) {
        setCurrentConversationId(null);
        setAllMessages([]);
        setIsNewConversation(true);
      }
      showSuccess(language === 'ar' ? 'تم حذف المحادثة' : 'Conversation deleted');
    } catch (error: any) {
      console.error('Error deleting conversation:', error);
      showError(error.message || (language === 'ar' ? 'فشل في حذف المحادثة' : 'Failed to delete conversation'));
    }
  };

  // handleTriggerChange
  const handleTriggerChange = (trigger: string) => {
    setActiveTrigger(trigger);
  };

  // handleTextGenerated
  const handleTextGenerated = (text: string, mode: 'compose' | 'reply', isTextGenerated: boolean = true) => {
    const assistantMessage: AIMessage = {
      id: `assistant-textgen-${Date.now()}`,
      role: 'assistant',
      content: text,
      timestamp: new Date(),
      intent: 'text_generation',
      confidence: 'high',
      actionTaken: true,
      isTextGenerated: true
    };

    setAllMessages(prev => [...prev, assistantMessage]);
    setShowQuickActions(false);
    showSuccess(language === 'ar' ? 'تم إنشاء النص' : 'Text generated');
  };

  const handleOpenPlusDrawer = () => {
    setShowQuickActions(true);
  };

  React.useEffect(() => {
    const handleOpenDrawer = () => {
      setShowConversations(true);
    };
    window.addEventListener("open-wakti-conversations", handleOpenDrawer);
    return () => {
      window.removeEventListener("open-wakti-conversations", handleOpenDrawer);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-full min-h-screen bg-background overflow-hidden">
      <div className="sticky top-0 z-30">
        <NotificationBars
          quotaStatus={aiQuota}
          searchConfirmationRequired={false}
          onSearchConfirmation={() => {}}
          onQuotaRefresh={() => fetchAIQuota(true)}
          requestTimeout={requestTimeout}
          onTimeoutRetry={() => {
            setRequestTimeout(false);
            setError(null);
          }}
        />
      </div>
      <div 
        ref={scrollAreaRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-[140px]"
      >
        <ChatMessages
          sessionMessages={allMessages}
          isLoading={isLoading}
          activeTrigger={activeTrigger}
          scrollAreaRef={scrollAreaRef}
          userProfile={userProfile}
          personalTouch={personalTouch}
          showTaskConfirmation={showTaskConfirmation}
          pendingTaskData={pendingTaskData}
          pendingReminderData={pendingReminderData}
          taskConfirmationLoading={taskConfirmationLoading}
          onTaskConfirmation={handleTaskConfirmation}
          onReminderConfirmation={handleReminderConfirmation}
          onCancelTaskConfirmation={handleCancelTaskConfirmation}
        />
      </div>
      
      {/* Scroll to bottom button */}
      {showScrollButton && (
        <div className="fixed bottom-32 right-6 z-50">
          <Button
            onClick={handleScrollToBottom}
            size="icon"
            className="h-8 w-8 rounded-full bg-primary/90 hover:bg-primary shadow-lg backdrop-blur-sm border border-white/20 transition-all duration-200 hover:scale-110"
            aria-label={language === 'ar' ? 'انتقل إلى الأسفل' : 'Scroll to bottom'}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      <div className="fixed bottom-16 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-t border-border">
        <ChatInput
          message={message}
          setMessage={setMessage}
          isLoading={isLoading || requestInProgress}
          sessionMessages={allMessages}
          onSendMessage={handleSendMessage}
          onClearChat={handleClearChat}
          onOpenPlusDrawer={handleOpenPlusDrawer}
          activeTrigger={activeTrigger}
        />
      </div>
      <ChatDrawers
        showConversations={showConversations}
        setShowConversations={setShowConversations}
        showQuickActions={showQuickActions}
        setShowQuickActions={setShowQuickActions}
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        fetchConversations={fetchConversations}
        onSendMessage={handleSendMessage}
        activeTrigger={activeTrigger}
        onTriggerChange={handleTriggerChange}
        onTextGenerated={handleTextGenerated}
        onNewConversation={handleNewConversation}
        onClearChat={handleClearChat}
        sessionMessages={allMessages}
        isLoading={isLoading}
      />
    </div>
  );
};

export default WaktiAIV2;
