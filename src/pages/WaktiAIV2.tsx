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

// NEW: Debounced request handler
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
  
  // Enhanced task confirmation state
  const [showTaskConfirmation, setShowTaskConfirmation] = useState(false);
  const [pendingTaskData, setPendingTaskData] = useState<any>(null);
  const [pendingReminderData, setPendingReminderData] = useState<any>(null);
  const [taskConfirmationLoading, setTaskConfirmationLoading] = useState(false);
  
  // NEW: Request management state
  const [requestInProgress, setRequestInProgress] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const scrollAreaRef = useRef<any>(null);
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

  const [sessionMessages, setSessionMessages] = useState<AIMessage[]>([]);
  const [conversationMessages, setConversationMessages] = useState<AIMessage[]>([]);
  const [hasLoadedSession, setHasLoadedSession] = useState(false);

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
        
        // Cache for 10 minutes (increased from 5)
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

  // ULTRA-FAST: Load session from local memory cache
  useEffect(() => {
    if (!hasLoadedSession) {
      const savedSession = WaktiAIV2Service.loadChatSession();
      if (savedSession) {
        setSessionMessages(savedSession.messages || []);
        if (savedSession.conversationId) {
          setCurrentConversationId(savedSession.conversationId);
        }
      }
      setHasLoadedSession(true);
    }
  }, [hasLoadedSession]);

  // ULTRA-FAST: Auto-save to local memory cache
  useEffect(() => {
    if (hasLoadedSession && sessionMessages.length > 0) {
      WaktiAIV2Service.saveChatSession(sessionMessages, currentConversationId);
    }
  }, [sessionMessages, currentConversationId, hasLoadedSession]);

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

      setSessionMessages(prev => [...prev, successMessage]);
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

      setSessionMessages(prev => [...prev, successMessage]);
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

    setSessionMessages(prev => [...prev, cancelMessage]);
  };

  // HYPER-OPTIMIZED: Enhanced message sending with aggressive optimization and request management
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
    setError(null);
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      console.log('⚡ HYPER-OPTIMIZED AI: Message processing initiated');
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

      const updatedSessionMessages = [...sessionMessages, userMessage];
      setSessionMessages(updatedSessionMessages);

      // HYPER-OPTIMIZED: Send message using static method with timeout handling
      const response = await Promise.race([
        WaktiAIV2ServiceClass.sendMessage(
          message,
          undefined, // userId will be handled by auth cache
          language,
          currentConversationId,
          inputType,
          updatedSessionMessages,
          false,
          activeTrigger,
          null,
          attachedFiles || []
        ),
        // Backup timeout promise
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 8000)
        )
      ]) as any;

      // ULTRA-FAST: Create assistant message immediately with ALL response properties
      const assistantMessage: AIMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        intent: response.intent || 'chat_response',
        confidence: response.confidence || 'high',
        actionTaken: response.actionTaken || false,
        imageUrl: response.imageUrl,
        browsingUsed: response.browsingUsed,
        browsingData: response.browsingData
      };

      const finalSessionMessages = [...updatedSessionMessages, assistantMessage];
      setSessionMessages(finalSessionMessages);
      
      const responseTime = Date.now() - startTime;
      console.log(`⚡ HYPER-OPTIMIZED AI: Total response time: ${responseTime}ms`);

      // Handle special responses
      if (response.needsConfirmation && response.pendingTaskData) {
        setPendingTaskData(response.pendingTaskData);
        setShowTaskConfirmation(true);
      } else if (response.needsConfirmation && response.pendingReminderData) {
        setPendingReminderData(response.pendingReminderData);
        setShowTaskConfirmation(true);
      }

      // FIRE-AND-FORGET: Background quota updates
      if (inputType === 'voice') {
        Promise.all([refreshTranslationQuota(), refreshVoiceQuota()])
          .catch(e => console.warn('Background quota update failed:', e));
      }

    } catch (error: any) {
      console.error('⚡ HYPER-OPTIMIZED AI: Error:', error);
      
      // Handle specific error types
      if (error.message?.includes('timeout')) {
        setError('Request timed out - please try again');
        showError(language === 'ar' ? 'انتهت مهلة الطلب - حاول مرة أخرى' : 'Request timed out - try again');
      } else {
        setError(error.message || 'Failed to send message');
        showError(error.message || (language === 'ar' ? 'فشل في إرسال الرسالة' : 'Failed to send message'));
      }
    } finally {
      setIsLoading(false);
      setRequestInProgress(false);
      abortControllerRef.current = null;
    }
  };

  // Debounced version of handleSendMessage for rapid typing
  const debouncedSendMessage = useDebounceCallback(handleSendMessage, 300);

  const fetchConversations = async () => {
    try {
      const fetchedConversations = await WaktiAIV2Service.getConversations();
      setConversations(fetchedConversations);
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
      setError(error.message || 'Failed to fetch conversations');
    }
  };

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
      
      setConversationMessages(convertedMessages);
      console.log('📚 Loaded full conversation history:', convertedMessages.length, 'messages');
      
    } catch (error) {
      console.error('❌ Error loading full conversation history:', error);
    }
  };

  const handleNewConversation = async () => {
    // Cancel any in-progress request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setCurrentConversationId(null);
    setSessionMessages([]);
    setConversationMessages([]);
    WaktiAIV2Service.clearChatSession();
    setError(null);
    setPendingTaskData(null);
    setPendingReminderData(null);
    setShowTaskConfirmation(false);
    setRequestInProgress(false);
  };

  const handleSelectConversation = async (conversationId: string) => {
    try {
      // Cancel any in-progress request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      setIsLoading(true);
      const messages = await WaktiAIV2Service.getConversationMessages(conversationId);
      
      const convertedMessages: AIMessage[] = messages.map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: new Date(msg.created_at),
        intent: msg.intent,
        confidence: msg.confidence_level as 'high' | 'medium' | 'low',
        actionTaken: !!msg.action_taken,
        inputType: msg.input_type as 'text' | 'voice'
      }));
      
      setConversationMessages(convertedMessages);
      setCurrentConversationId(conversationId);
      setSessionMessages([]);
      setError(null);
      setPendingTaskData(null);
      setPendingReminderData(null);
      setShowTaskConfirmation(false);
      setRequestInProgress(false);
      
    } catch (error: any) {
      console.error('Error loading conversation:', error);
      setError('Failed to load conversation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    // Cancel any in-progress request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setSessionMessages([]);
    setConversationMessages([]);
    WaktiAIV2Service.clearChatSession();
    setError(null);
    setPendingTaskData(null);
    setPendingReminderData(null);
    setShowTaskConfirmation(false);
    setRequestInProgress(false);
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await WaktiAIV2Service.deleteConversation(conversationId);
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      if (currentConversationId === conversationId) {
        setCurrentConversationId(null);
        setSessionMessages([]);
        setConversationMessages([]);
      }
      showSuccess(language === 'ar' ? 'تم حذف المحادثة' : 'Conversation deleted');
    } catch (error: any) {
      console.error('Error deleting conversation:', error);
      showError(error.message || (language === 'ar' ? 'فشل في حذف المحادثة' : 'Failed to delete conversation'));
    }
  };

  const handleTriggerChange = (trigger: string) => {
    setActiveTrigger(trigger);
  };

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

    setSessionMessages(prev => [...prev, assistantMessage]);
    setShowQuickActions(false);
    showSuccess(language === 'ar' ? 'تم إنشاء النص' : 'Text generated');
  };

  // Enhanced display messages without streaming
  const allDisplayMessages = [...conversationMessages, ...sessionMessages];

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
        />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-[140px]">
        <ChatMessages
          sessionMessages={allDisplayMessages}
          isLoading={isLoading}
          activeTrigger={activeTrigger}
          scrollAreaRef={scrollAreaRef}
          userProfile={userProfile}
          showTaskConfirmation={showTaskConfirmation}
          pendingTaskData={pendingTaskData}
          pendingReminderData={pendingReminderData}
          taskConfirmationLoading={taskConfirmationLoading}
          onTaskConfirmation={handleTaskConfirmation}
          onReminderConfirmation={handleReminderConfirmation}
          onCancelTaskConfirmation={handleCancelTaskConfirmation}
        />
      </div>
      <div className="fixed bottom-16 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-t border-border">
        <ChatInput
          message={message}
          setMessage={setMessage}
          isLoading={isLoading || requestInProgress}
          sessionMessages={allDisplayMessages}
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
        sessionMessages={allDisplayMessages}
        isLoading={isLoading}
      />
    </div>
  );
};

export default WaktiAIV2;
