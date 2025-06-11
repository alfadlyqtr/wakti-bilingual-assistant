import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { WaktiAIV2Service, AIMessage, AIConversation } from '@/services/WaktiAIV2Service';
import { useToastHelper } from "@/hooks/use-toast-helper";
import { useExtendedQuotaManagement } from '@/hooks/useExtendedQuotaManagement';
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
  
  const [calendarContext, setCalendarContext] = useState<any>(null);
  const [userContext, setUserContext] = useState<any>(null);
  
  const scrollAreaRef = useRef<any>(null);
  const { language } = useTheme();
  const { showSuccess, showError } = useToastHelper();

  // Add extended quota management with real-time refresh functions
  const {
    userSearchQuota,
    refreshSearchQuota,
    refreshVoiceQuota,
    incrementRegularSearchUsage,
    incrementAdvancedSearchUsage,
    MAX_MONTHLY_ADVANCED_SEARCHES,
    MAX_MONTHLY_REGULAR_SEARCHES
  } = useExtendedQuotaManagement(language);

  const [sessionMessages, setSessionMessages] = useState<AIMessage[]>([]);
  const [conversationMessages, setConversationMessages] = useState<AIMessage[]>([]);
  const [hasLoadedSession, setHasLoadedSession] = useState(false);

  // Get search quota status for the header
  const getSearchQuotaStatus = () => {
    const regularUsed = userSearchQuota.regular_search_count;
    const advancedUsed = userSearchQuota.daily_count;
    const extraSearches = userSearchQuota.extra_searches;
    
    return {
      regularRemaining: Math.max(0, MAX_MONTHLY_REGULAR_SEARCHES - regularUsed),
      advancedRemaining: Math.max(0, MAX_MONTHLY_ADVANCED_SEARCHES - advancedUsed),
      regularLimit: MAX_MONTHLY_REGULAR_SEARCHES,
      advancedLimit: MAX_MONTHLY_ADVANCED_SEARCHES,
      extraSearches
    };
  };

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

  // UPDATED: Enhanced fetchQuota function with force refresh option
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
          // Load full conversation history from database
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

  // Load full conversation history from database
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

  // Get complete conversation context for AI
  const getCompleteConversationContext = (): AIMessage[] => {
    // Combine conversation messages from DB with session messages
    const allMessages = [...conversationMessages, ...sessionMessages];
    
    // Remove duplicates based on timestamp and content
    const uniqueMessages = allMessages.filter((message, index, self) => 
      index === self.findIndex(m => 
        m.timestamp.getTime() === message.timestamp.getTime() && 
        m.content === message.content &&
        m.role === message.role
      )
    );
    
    // Sort by timestamp
    uniqueMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Keep last 50 messages for better context (increased from 15)
    const contextMessages = uniqueMessages.slice(-50);
    
    console.log('🧠 Complete conversation context:', {
      conversationMessages: conversationMessages.length,
      sessionMessages: sessionMessages.length,
      uniqueMessages: uniqueMessages.length,
      contextMessages: contextMessages.length
    });
    
    return contextMessages;
  };

  // Auto-create conversation and save messages after first exchange
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

  // Save a single message to existing conversation
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

      // Update conversation's last_message_at
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
      console.log('🔄 WAKTI AI V2.5: === ENHANCED CONVERSATION CONTEXT START ===');
      console.log('🔄 WAKTI AI V2.5: Message:', message);
      console.log('🔄 WAKTI AI V2.5: Input Type:', inputType);
      console.log('🔄 WAKTI AI V2.5: Attached Files:', attachedFiles?.length || 0);
      console.log('🔄 WAKTI AI V2.5: Active Trigger:', activeTrigger);

      // Increment quota usage based on trigger type BEFORE sending message
      if (activeTrigger === 'search') {
        console.log('📈 Incrementing regular search usage before operation...');
        const canUse = await incrementRegularSearchUsage();
        if (!canUse) {
          throw new Error(language === 'ar' ? 'تم الوصول للحد الأقصى من البحث العادي' : 'Regular search limit reached');
        }
      } else if (activeTrigger === 'advanced_search') {
        console.log('📈 Incrementing advanced search usage before operation...');
        const canUse = await incrementAdvancedSearchUsage();
        if (!canUse) {
          throw new Error(language === 'ar' ? 'تم الوصول للحد الأقصى من البحث المتقدم' : 'Advanced search limit reached');
        }
      }

      const userMessage: AIMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message || '[File attachment]',
        timestamp: new Date(),
        inputType,
        attachedFiles: attachedFiles || []
      };

      // Add to session messages
      const updatedSessionMessages = [...sessionMessages, userMessage];
      setSessionMessages(updatedSessionMessages);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get complete conversation context (increased from 15 to 50 messages)
      const completeContext = getCompleteConversationContext();
      const contextForAI = [...completeContext, userMessage].slice(-50);

      console.log('🧠 WAKTI AI V2.5: Sending expanded context to AI:', {
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
        contextForAI, // Expanded context instead of just last 15
        false,
        activeTrigger,
        textGenParams,
        attachedFiles || [],
        calendarContext,
        userContext
      );

      console.log('🔄 WAKTI AI V2.5: === ENHANCED RESPONSE RECEIVED ===');
      console.log('🔄 WAKTI AI V2.5: Response length:', response.response?.length);
      console.log('🔄 WAKTI AI V2.5: File Analysis Results:', response.fileAnalysisResults?.length || 0);
      console.log('🔄 WAKTI AI V2.5: Action Taken:', response.actionTaken);
      console.log('🔄 WAKTI AI V2.5: Browsing Used:', response.browsingUsed);

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.conversationId && response.conversationId !== currentConversationId) {
        setCurrentConversationId(response.conversationId);
        // Load full history for new conversation
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
        pendingTaskData: response.pendingTaskData,
        pendingReminderData: response.pendingReminderData
      };

      // Add to session messages (keep last 30 for session, expanded from 20)
      const finalSessionMessages = [...updatedSessionMessages, assistantMessage].slice(-30);
      setSessionMessages(finalSessionMessages);

      // Auto-create conversation if this is the first exchange
      if (!currentConversationId) {
        const allMessagesForConversation = [...updatedSessionMessages, assistantMessage];
        const newConversationId = await createConversationIfNeeded(allMessagesForConversation);
        if (newConversationId) {
          setCurrentConversationId(newConversationId);
          // Load full history for new conversation
          loadFullConversationHistory(newConversationId);
          console.log('🆕 Set new conversation ID:', newConversationId);
          
          // Refresh conversations list
          fetchConversations();
        }
      } else {
        // Save messages to existing conversation
        await saveMessageToConversation(userMessage, currentConversationId);
        await saveMessageToConversation(assistantMessage, currentConversationId);
        
        // Refresh conversations list to update last_message_at
        fetchConversations();
      }

      // ENHANCED: Real-time quota refresh after search operations
      if (response.browsingUsed && (activeTrigger === 'search' || activeTrigger === 'advanced_search')) {
        console.log('🔄 Search operation completed - refreshing quota in real-time...');
        await refreshSearchQuota();
        
        showSuccess(
          language === 'ar' 
            ? `تم تنفيذ البحث ${activeTrigger === 'advanced_search' ? 'المتقدم' : 'العادي'} بنجاح وتحديث الحصة` 
            : `${activeTrigger === 'advanced_search' ? 'Advanced' : 'Basic'} search completed successfully - quota updated`
        );
      }

      // Enhanced quota handling with immediate refresh for search operations
      if (response.quotaStatus) {
        console.log('📊 Received quota status from AI response:', response.quotaStatus);
        setQuotaStatus(response.quotaStatus);
        
        // If browsing was used (search/advanced_search), invalidate cache and force refresh
        if (response.browsingUsed && (activeTrigger === 'search' || activeTrigger === 'advanced_search')) {
          console.log('🔄 Search operation detected - invalidating quota cache and forcing refresh');
          WaktiAIV2Service.invalidateQuotaCache();
          
          // Force refresh quota after a brief delay to ensure backend is updated
          setTimeout(() => {
            fetchQuota(true);
          }, 1000);
        }
      }

      // Voice translation quota refresh
      if (inputType === 'voice') {
        console.log('🔄 Voice operation completed - refreshing voice quota...');
        await refreshVoiceQuota();
      }

      if (response.requiresSearchConfirmation) {
        setSearchConfirmationRequired(true);
      }

      if (response.fileAnalysisResults && response.fileAnalysisResults.length > 0) {
        const successfulAnalyses = response.fileAnalysisResults.filter((result: any) => result.analysis.success);
        if (successfulAnalyses.length > 0) {
          showSuccess(
            language === 'ar' 
              ? `تم تحليل ${successfulAnalyses.length} ملف بنجاح` 
              : `Successfully analyzed ${successfulAnalyses.length} file(s)`
          );
        }
      }

      if (response.workflowActions?.length > 0 || response.predictiveInsights) {
        showSuccess(
          language === 'ar' 
            ? 'تم تفعيل الميزات المتقدمة للجيل الرابع' 
            : 'Phase 4 advanced features activated'
        );
      }

      if (response.needsConfirmation) {
        console.log('🔄 WAKTI AI V2.5: Confirmation card should be shown');
        showSuccess(
          language === 'ar' 
            ? 'تم تحضير البيانات للتأكيد' 
            : 'Data prepared for confirmation'
        );
      }

      // Show success message for search operations
      if (response.browsingUsed && (activeTrigger === 'search' || activeTrigger === 'advanced_search')) {
        showSuccess(
          language === 'ar' 
            ? `تم تنفيذ البحث ${activeTrigger === 'advanced_search' ? 'المتقدم' : 'العادي'} بنجاح` 
            : `${activeTrigger === 'advanced_search' ? 'Advanced' : 'Basic'} search completed successfully`
        );
      }

    } catch (error: any) {
      console.error('🔄 WAKTI AI V2.5: ❌ Enhanced conversation error:', error);
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
    // Save current conversation before starting new one
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
    setConversationMessages([]); // Clear conversation history
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
      
      // Load full conversation history from database
      await loadFullConversationHistory(conversationId);
      
      // Set current conversation
      setCurrentConversationId(conversationId);
      
      // Clear session messages since we're loading from DB
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
    
    if (mode === 'compose') {
      setMessage(text);
    } else {
      handleSendMessage(text);
    }
    
    showSuccess(
      language === 'ar' ? 'تم إنشاء النص بنجاح' : 'Text generated successfully'
    );
  };

  // Combine conversation and session messages for display
  const allDisplayMessages = [...conversationMessages, ...sessionMessages];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
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
      />

      <div className="flex-1 flex flex-col h-screen">
        {/* Fixed Header - positioned below the main app header with glass effect */}
        <div 
          className="fixed top-16 right-0 bg-background/80 backdrop-blur-md border-b rounded-b-2xl z-40"
          style={{ 
            left: showConversations || showQuickActions ? '320px' : '0',
            transition: 'left 0.3s ease-in-out'
          }}
        >
          <ChatHeader
            currentConversationId={currentConversationId}
            activeTrigger={activeTrigger}
            onShowConversations={() => setShowConversations(true)}
            onNewConversation={handleNewConversation}
            onShowQuickActions={() => setShowQuickActions(true)}
            quotaStatus={quotaStatus}
            searchQuotaStatus={getSearchQuotaStatus()}
          />
          <NotificationBars
            searchConfirmationRequired={searchConfirmationRequired}
            error={error}
            onSearchConfirmation={handleSearchConfirmation}
            onDismissSearchConfirmation={() => setSearchConfirmationRequired(false)}
          />
        </div>

        {/* Scrollable Messages Area with reduced top padding for better spacing */}
        <div 
          className="flex-1 overflow-hidden"
          style={{ 
            paddingTop: '130px', // Reduced from 140px - Bringing content closer to header
            paddingBottom: '100px' // Account for input area
          }}
        >
          <ChatMessages
            sessionMessages={allDisplayMessages}
            isLoading={isLoading}
            activeTrigger={activeTrigger}
            scrollAreaRef={scrollAreaRef}
            userProfile={userProfile}
          />
        </div>
      </div>

      {/* Fixed Input at Bottom */}
      <div 
        className="fixed bottom-8 right-0 bg-background border-t z-20 pb-safe" 
        style={{ 
          left: showConversations || showQuickActions ? '320px' : '0',
          paddingBottom: 'max(env(safe-area-inset-bottom), 20px)',
          transition: 'left 0.3s ease-in-out'
        }}
      >
        <ChatInput
          message={message}
          setMessage={setMessage}
          isLoading={isLoading}
          sessionMessages={allDisplayMessages}
          onSendMessage={handleSendMessage}
          onClearChat={handleClearChat}
        />
      </div>
    </div>
  );
};

export default WaktiAIV2;

</edits_to_apply>
