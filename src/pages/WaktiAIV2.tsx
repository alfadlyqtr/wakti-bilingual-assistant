import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { WaktiAIV2Service, AIMessage, AIConversation } from '@/services/WaktiAIV2Service';
import { useToastHelper } from "@/hooks/use-toast-helper";
import { useExtendedQuotaManagement } from '@/hooks/useExtendedQuotaManagement';
import { useQuotaManagement } from '@/hooks/useQuotaManagement';
import { useSearchQuotaManagement } from '@/hooks/useSearchQuotaManagement';
import { supabase } from '@/integrations/supabase/client';
import { ChatHeader } from '@/components/wakti-ai-v2/ChatHeader';
import { ChatMessages } from '@/components/wakti-ai-v2/ChatMessages';
import { ChatInput } from '@/components/wakti-ai-v2/ChatInput';
import { ChatDrawers } from '@/components/wakti-ai-v2/ChatDrawers';
import { NotificationBars } from '@/components/wakti-ai-v2/NotificationBars';

const WaktiAIV2 = () => {
  const [message, setMessage] = useState('');
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
  const [userProfile, setUserProfile] = useState<any>(null);
  const [pendingTaskData, setPendingTaskData] = useState<any>(null);
  
  const [calendarContext, setCalendarContext] = useState<any>(null);
  const [userContext, setUserContext] = useState<any>(null);
  
  const scrollAreaRef = useRef<any>(null);
  const { language } = useTheme();
  const { showSuccess, showError } = useToastHelper();

  // Simplified quota management - only voice
  const {
    refreshVoiceQuota
  } = useExtendedQuotaManagement(language);

  // Translation quota management for Voice Translator
  const {
    userQuota: translationQuota,
    refreshTranslationQuota,
    incrementTranslationCount,
    MAX_DAILY_TRANSLATIONS
  } = useQuotaManagement(language);

  // Search quota management
  const {
    remainingFreeSearches,
    extraSearches,
    isAtLimit,
    canSearch,
    refreshSearchQuota,
    MAX_MONTHLY_SEARCHES
  } = useSearchQuotaManagement(language);

  const [sessionMessages, setSessionMessages] = useState<AIMessage[]>([]);
  const [conversationMessages, setConversationMessages] = useState<AIMessage[]>([]);
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

  // Updated fetchQuota function with force refresh option
  const fetchQuota = async (forceRefresh: boolean = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      console.log(`📊 Fetching quota ${forceRefresh ? 'with force refresh' : 'normally'}`);
      const quota = await WaktiAIV2Service.getOrFetchQuota(user.id, forceRefresh);
      setQuotaStatus(quota);
      
      console.log('📊 Updated quota state:', quota);
    } catch (error: any) {
      console.error('Error fetching quota:', error);
      setError(error.message || 'Failed to fetch quota');
    }
  };

  useEffect(() => {
    const fetchEnhancedContext = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        console.log('🔄 WAKTI AI V2.5: Fetching Phase 4 enhanced context...');

        const [calendarCtx, userCtx] = await Promise.all([
          WaktiAIV2Service.getCalendarContext(user.id),
          WaktiAIV2Service.getUserContext(user.id)
        ]);

        setCalendarContext(calendarCtx);
        setUserContext(userCtx);
        
        console.log('🔄 WAKTI AI V2.5: Enhanced context loaded:', {
          calendar: !!calendarCtx,
          user: !!userCtx
        });
      } catch (error) {
        console.error('Error fetching enhanced context:', error);
      }
    };

    fetchEnhancedContext();
  }, []);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();

        setUserProfile(profile);
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchUserProfile();
  }, []);

  useEffect(() => {
    if (!hasLoadedSession) {
      const savedSession = WaktiAIV2Service.loadChatSession();
      if (savedSession) {
        console.log('📂 Restoring chat session...');
        setSessionMessages(savedSession.messages || []);
        if (savedSession.conversationId) {
          setCurrentConversationId(savedSession.conversationId);
          loadFullConversationHistory(savedSession.conversationId);
        }
      }
      setHasLoadedSession(true);
    }
  }, [hasLoadedSession]);

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
        browsingData: msg.browsing_data,
        quotaStatus: msg.quota_status
      }));
      
      setConversationMessages(convertedMessages);
      console.log('📚 Loaded full conversation history:', convertedMessages.length, 'messages');
      
    } catch (error) {
      console.error('❌ Error loading full conversation history:', error);
    }
  };

  const getCompleteConversationContext = (): AIMessage[] => {
    const allMessages = [...conversationMessages, ...sessionMessages];
    
    const uniqueMessages = allMessages.filter((message, index, self) => 
      index === self.findIndex(m => 
        m.timestamp.getTime() === message.timestamp.getTime() && 
        m.content === message.content &&
        m.role === message.role
      )
    );
    
    uniqueMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    const contextMessages = uniqueMessages.slice(-50);
    
    console.log('🧠 Complete conversation context:', {
      conversationMessages: conversationMessages.length,
      sessionMessages: sessionMessages.length,
      uniqueMessages: uniqueMessages.length,
      contextMessages: contextMessages.length
    });
    
    return contextMessages;
  };

  const createConversationIfNeeded = async (messages: AIMessage[]) => {
    if (currentConversationId || messages.length < 2) return null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      console.log('🆕 Auto-creating conversation for new chat...');

      const conversationId = await WaktiAIV2Service.ensureConversationExists(user.id, messages, language);
      
      if (conversationId) {
        console.log('✅ Auto-created conversation:', conversationId);
        return conversationId;
      }

      return null;
    } catch (error) {
      console.error('❌ Error in createConversationIfNeeded:', error);
      return null;
    }
  };

  const saveMessageToConversation = async (message: AIMessage, conversationId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !conversationId) return;

      console.log('💾 Saving message to conversation:', conversationId);

      const { error } = await supabase
        .from('ai_chat_history')
        .insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: message.role,
          content: message.content,
          created_at: message.timestamp.toISOString(),
          language: language,
          input_type: message.inputType || 'text',
          intent: message.intent,
          confidence_level: message.confidence,
          action_taken: message.actionTaken ? String(message.actionTaken) : null,
          browsing_used: message.browsingUsed || false,
          browsing_data: message.browsingData || null,
          quota_status: message.quotaStatus || null,
          action_result: message.actionResult || null
        });

      if (error) {
        console.error('❌ Error saving message:', error);
        return;
      }

      await WaktiAIV2Service.updateConversationTimestamp(conversationId);

      console.log('✅ Message saved successfully');
    } catch (error) {
      console.error('❌ Error in saveMessageToConversation:', error);
    }
  };

  const handleSendMessage = async (
    message: string, 
    inputType: 'text' | 'voice' = 'text',
    attachedFiles?: any[]
  ) => {
    if ((!message.trim() && !attachedFiles?.length) || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔄 WAKTI AI V2.5: === ENHANCED TASK SYSTEM ===');
      console.log('🔄 WAKTI AI V2.5: Message:', message);
      console.log('🔄 WAKTI AI V2.5: Input Type:', inputType);
      console.log('🔄 WAKTI AI V2.5: Active Trigger:', activeTrigger);

      // Handle Search quota increment BEFORE sending (only for search trigger)
      if (activeTrigger === 'search') {
        console.log('🔍 Search operation detected - checking search quota...');
        
        if (!canSearch) {
          setIsLoading(false);
          const errorMsg = language === 'ar' 
            ? `تم الوصول للحد الأقصى من البحث (${MAX_MONTHLY_SEARCHES}/${MAX_MONTHLY_SEARCHES} استخدمت، ${extraSearches} إضافي متبقي)`
            : `Search quota exceeded (${MAX_MONTHLY_SEARCHES}/${MAX_MONTHLY_SEARCHES} used, ${extraSearches} extra remaining)`;
          showError(errorMsg);
          return;
        }

        // Increment search quota BEFORE sending the request
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data, error: quotaError } = await supabase.rpc('increment_regular_search_usage', {
          p_user_id: user.id
        });

        if (quotaError) {
          console.error('❌ Error incrementing search quota:', quotaError);
          setIsLoading(false);
          showError(language === 'ar' ? 'خطأ في إدارة حصة البحث' : 'Error managing search quota');
          return;
        }

        if (!data || !data[0]?.success) {
          console.error('❌ Search quota increment failed:', data);
          setIsLoading(false);
          showError(language === 'ar' ? 'تم الوصول للحد الأقصى من البحث' : 'Search quota exceeded');
          return;
        }

        console.log('✅ Search quota incremented successfully:', data[0]);
        await refreshSearchQuota();
      }

      // Handle Voice Translator quota increment BEFORE sending
      if (inputType === 'voice') {
        console.log('📈 Voice translation detected - checking and incrementing translation quota...');
        const canTranslate = await incrementTranslationCount();
        if (!canTranslate) {
          setIsLoading(false);
          showError(language === 'ar' ? 'تم الوصول للحد الأقصى من الترجمات' : 'Translation quota exceeded');
          return;
        }
        console.log('✅ Voice translation quota incremented successfully');
      }

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

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const completeContext = getCompleteConversationContext();
      const contextForAI = [...completeContext, userMessage].slice(-50);

      console.log('🧠 WAKTI AI V2.5: Sending enhanced context to AI:', {
        contextMessages: contextForAI.length,
        hasConversationHistory: conversationMessages.length > 0,
        currentConversationId
      });

      const response = await WaktiAIV2Service.sendMessage(
        message,
        user.id,
        language,
        currentConversationId,
        inputType,
        contextForAI,
        false,
        activeTrigger,
        textGenParams,
        attachedFiles || [],
        calendarContext,
        userContext
      );

      console.log('🔄 WAKTI AI V2.5: === ENHANCED RESPONSE RECEIVED ===');
      console.log('🔄 WAKTI AI V2.5: Response length:', response.response?.length);
      console.log('🔄 WAKTI AI V2.5: Needs Confirmation:', response.needsConfirmation);
      console.log('🔄 WAKTI AI V2.5: Needs Clarification:', response.needsClarification);
      console.log('🔄 WAKTI AI V2.5: Pending Task Data:', response.pendingTaskData);

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.conversationId && response.conversationId !== currentConversationId) {
        setCurrentConversationId(response.conversationId);
        loadFullConversationHistory(response.conversationId);
        console.log('🔄 WAKTI AI V2.5: Updated conversation ID:', response.conversationId);
      }

      const assistantMessage: AIMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        intent: response.intent,
        confidence: response.confidence as 'high' | 'medium' | 'low',
        actionTaken: response.actionTaken,
        browsingUsed: response.browsingUsed,
        browsingData: response.browsingData,
        quotaStatus: response.quotaStatus,
        requiresSearchConfirmation: response.requiresSearchConfirmation,
        imageUrl: response.imageUrl,
        isTextGenerated: activeTrigger === 'image' && !!response.imageUrl,
        actionResult: response.actionResult,
        fileAnalysisResults: response.fileAnalysisResults,
        deepIntegration: response.deepIntegration,
        automationSuggestions: response.automationSuggestions,
        predictiveInsights: response.predictiveInsights,
        workflowActions: response.workflowActions,
        contextualActions: response.contextualActions,
        needsConfirmation: response.needsConfirmation,
        needsClarification: response.needsClarification,
        pendingTaskData: response.pendingTaskData,
        partialTaskData: response.partialTaskData,
        pendingReminderData: response.pendingReminderData
      };

      const finalSessionMessages = [...updatedSessionMessages, assistantMessage].slice(-30);
      setSessionMessages(finalSessionMessages);

      // Store pending task data for confirmation handling
      if (response.pendingTaskData) {
        setPendingTaskData(response.pendingTaskData);
      }

      if (!currentConversationId) {
        const allMessagesForConversation = [...updatedSessionMessages, assistantMessage];
        const newConversationId = await createConversationIfNeeded(allMessagesForConversation);
        if (newConversationId) {
          setCurrentConversationId(newConversationId);
          loadFullConversationHistory(newConversationId);
          console.log('🆕 Set new conversation ID:', newConversationId);
          
          fetchConversations();
        }
      } else {
        await saveMessageToConversation(userMessage, currentConversationId);
        await saveMessageToConversation(assistantMessage, currentConversationId);
        
        fetchConversations();
      }

      // Handle quota updates and success messages
      if (response.browsingUsed && activeTrigger === 'search') {
        console.log('🔄 Search operation completed successfully');
        const remainingAfterSearch = remainingFreeSearches - 1;
        showSuccess(
          language === 'ar' 
            ? `تم تنفيذ البحث بنجاح (${remainingAfterSearch}/${MAX_MONTHLY_SEARCHES} متبقي)`
            : `Search completed successfully (${remainingAfterSearch}/${MAX_MONTHLY_SEARCHES} remaining)`
        );
        
        setTimeout(() => {
          refreshSearchQuota();
        }, 500);
      }

      if (inputType === 'voice') {
        console.log('🔄 Voice translation completed - refreshing translation quota...');
        await refreshTranslationQuota();
        
        const remainingTranslations = MAX_DAILY_TRANSLATIONS - translationQuota.daily_count - 1;
        showSuccess(
          language === 'ar' 
            ? `تم تنفيذ الترجمة الصوتية بنجاح وتحديث الحصة (${remainingTranslations}/${MAX_DAILY_TRANSLATIONS} متبقية)` 
            : `Voice translation completed successfully - quota updated (${remainingTranslations}/${MAX_DAILY_TRANSLATIONS} remaining)`
        );
      }

      if (response.quotaStatus) {
        console.log('📊 Received quota status from AI response:', response.quotaStatus);
        setQuotaStatus(response.quotaStatus);
        
        if (response.browsingUsed && activeTrigger === 'search') {
          console.log('🔄 Search operation detected - invalidating quota cache and forcing refresh');
          WaktiAIV2Service.invalidateQuotaCache();
          
          setTimeout(() => {
            fetchQuota(true);
          }, 1000);
        }
      }

      if (inputType === 'voice') {
        console.log('🔄 Voice operation completed - refreshing voice quota...');
        await refreshVoiceQuota();
      }

      if (response.requiresSearchConfirmation) {
        setSearchConfirmationRequired(true);
      }

      if (response.needsConfirmation) {
        console.log('🔄 WAKTI AI V2.5: Task confirmation card should be shown');
        showSuccess(
          language === 'ar' 
            ? 'تم تحضير المهمة للتأكيد' 
            : 'Task prepared for confirmation'
        );
      }

      if (response.needsClarification) {
        console.log('🔄 WAKTI AI V2.5: Task clarification needed');
        showSuccess(
          language === 'ar' 
            ? 'نحتاج المزيد من المعلومات لإنشاء المهمة' 
            : 'Need more information to create the task'
        );
      }

    } catch (error: any) {
      console.error('🔄 WAKTI AI V2.5: ❌ Enhanced system error:', error);
      setError(error.message || 'Failed to send message');
      showError(
        error.message || (language === 'ar' ? 'فشل في إرسال الرسالة' : 'Failed to send message')
      );
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

      if (response.conversationId && response.conversationId !== currentConversationId) {
        setCurrentConversationId(response.conversationId);
      }

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

      const finalMessages = [...sessionMessages, assistantMessage].slice(-30);
      setSessionMessages(finalMessages);

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

  const saveCurrentConversationIfNeeded = async () => {
    if (sessionMessages.length > 0 && !currentConversationId) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await WaktiAIV2Service.saveCurrentConversationIfNeeded(user.id, sessionMessages, currentConversationId, language);
      } catch (error) {
        console.error('❌ Error saving current conversation:', error);
      }
    }
  };

  const handleNewConversation = async () => {
    console.log('🆕 Starting new conversation...');
    
    await saveCurrentConversationIfNeeded();
    
    setCurrentConversationId(null);
    setSessionMessages([]);
    setConversationMessages([]);
    WaktiAIV2Service.clearChatSession();
    setSearchConfirmationRequired(false);
    setError(null);
    
    await fetchConversations();
    
    setShowConversations(false);
    
    console.log('✅ New conversation started');
  };

  const handleSelectConversation = async (conversationId: string) => {
    try {
      console.log('📂 Loading conversation:', conversationId);
      setIsLoading(true);
      
      await loadFullConversationHistory(conversationId);
      
      setCurrentConversationId(conversationId);
      
      setSessionMessages([]);
      
      setSearchConfirmationRequired(false);
      setError(null);
      
      console.log('📂 Conversation loaded successfully');
      
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
    setConversationMessages([]);
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
        setConversationMessages([]);
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

  const handleTextGenerated = (text: string, mode: 'compose' | 'reply') => {
    console.log('📝 Text generated from tool:', { text, mode });
    
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

    const updatedSessionMessages = [...sessionMessages, assistantMessage].slice(-30);
    setSessionMessages(updatedSessionMessages);

    if (currentConversationId) {
      saveMessageToConversation(assistantMessage, currentConversationId);
    }
    
    showSuccess(
      language === 'ar' ? 'تم إنشاء النص وإضافته للمحادثة' : 'Text generated and added to chat'
    );
  };

  const allDisplayMessages = [...conversationMessages, ...sessionMessages];

  const handleTaskConfirm = async (taskData: any) => {
    try {
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      console.log('✅ Creating confirmed task:', taskData);

      // Create the task
      const { data: newTask, error } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          title: taskData.title,
          description: taskData.description || '',
          due_date: taskData.due_date || null,
          due_time: taskData.due_time || null,
          priority: taskData.priority || 'normal',
          task_type: taskData.task_type || 'one-time',
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      // Create subtasks if any
      if (taskData.subtasks && taskData.subtasks.length > 0) {
        const subtaskInserts = taskData.subtasks.map((subtask: string, index: number) => ({
          task_id: newTask.id,
          user_id: user.id,
          title: subtask,
          order_index: index,
          completed: false
        }));

        const { error: subtaskError } = await supabase
          .from('subtasks')
          .insert(subtaskInserts);

        if (subtaskError) {
          console.error('Error creating subtasks:', subtaskError);
        }
      }

      // Clear pending task data
      setPendingTaskData(null);

      // Add success message to chat
      const successMessage: AIMessage = {
        id: `success-${Date.now()}`,
        role: 'assistant',
        content: language === 'ar' 
          ? `✅ تم إنشاء المهمة "${taskData.title}" بنجاح!`
          : `✅ Task "${taskData.title}" created successfully!`,
        timestamp: new Date(),
        intent: 'task_created',
        confidence: 'high'
      };

      setSessionMessages(prev => [...prev, successMessage]);

      showSuccess(
        language === 'ar' 
          ? 'تم إنشاء المهمة بنجاح!' 
          : 'Task created successfully!'
      );

    } catch (error: any) {
      console.error('Error creating task:', error);
      showError(
        error.message || (language === 'ar' ? 'فشل في إنشاء المهمة' : 'Failed to create task')
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleTaskEdit = async (editedTaskData: any) => {
    try {
      // Send the edited task data back to AI for final confirmation
      const confirmationMessage = language === 'ar' 
        ? `تأكيد إنشاء المهمة: ${editedTaskData.title}`
        : `Confirm task creation: ${editedTaskData.title}`;
      
      await handleSendMessage(confirmationMessage, 'text');
      
    } catch (error: any) {
      console.error('Error handling task edit:', error);
      showError(
        error.message || (language === 'ar' ? 'فشل في تعديل المهمة' : 'Failed to edit task')
      );
    }
  };

  const handleTaskCancel = () => {
    setPendingTaskData(null);
    
    const cancelMessage: AIMessage = {
      id: `cancel-${Date.now()}`,
      role: 'assistant',
      content: language === 'ar' 
        ? 'تم إلغاء إنشاء المهمة. يمكنك طلب مهمة جديدة في أي وقت.'
        : 'Task creation cancelled. You can request a new task anytime.',
      timestamp: new Date(),
      intent: 'task_cancelled',
      confidence: 'high'
    };

    setSessionMessages(prev => [...prev, cancelMessage]);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <ChatHeader 
        activeTrigger={activeTrigger}
        setActiveTrigger={setActiveTrigger}
        onNewConversation={handleNewConversation}
        onToggleConversations={() => setShowConversations(!showConversations)}
        onToggleQuickActions={() => setShowQuickActions(!showQuickActions)}
        quotaStatus={quotaStatus}
        searchConfirmationRequired={searchConfirmationRequired}
        onSearchConfirmation={handleSearchConfirmation}
        remainingFreeSearches={remainingFreeSearches}
        extraSearches={extraSearches}
        isAtSearchLimit={isAtLimit}
        translationQuota={translationQuota}
        MAX_DAILY_TRANSLATIONS={MAX_DAILY_TRANSLATIONS}
      />

      <NotificationBars 
        quotaStatus={quotaStatus}
        searchQuotaStatus={{
          remainingFreeSearches,
          extraSearches,
          isAtLimit,
          maxMonthlySearches: MAX_MONTHLY_SEARCHES
        }}
        translationQuota={translationQuota}
        maxDailyTranslations={MAX_DAILY_TRANSLATIONS}
        language={language}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col">
          <ChatMessages
            ref={scrollAreaRef}
            sessionMessages={sessionMessages}
            conversationMessages={conversationMessages}
            isLoading={isLoading}
            onTaskConfirm={handleTaskConfirm}
            onTaskEdit={handleTaskEdit}
            onTaskCancel={handleTaskCancel}
          />

          <ChatInput
            message={message}
            setMessage={setMessage}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            activeTrigger={activeTrigger}
            userProfile={userProfile}
          />
        </div>

        <ChatDrawers
          showConversations={showConversations}
          showQuickActions={showQuickActions}
          conversations={conversations}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          onClearChat={handleClearChat}
          onNewConversation={handleNewConversation}
          setShowConversations={setShowConversations}
          setShowQuickActions={setShowQuickActions}
          quotaStatus={quotaStatus}
          isLoading={isLoading}
        />
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 m-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WaktiAIV2;
