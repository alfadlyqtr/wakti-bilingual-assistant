
import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { WaktiAIV2Service, AIMessage, AIConversation } from '@/services/WaktiAIV2Service';
import { useToastHelper } from "@/hooks/use-toast-helper";
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

  const handleSendMessage = async (
    message: string, 
    inputType: 'text' | 'voice' = 'text',
    attachedFiles?: any[]
  ) => {
    if ((!message.trim() && !attachedFiles?.length) || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔄 WAKTI AI V2.5: === ENHANCED FILE ANALYSIS START ===');
      console.log('🔄 WAKTI AI V2.5: Message:', message);
      console.log('🔄 WAKTI AI V2.5: Input Type:', inputType);
      console.log('🔄 WAKTI AI V2.5: Attached Files:', attachedFiles?.length || 0);
      console.log('🔄 WAKTI AI V2.5: Active Trigger:', activeTrigger);

      // Create user message with attached files
      const userMessage: AIMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message || '[File attachment]',
        timestamp: new Date(),
        inputType,
        attachedFiles: attachedFiles || [] // Include files in user message
      };

      const updatedMessages = [...sessionMessages, userMessage].slice(-20);
      setSessionMessages(updatedMessages);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Send message with attached files for analysis
      const response = await WaktiAIV2Service.sendMessage(
        message,
        user.id,
        language,
        currentConversationId,
        inputType,
        updatedMessages.slice(-15),
        false,
        activeTrigger,
        textGenParams,
        attachedFiles || [], // Pass files for analysis
        calendarContext,
        userContext
      );

      console.log('🔄 WAKTI AI V2.5: === ENHANCED RESPONSE RECEIVED ===');
      console.log('🔄 WAKTI AI V2.5: Response length:', response.response?.length);
      console.log('🔄 WAKTI AI V2.5: File Analysis Results:', response.fileAnalysisResults?.length || 0);
      console.log('🔄 WAKTI AI V2.5: Action Taken:', response.actionTaken);

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.conversationId && response.conversationId !== currentConversationId) {
        setCurrentConversationId(response.conversationId);
        console.log('🔄 WAKTI AI V2.5: Updated conversation ID:', response.conversationId);
      }

      // Create assistant message with file analysis results
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
        fileAnalysisResults: response.fileAnalysisResults, // Include analysis results
        deepIntegration: response.deepIntegration,
        automationSuggestions: response.automationSuggestions,
        predictiveInsights: response.predictiveInsights,
        workflowActions: response.workflowActions,
        contextualActions: response.contextualActions,
        needsConfirmation: response.needsConfirmation,
        pendingTaskData: response.pendingTaskData,
        pendingReminderData: response.pendingReminderData
      };

      const finalMessages = [...updatedMessages, assistantMessage].slice(-20);
      setSessionMessages(finalMessages);

      if (response.quotaStatus) {
        setQuotaStatus(response.quotaStatus);
      }

      if (response.requiresSearchConfirmation) {
        setSearchConfirmationRequired(true);
      }

      fetchConversations();

      // Show success messages for different types of analysis
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

    } catch (error: any) {
      console.error('🔄 WAKTI AI V2.5: ❌ Enhanced file analysis error:', error);
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

      const finalMessages = [...sessionMessages, assistantMessage].slice(-20);
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
        console.log('🔄 WAKTI AI V2: Saving unsaved conversation with', sessionMessages.length, 'messages');
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const firstUserMessage = sessionMessages.find(msg => msg.role === 'user');
        const title = firstUserMessage?.content?.slice(0, 50) + '...' || 'Untitled Conversation';

        const { data: conversation, error } = await supabase
          .from('ai_conversations')
          .insert({
            user_id: user.id,
            title: title,
            last_message_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (error) {
          console.error('❌ Error creating conversation:', error);
          return;
        }

        if (conversation) {
          console.log('✅ Created conversation:', conversation.id);
          
          const messageInserts = sessionMessages.map((msg, index) => ({
            conversation_id: conversation.id,
            user_id: user.id,
            role: msg.role,
            content: msg.content,
            created_at: new Date(Date.now() + index).toISOString(),
            language: language,
            input_type: msg.inputType || 'text',
            intent: msg.intent,
            confidence_level: msg.confidence,
            action_taken: msg.actionTaken ? String(msg.actionTaken) : null,
            browsing_used: msg.browsingUsed || false,
            browsing_data: msg.browsingData || null,
            quota_status: msg.quotaStatus || null,
            action_result: msg.actionResult || null
          }));

          const { error: messagesError } = await supabase
            .from('ai_chat_history')
            .insert(messageInserts);

          if (messagesError) {
            console.error('❌ Error saving messages:', messagesError);
          } else {
            console.log('✅ Saved', messageInserts.length, 'messages to conversation');
          }
        }
      } catch (error) {
        console.error('❌ Error in saveCurrentConversationIfNeeded:', error);
      }
    }
  };

  const handleNewConversation = async () => {
    console.log('🆕 Starting new conversation...');
    
    await saveCurrentConversationIfNeeded();
    
    setCurrentConversationId(null);
    setSessionMessages([]);
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
        sessionMessages={sessionMessages}
      />

      <div className="flex-1 flex flex-col h-screen">
        {/* Fixed Header */}
        <div className="flex-shrink-0 bg-background border-b z-10">
          <ChatHeader
            currentConversationId={currentConversationId}
            activeTrigger={activeTrigger}
            onShowConversations={() => setShowConversations(true)}
            onNewConversation={handleNewConversation}
            onShowQuickActions={() => setShowQuickActions(true)}
          />
          <NotificationBars
            searchConfirmationRequired={searchConfirmationRequired}
            error={error}
            onSearchConfirmation={handleSearchConfirmation}
            onDismissSearchConfirmation={() => setSearchConfirmationRequired(false)}
          />
        </div>

        {/* Scrollable Messages Area with bottom padding for fixed input */}
        <div className="flex-1 overflow-hidden pb-[180px]">
          <ChatMessages
            sessionMessages={sessionMessages}
            isLoading={isLoading}
            activeTrigger={activeTrigger}
            scrollAreaRef={scrollAreaRef}
            userProfile={userProfile}
          />
        </div>
      </div>

      {/* Fixed Input at Bottom - positioned to respect drawer width with safe area */}
      <div 
        className="fixed bottom-0 right-0 bg-background border-t z-20 pb-safe" 
        style={{ 
          left: showConversations || showQuickActions ? '320px' : '0',
          paddingBottom: 'max(env(safe-area-inset-bottom), 20px)'
        }}
      >
        <ChatInput
          message={message}
          setMessage={setMessage}
          isLoading={isLoading}
          sessionMessages={sessionMessages}
          onSendMessage={handleSendMessage}
          onClearChat={handleClearChat}
        />
      </div>
    </div>
  );
};

export default WaktiAIV2;
