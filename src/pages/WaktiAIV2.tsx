import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
import { toast } from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { useTheme } from '@/providers/ThemeProvider';
import { WaktiAIV2Service, AIMessage, AIConversation } from '@/services/WaktiAIV2Service';
import { ChatHeader } from '@/components/wakti-ai-v2/ChatHeader';
import { ChatInput } from '@/components/wakti-ai-v2/ChatInput';
import { ChatMessages } from '@/components/wakti-ai-v2/ChatMessages';
import { ChatDrawers } from '@/components/wakti-ai-v2/ChatDrawers';
import { NotificationBars } from '@/components/wakti-ai-v2/NotificationBars';

function generateId() {
  return uuidv4();
}

export default function WaktiAIV2() {
  const user = useUser();
  const { language } = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // State variables
  const [message, setMessage] = useState('');
  const [sessionMessages, setSessionMessages] = useState<AIMessage[]>([]);
  const [conversationMessages, setConversationMessages] = useState<AIMessage[]>([]);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showConversations, setShowConversations] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [activeTrigger, setActiveTrigger] = useState<'chat' | 'search' | 'image'>('chat');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [quotaStatus, setQuotaStatus] = useState<any>(null);
  const [searchConfirmationRequired, setSearchConfirmationRequired] = useState(false);
  const [pendingTaskData, setPendingTaskData] = useState<any>(null);
  const [searchQuotaStatus, setSearchQuotaStatus] = useState({
    remainingFreeSearches: 5,
    extraSearches: 0,
    isAtLimit: false,
    maxMonthlySearches: 5
  });
  const [translationQuota, setTranslationQuota] = useState<any>(null);
  const MAX_DAILY_TRANSLATIONS = 5;

  // Load user profile on authentication
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        try {
          const profile = await WaktiAIV2Service.getUserProfile(user.id);
          setUserProfile(profile);
        } catch (error) {
          console.error('Error fetching user profile:', error);
          toast.error('Failed to load user profile.');
        }
      } else {
        setUserProfile(null);
      }
    };

    fetchUserProfile();
  }, [user]);

  // Load conversations on authentication
  useEffect(() => {
    const fetchConversations = async () => {
      if (user) {
        try {
          const convos = await WaktiAIV2Service.getConversations(user.id);
          setConversations(convos);
        } catch (error) {
          console.error('Error fetching conversations:', error);
          toast.error('Failed to load conversations.');
        }
      } else {
        setConversations([]);
      }
    };

    fetchConversations();
  }, [user]);

  // Load conversation messages when conversation ID changes
  useEffect(() => {
    const fetchConversationMessages = async () => {
      if (user && currentConversationId) {
        try {
          const messages = await WaktiAIV2Service.getConversationMessages(currentConversationId);
          setConversationMessages(messages);
        } catch (error) {
          console.error('Error fetching conversation messages:', error);
          toast.error('Failed to load conversation messages.');
        }
      } else {
        setConversationMessages([]);
      }
    };

    fetchConversationMessages();
  }, [user, currentConversationId]);

  // Load quota status on authentication
  useEffect(() => {
    const fetchQuotaStatus = async () => {
      if (user) {
        try {
          const status = await WaktiAIV2Service.getQuotaStatus(user.id);
          setQuotaStatus(status);
        } catch (error) {
          console.error('Error fetching quota status:', error);
          toast.error('Failed to load quota status.');
        }
      } else {
        setQuotaStatus(null);
      }
    };

    fetchQuotaStatus();
  }, [user]);

  // Load search quota status on authentication
  useEffect(() => {
    const fetchSearchQuotaStatus = async () => {
      if (user) {
        try {
          const status = await WaktiAIV2Service.getSearchQuotaStatus(user.id);
          setSearchQuotaStatus(status);
        } catch (error) {
          console.error('Error fetching search quota status:', error);
          toast.error('Failed to load search quota status.');
        }
      } else {
        setSearchQuotaStatus({
          remainingFreeSearches: 5,
          extraSearches: 0,
          isAtLimit: false,
          maxMonthlySearches: 5
        });
      }
    };

    fetchSearchQuotaStatus();
  }, [user]);

  // Load translation quota on authentication
  useEffect(() => {
    const fetchTranslationQuota = async () => {
      if (user) {
        try {
          const quota = await WaktiAIV2Service.getTranslationQuota(user.id);
          setTranslationQuota(quota);
        } catch (error) {
          console.error('Error fetching translation quota:', error);
          toast.error('Failed to load translation quota.');
        }
      } else {
        setTranslationQuota(null);
      }
    };

    fetchTranslationQuota();
  }, [user]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessionMessages, conversationMessages, isLoading]);

  // Handlers
  const handleNewConversation = async () => {
    setCurrentConversationId(null);
    setSessionMessages([]);
    setConversationMessages([]);
    setShowConversations(false);
  };

  const handleSelectConversation = async (id: string) => {
    setCurrentConversationId(id);
    setSessionMessages([]);
    setShowConversations(false);
  };

  const handleDeleteConversation = async (id: string) => {
    setIsLoading(true);
    try {
      await WaktiAIV2Service.deleteConversation(id);
      setConversations(prev => prev.filter(convo => convo.id !== id));
      if (currentConversationId === id) {
        setCurrentConversationId(null);
        setSessionMessages([]);
        setConversationMessages([]);
      }
      toast.success('Conversation deleted successfully.');
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Failed to delete conversation.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setSessionMessages([]);
  };

  const handleTaskEdit = async (taskData: any) => {
    console.log('Editing task with data:', taskData);
    setIsLoading(true);
    
    try {
      const result = await WaktiAIV2Service.executeTaskAction(taskData, user?.id);
      
      if (result.success) {
        console.log('Task edited successfully:', result);
        
        // Add success message to conversation
        const successMessage: AIMessage = {
          id: generateId(),
          role: 'assistant',
          content: result.message,
          timestamp: new Date(),
          userId: user?.id || '',
          conversationId: currentConversationId || '',
          language: language,
          inputType: 'text'
        };
        
        setSessionMessages(prev => [...prev, successMessage]);
        
        // Clear pending task data
        setPendingTaskData(null);
        
        // Show success toast
        toast.success(result.message);
      } else {
        console.error('Task edit failed:', result);
        toast.error(result.message || 'Failed to edit task');
      }
    } catch (error) {
      console.error('Error editing task:', error);
      toast.error('Failed to edit task. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTaskCancel = () => {
    setPendingTaskData(null);
  };

  // FIXED: Proper task confirmation handler
  const handleTaskConfirm = async (taskData: any) => {
    console.log('Confirming task creation with data:', taskData);
    setIsLoading(true);
    
    try {
      const result = await WaktiAIV2Service.executeTaskAction(taskData, user?.id);
      
      if (result.success) {
        console.log('Task created successfully:', result);
        
        // Add success message to conversation
        const successMessage: AIMessage = {
          id: generateId(),
          role: 'assistant',
          content: result.message,
          timestamp: new Date(),
          userId: user?.id || '',
          conversationId: currentConversationId || '',
          language: language,
          inputType: 'text'
        };
        
        setSessionMessages(prev => [...prev, successMessage]);
        
        // Clear pending task data
        setPendingTaskData(null);
        
        // Show success toast
        toast.success(result.message);
      } else {
        console.error('Task creation failed:', result);
        toast.error(result.message || 'Failed to create task');
      }
    } catch (error) {
      console.error('Error confirming task:', error);
      toast.error('Failed to create task. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchConfirmation = () => {
    setSearchConfirmationRequired(false);
  };

  const handleSendMessage = async (messageText: string, inputType: 'text' | 'voice' = 'text', attachedFiles?: any[]) => {
    if (!messageText.trim() && (!attachedFiles || attachedFiles.length === 0)) return;
    if (!user?.id) {
      toast.error('Please log in to continue');
      return;
    }

    const userMessage: AIMessage = {
      id: generateId(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
      userId: user.id,
      conversationId: currentConversationId || '',
      language: language,
      inputType: inputType,
      attachedFiles: attachedFiles
    };

    setSessionMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await WaktiAIV2Service.sendMessage({
        message: messageText,
        userId: user.id,
        language: language,
        conversationId: currentConversationId,
        inputType: inputType,
        conversationHistory: [...conversationMessages, ...sessionMessages, userMessage],
        activeTrigger: activeTrigger,
        attachedFiles: attachedFiles
      });

      console.log('AI Response:', response);

      const assistantMessage: AIMessage = {
        id: generateId(),
        role: 'assistant',
        content: response.response || 'I apologize, but I encountered an error processing your request.',
        timestamp: new Date(),
        userId: user.id,
        conversationId: response.conversationId || currentConversationId || '',
        language: language,
        inputType: 'text',
        imageUrl: response.imageUrl,
        browsingUsed: response.browsingUsed,
        browsingData: response.browsingData,
        // FIXED: Handle task confirmation and clarification properly
        needsConfirmation: response.needsConfirmation || false,
        needsClarification: response.needsClarification || false,
        pendingTaskData: response.pendingTaskData,
        partialTaskData: response.partialTaskData
      };

      setSessionMessages(prev => [...prev, assistantMessage]);

      // FIXED: Set pending task data for confirmation
      if (response.pendingTaskData) {
        console.log('Setting pending task data:', response.pendingTaskData);
        setPendingTaskData(response.pendingTaskData);
      }

      if (!currentConversationId && response.conversationId) {
        setCurrentConversationId(response.conversationId);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage: AIMessage = {
        id: generateId(),
        role: 'assistant',
        content: language === 'ar' 
          ? 'عذراً، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.'
          : 'Sorry, there was an error processing your request. Please try again.',
        timestamp: new Date(),
        userId: user.id,
        conversationId: currentConversationId || '',
        language: language,
        inputType: 'text'
      };
      
      setSessionMessages(prev => [...prev, errorMessage]);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <ChatHeader
        activeTrigger={activeTrigger}
        setActiveTrigger={setActiveTrigger}
        onNewConversation={handleNewConversation}
        onToggleConversations={() => setShowConversations(true)}
        onToggleQuickActions={() => setShowQuickActions(true)}
        quotaStatus={quotaStatus}
        searchConfirmationRequired={searchConfirmationRequired}
        onSearchConfirmation={handleSearchConfirmation}
        remainingFreeSearches={searchQuotaStatus.remainingFreeSearches}
        extraSearches={searchQuotaStatus.extraSearches}
        isAtSearchLimit={searchQuotaStatus.isAtLimit}
        translationQuota={translationQuota}
        MAX_DAILY_TRANSLATIONS={MAX_DAILY_TRANSLATIONS}
      />

      <NotificationBars
        quotaStatus={quotaStatus}
        searchQuotaStatus={searchQuotaStatus}
        translationQuota={translationQuota}
        maxDailyTranslations={MAX_DAILY_TRANSLATIONS}
        language={language}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <ChatMessages
          ref={messagesEndRef}
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
        setShowConversations={setShowConversations}
        showQuickActions={showQuickActions}
        setShowQuickActions={setShowQuickActions}
        conversations={conversations}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onClearChat={handleClearChat}
        onNewConversation={handleNewConversation}
        quotaStatus={quotaStatus}
        isLoading={isLoading}
      />
    </div>
  );
}
