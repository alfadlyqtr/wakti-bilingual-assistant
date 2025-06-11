import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { WaktiAIV2Service, AIMessage, AIConversation } from '@/services/WaktiAIV2Service';
import { useToastHelper } from "@/hooks/use-toast-helper";
import { supabase } from '@/integrations/supabase/client';
import { PageContainer } from '@/components/PageContainer';
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
  
  // Phase 4: Enhanced context state
  const [calendarContext, setCalendarContext] = useState<any>(null);
  const [userContext, setUserContext] = useState<any>(null);
  
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

  // Phase 4: Fetch enhanced context
  useEffect(() => {
    const fetchEnhancedContext = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        console.log('🔄 WAKTI AI V2.5: Fetching Phase 4 enhanced context...');

        // Fetch calendar and user context in parallel
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

  // Fetch user profile
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

  const handleSendMessage = async (
    message: string, 
    inputType: 'text' | 'voice' = 'text',
    attachedFiles?: any[]
  ) => {
    if ((!message.trim() && !attachedFiles?.length) || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔄 WAKTI AI V2.5: === PHASE 4 SEND MESSAGE START ===');
      console.log('🔄 WAKTI AI V2.5: Message:', message);
      console.log('🔄 WAKTI AI V2.5: Input Type:', inputType);
      console.log('🔄 WAKTI AI V2.5: Active Trigger (PHASE 4):', activeTrigger);
      console.log('🔄 WAKTI AI V2.5: Calendar Context Available:', !!calendarContext);
      console.log('🔄 WAKTI AI V2.5: User Context Available:', !!userContext);

      // Create user message
      const userMessage: AIMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message || '[File attachment]',
        timestamp: new Date(),
        inputType
      };

      // Add user message to session (limit to 20 messages)
      const updatedMessages = [...sessionMessages, userMessage].slice(-20);
      setSessionMessages(updatedMessages);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Send message with Phase 4 enhanced context
      const response = await WaktiAIV2Service.sendMessage(
        message,
        user.id,
        language,
        currentConversationId,
        inputType,
        updatedMessages.slice(-15), // Send last 15 messages for better context
        false, // confirmSearch
        activeTrigger,
        textGenParams,
        attachedFiles || [],
        calendarContext, // Phase 4: Calendar context
        userContext // Phase 4: User context
      );

      console.log('🔄 WAKTI AI V2.5: === PHASE 4 RESPONSE RECEIVED ===');
      console.log('🔄 WAKTI AI V2.5: Response length:', response.response?.length);
      console.log('🔄 WAKTI AI V2.5: Needs Confirmation:', response.needsConfirmation);
      console.log('🔄 WAKTI AI V2.5: Pending Task Data:', response.pendingTaskData);
      console.log('🔄 WAKTI AI V2.5: Pending Reminder Data:', response.pendingReminderData);

      if (response.error) {
        throw new Error(response.error);
      }

      // Update conversation ID if new
      if (response.conversationId && response.conversationId !== currentConversationId) {
        setCurrentConversationId(response.conversationId);
        console.log('🔄 WAKTI AI V2.5: Updated conversation ID:', response.conversationId);
      }

      // Create assistant message with Phase 4 features
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
        // Phase 4: Advanced features
        deepIntegration: response.deepIntegration,
        automationSuggestions: response.automationSuggestions,
        predictiveInsights: response.predictiveInsights,
        workflowActions: response.workflowActions,
        contextualActions: response.contextualActions,
        // Task/Reminder confirmation data
        needsConfirmation: response.needsConfirmation,
        pendingTaskData: response.pendingTaskData,
        pendingReminderData: response.pendingReminderData
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

      // Show success message for Phase 4 features
      if (response.workflowActions?.length > 0 || response.predictiveInsights) {
        showSuccess(
          language === 'ar' 
            ? 'تم تفعيل الميزات المتقدمة للجيل الرابع' 
            : 'Phase 4 advanced features activated'
        );
      }

      // Show success message if files were processed
      if (attachedFiles && attachedFiles.length > 0) {
        showSuccess(
          language === 'ar' 
            ? `تم تحليل ${attachedFiles.length} ملف بنجاح` 
            : `Successfully analyzed ${attachedFiles.length} file(s)`
        );
      }

      // Show success message for confirmation cards
      if (response.needsConfirmation) {
        console.log('🔄 WAKTI AI V2.5: Confirmation card should be shown');
        showSuccess(
          language === 'ar' 
            ? 'تم تحضير البيانات للتأكيد' 
            : 'Data prepared for confirmation'
        );
      }

    } catch (error: any) {
      console.error('🔄 WAKTI AI V2.5: ❌ Phase 4 send message error:', error);
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

  // Handle text generated from tools
  const handleTextGenerated = (text: string, mode: 'compose' | 'reply') => {
    console.log('📝 Text generated from tool:', { text, mode });
    
    if (mode === 'compose') {
      // Replace the current message input with generated text
      setMessage(text);
    } else {
      // For reply mode, send the generated text immediately
      handleSendMessage(text);
    }
    
    showSuccess(
      language === 'ar' ? 'تم إنشاء النص بنجاح' : 'Text generated successfully'
    );
  };

  return (
    <PageContainer showHeader={true}>
      <div className="flex h-full bg-background overflow-hidden relative">
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

        {/* MAIN CONTAINER - Natural layout within PageContainer */}
        <div className="flex-1 flex flex-col h-full">
          
          {/* NOTIFICATION BARS - At top */}
          <NotificationBars
            searchConfirmationRequired={searchConfirmationRequired}
            error={error}
            onSearchConfirmation={handleSearchConfirmation}
            onDismissSearchConfirmation={() => setSearchConfirmationRequired(false)}
          />
          
          {/* MESSAGES CONTAINER - Flexible middle section */}
          <div className="flex-1 overflow-hidden">
            <ChatMessages
              sessionMessages={sessionMessages}
              isLoading={isLoading}
              activeTrigger={activeTrigger}
              scrollAreaRef={scrollAreaRef}
              userProfile={userProfile}
            />
          </div>

          {/* INPUT - Natural bottom position */}
          <div className="bg-background border-t">
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
      </div>
    </PageContainer>
  );
};

export default WaktiAIV2;
