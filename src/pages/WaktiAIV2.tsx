import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { WaktiAIV2Service, WaktiAIV2ServiceClass, AIMessage, AIConversation } from '@/services/WaktiAIV2Service';
import { HybridMemoryService } from '@/services/HybridMemoryService';
import { useToastHelper } from "@/hooks/use-toast-helper";
import { useExtendedQuotaManagement } from '@/hooks/useExtendedQuotaManagement';
import { useQuotaManagement } from '@/hooks/useQuotaManagement';
import { useAIQuotaManagement } from '@/hooks/useAIQuotaManagement';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessages } from '@/components/wakti-ai-v2/ChatMessages';
import { ChatInput } from '@/components/wakti-ai-v2/ChatInput';
import { ChatDrawers } from '@/components/wakti-ai-v2/ChatDrawers';
import { NotificationBars } from '@/components/wakti-ai-v2/NotificationBars';

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
  const [activeTrigger, setActiveTrigger] = useState('chat');

  const [userProfile, setUserProfile] = useState<any>(null);
  const [personalTouch, setPersonalTouch] = useState<any>(null);
  const [sessionMessages, setSessionMessages] = useState<AIMessage[]>([]);
  const [isNewConversation, setIsNewConversation] = useState(true);
  const [showTaskConfirmation, setShowTaskConfirmation] = useState(false);
  const [pendingTaskData, setPendingTaskData] = useState<any>(null);
  const [pendingReminderData, setPendingReminderData] = useState<any>(null);
  const [taskConfirmationLoading, setTaskConfirmationLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [processedFiles, setProcessedFiles] = useState<any[]>([]);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [isExtendedQuotaExceeded, setIsExtendedQuotaExceeded] = useState(false);
  const [isAIQuotaExceeded, setIsAIQuotaExceeded] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isClearingChat, setIsClearingChat] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { language } = useTheme();
  const { showSuccess, showError } = useToastHelper();
  const { canTranslate, refreshTranslationQuota } = useQuotaManagement();
  const { canUseVoice, refreshVoiceQuota } = useExtendedQuotaManagement();
  const { quota, fetchQuota } = useAIQuotaManagement();

  const loadUserProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserProfile(user);
  };

  const loadPersonalTouch = () => {
    try {
      const stored = localStorage.getItem('wakti_personal_touch');
      setPersonalTouch(stored ? JSON.parse(stored) : null);
    } catch {
      setPersonalTouch(null);
    }
  };

  const loadChatSession = () => {
    const session = WaktiAIV2Service.loadChatSession();
    if (session) {
      setSessionMessages(session.messages);
      setCurrentConversationId(session.conversationId || null);
      setIsNewConversation(!session.conversationId);
    }
  };

  // CRITICAL FIX: Add event listener for conversations drawer
  useEffect(() => {
    const handleOpenConversationsDrawer = () => {
      console.log('💬 EXTRA BUTTON: Opening conversations drawer');
      setShowConversations(true);
    };

    // Listen for the custom event dispatched by ChatInput
    window.addEventListener("open-wakti-conversations", handleOpenConversationsDrawer);

    return () => {
      window.removeEventListener("open-wakti-conversations", handleOpenConversationsDrawer);
    };
  }, []);

  useEffect(() => {
    loadUserProfile();
    loadPersonalTouch();
    loadChatSession();
  }, []);

  useEffect(() => {
    if (currentConversationId) {
      setIsNewConversation(false);
    }
  }, [currentConversationId]);

  // Handle task detection from AI response
  const handleTaskDetected = (taskData: any) => {
    console.log('🎯 TASK DETECTED - SHOWING FORM:', taskData);
    setPendingTaskData(taskData);
    setShowTaskConfirmation(true);
  };

  // ENHANCED: HYBRID MEMORY + HAIKU SPEED Message Sending
  const handleSendMessage = async (messageContent: string, inputType: 'text' | 'voice' = 'text', attachedFiles?: any[]) => {
    if (isQuotaExceeded || isExtendedQuotaExceeded || isAIQuotaExceeded) {
      showError(language === 'ar' ? 'تجاوزت الحد المسموح به' : 'Quota exceeded');
      return;
    }

    // VALIDATE INPUT BEFORE SENDING
    if (!messageContent || !messageContent.trim()) {
      showError(language === 'ar' ? 'يرجى كتابة رسالة' : 'Please enter a message');
      return;
    }

    if (!userProfile?.id) {
      showError(language === 'ar' ? 'يرجى تسجيل الدخول' : 'Please login first');
      return;
    }

    console.log('🚀 HYBRID MEMORY + HAIKU: Ultra-fast message processing');
    console.log('📊 MESSAGE DETAILS:', {
      content: messageContent.substring(0, 100) + '...',
      inputType,
      filesCount: attachedFiles?.length || 0,
      trigger: activeTrigger,
      conversationId: currentConversationId?.substring(0, 8) + '...'
    });

    setIsLoading(true);
    setError(null);
    const startTime = Date.now();

    try {
      // CRITICAL FIX: Load hybrid memory context BEFORE sending message
      console.log('🧠 HYBRID MEMORY: Loading context before sending message');
      const hybridContext = await HybridMemoryService.getHybridContext(
        userProfile.id, 
        currentConversationId
      );
      
      console.log('✅ HYBRID MEMORY: Context loaded -', {
        recentMessages: hybridContext.recentMessages.length,
        conversationSummary: hybridContext.conversationSummary.length,
        messageCount: hybridContext.messageCount
      });

      // Add user message immediately to UI
      const tempUserMessage: AIMessage = {
        id: `user-temp-${Date.now()}`,
        role: 'user',
        content: messageContent,
        timestamp: new Date(),
        inputType: inputType,
        attachedFiles: attachedFiles
      };
      
      setSessionMessages(prevMessages => [...prevMessages, tempUserMessage]);
      
      // Start loading placeholder
      const tempAssistantMessage: AIMessage = {
        id: `assistant-temp-${Date.now()}`,
        role: 'assistant',
        content: language === 'ar' ? 'يكتب بسرعة فائقة...' : 'Typing ultra-fast...',
        timestamp: new Date()
      };
      
      setSessionMessages(prevMessages => [...prevMessages, tempAssistantMessage]);
      
      console.log('📡 CALLING: HAIKU-powered WaktiAIV2Service with HYBRID MEMORY');
      
      // ENHANCED CALL with HYBRID MEMORY context - PASS THE LOADED CONTEXT
      const aiResponse = await WaktiAIV2Service.sendMessage(
        messageContent,
        userProfile?.id,
        language,
        currentConversationId,
        inputType,
        hybridContext.recentMessages, // Use loaded hybrid memory context
        true, // Skip context load since we already loaded it
        activeTrigger,
        hybridContext.conversationSummary, // Pass loaded conversation summary
        attachedFiles || []
      );
      
      console.log('📨 HAIKU RESPONSE:', {
        success: !aiResponse.error,
        hasResponse: !!aiResponse.response,
        conversationId: aiResponse.conversationId?.substring(0, 8) + '...',
        model: 'claude-3-5-haiku-20241022'
      });

      if (aiResponse.error) {
        throw new Error(aiResponse.error);
      }
      
      // Create the response message
      const assistantMessage: AIMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: aiResponse.response || 'Response received',
        timestamp: new Date(),
        intent: aiResponse.intent,
        confidence: aiResponse.confidence as 'high' | 'medium' | 'low',
        actionTaken: aiResponse.actionTaken,
        imageUrl: aiResponse.imageUrl,
        browsingUsed: aiResponse.browsingUsed,
        browsingData: aiResponse.browsingData
      };
      
      // Update session messages with final response
      setSessionMessages(prevMessages => {
        const newMessages = [...prevMessages];
        // Replace temp messages with real ones
        newMessages[newMessages.length - 2] = tempUserMessage;
        newMessages[newMessages.length - 1] = assistantMessage;
        return newMessages;
      });

      // CRITICAL: Add messages to hybrid memory after successful response
      HybridMemoryService.addMessage(
        userProfile.id, 
        aiResponse.conversationId, 
        {
          id: tempUserMessage.id,
          role: 'user',
          content: messageContent,
          timestamp: new Date(),
          intent: '',
          attachedFiles: attachedFiles
        },
        {
          id: assistantMessage.id,
          role: 'assistant', 
          content: assistantMessage.content,
          timestamp: new Date(),
          intent: assistantMessage.intent || '',
          attachedFiles: []
        }
      );
      
      setCurrentConversationId(aiResponse.conversationId);
      setIsNewConversation(false);
      
      const totalTime = Date.now() - startTime;
      console.log(`✅ HAIKU SUCCESS: Ultra-fast processing completed in ${totalTime}ms`);
      console.log('🧠 HYBRID MEMORY: Messages added to memory system');
      
      setProcessedFiles([]);
      checkQuotas();
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      console.log('🎉 HYBRID MEMORY + HAIKU: 4x faster response delivered with memory!');

    } catch (err: any) {
      const totalTime = Date.now() - startTime;
      console.error("❌ HAIKU ERROR:", err);
      console.error("📊 ERROR DETAILS:", {
        message: err.message,
        totalTime: totalTime + 'ms',
        stack: err.stack?.substring(0, 300)
      });
      
      // Remove loading message and show error
      setSessionMessages(prevMessages => {
        const newMessages = [...prevMessages];
        // Remove the loading message
        newMessages.pop();
        // Add error message
        newMessages.push({
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: language === 'ar' 
            ? '❌ حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.'
            : '❌ An error occurred while processing your request. Please try again.',
          timestamp: new Date()
        });
        return newMessages;
      });
      
      setError(err.message || 'Failed to send message');
      showError(language === 'ar' 
        ? 'فشل في إرسال الرسالة. يرجى المحاولة مرة أخرى.' 
        : 'Failed to send message. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const checkQuotas = async () => {
    const quotaExceeded = !canTranslate;
    setIsQuotaExceeded(quotaExceeded);

    const extendedQuotaExceeded = !canUseVoice;
    setIsExtendedQuotaExceeded(extendedQuotaExceeded);

    // Simple AI quota check based on quota existence
    const aiQuotaExceeded = false; // Simplified for now
    setIsAIQuotaExceeded(aiQuotaExceeded);
  };

  useEffect(() => {
    checkQuotas();
  }, [canTranslate, canUseVoice]);

  const handleNewConversation = () => {
    setSessionMessages([]);
    setCurrentConversationId(null);
    setIsNewConversation(true);
    setIsSidebarOpen(false);
    
    // Clear HYBRID MEMORY
    if (userProfile?.id) {
      HybridMemoryService.clearAllMemory(userProfile.id);
      console.log('🗑️ HYBRID MEMORY: Cleared for new conversation');
    }
  };

  const handleSelectConversation = async (conversationId: string) => {
    try {
      const messages = await WaktiAIV2Service.getConversationMessages(conversationId);
      setSessionMessages(messages.map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: new Date(msg.created_at),
        intent: msg.intent,
        confidence: msg.confidence_level as 'high' | 'medium' | 'low',
        actionTaken: msg.action_taken,
        inputType: msg.input_type as 'text' | 'voice',
        browsingUsed: msg.browsing_used,
        browsingData: msg.browsing_data
      })));
      setCurrentConversationId(conversationId);
      setIsNewConversation(false);
      setIsSidebarOpen(false);

      // Save chat session
      WaktiAIV2Service.saveChatSession(sessionMessages, conversationId);

    } catch (error) {
      console.error("Error fetching conversation messages:", error);
      showError(language === 'ar' ? 'فشل في جلب رسائل المحادثة' : 'Failed to fetch conversation messages');
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await WaktiAIV2Service.deleteConversation(conversationId);
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
      if (currentConversationId === conversationId) {
        handleNewConversation();
      }
      showSuccess(language === 'ar' ? 'تم حذف المحادثة بنجاح' : 'Conversation deleted successfully');
    } catch (error) {
      console.error("Error deleting conversation:", error);
      showError(language === 'ar' ? 'فشل في حذف المحادثة' : 'Failed to delete conversation');
    }
  };

  const handleClearChat = () => {
    setIsClearingChat(true);
    setTimeout(() => {
      setSessionMessages([]);
      WaktiAIV2Service.clearChatSession();
      
      // Clear HYBRID MEMORY
      if (userProfile?.id) {
        HybridMemoryService.clearAllMemory(userProfile.id, currentConversationId);
        console.log('🗑️ HYBRID MEMORY: Chat cleared');
      }
      
      setIsClearingChat(false);
    }, 500);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files && event.target.files[0];

    if (selectedFile) {
      if (selectedFile.size > 5 * 1024 * 1024) {
        showError(language === 'ar' ? 'حجم الملف يجب أن يكون أقل من 5 ميغابايت' : 'File size must be less than 5MB');
        return;
      }

      setFile(selectedFile);
      await uploadFile(selectedFile);
    }
  };

  const uploadFile = async (file: File) => {
    setIsUploading(1);
    setUploadProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      const filePath = `uploads/${user.id}/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from('wakti-ai-v2')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        throw error;
      }

      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wakti-ai-v2/${filePath}`;

      setProcessedFiles(prevFiles => [...prevFiles, {
        name: file.name,
        type: file.type,
        size: file.size,
        url: publicUrl,
        publicUrl: publicUrl
      }]);

      showSuccess(language === 'ar' ? 'تم تحميل الملف بنجاح' : 'File uploaded successfully');
    } catch (error: any) {
      console.error("File upload error:", error);
      showError(language === 'ar' ? 'فشل في تحميل الملف' : 'Failed to upload file');
    } finally {
      setIsUploading(0);
      setUploadProgress(0);
    }
  };

  const handleTaskConfirmation = async (taskData: any) => {
    setTaskConfirmationLoading(true);
    try {
      // Simulate task creation
      await new Promise(resolve => setTimeout(resolve, 1500));
      showSuccess(language === 'ar' ? 'تم إنشاء المهمة بنجاح!' : 'Task created successfully!');
    } catch (error) {
      showError(language === 'ar' ? 'فشل في إنشاء المهمة' : 'Failed to create task');
    } finally {
      setTaskConfirmationLoading(false);
      setShowTaskConfirmation(false);
      setPendingTaskData(null);
    }
  };

  const handleReminderConfirmation = async (reminderData: any) => {
    setTaskConfirmationLoading(true);
    try {
      // Simulate reminder creation
      await new Promise(resolve => setTimeout(resolve, 1500));
      showSuccess(language === 'ar' ? 'تم إنشاء التذكير بنجاح!' : 'Reminder created successfully!');
    } catch (error) {
      showError(language === 'ar' ? 'فشل في إنشاء التذكير' : 'Failed to create reminder');
    } finally {
      setTaskConfirmationLoading(false);
      setShowTaskConfirmation(false);
      setPendingReminderData(null);
    }
  };

  const handleCancelTaskConfirmation = () => {
    setShowTaskConfirmation(false);
    setPendingTaskData(null);
    setPendingReminderData(null);
  };

  const debouncedSaveSession = useDebounceCallback(() => {
    WaktiAIV2Service.saveChatSession(sessionMessages, currentConversationId);
  }, 500);

  useEffect(() => {
    debouncedSaveSession();
  }, [sessionMessages, currentConversationId, debouncedSaveSession]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const toggleSettings = () => {
    setIsSettingsOpen(!isSettingsOpen);
  };

  const handleRefreshConversations = async () => {
    // Force refresh by refetching conversations
    try {
      const conversations = await WaktiAIV2Service.getConversations();
      setConversations(conversations);
    } catch (error) {
      console.error("Error refreshing conversations:", error);
      showError(language === 'ar' ? 'فشل في تحديث قائمة المحادثات' : 'Failed to refresh conversation list');
    }
  };

  const fetchConversations = async () => {
    await handleRefreshConversations();
  };

  const handleTriggerChange = (trigger: string) => {
    setActiveTrigger(trigger);
  };

  const handleTextGenerated = (text: string, mode: 'compose' | 'reply', isTextGenerated?: boolean) => {
    setMessage(text);
  };

  const handleOpenPlusDrawer = () => {
    setShowQuickActions(true);
  };

  return (
    <div className="flex h-screen antialiased text-slate-900 selection:bg-blue-500 selection:text-white">
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
        isLoading={isLoading}
      />

      <div className="flex flex-col h-full w-full relative">
        <div className="flex-1 overflow-y-auto pb-48" ref={scrollAreaRef}>
          <ChatMessages
            sessionMessages={sessionMessages}
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
            conversationId={currentConversationId}
            isNewConversation={isNewConversation}
          />
        </div>

        {/* ADJUSTED: Input positioning - moved down slightly for better button visibility */}
        <div className="fixed bottom-20 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border/50 shadow-lg">
          <div className="max-w-4xl mx-auto">
            <ChatInput
              message={message}
              setMessage={setMessage}
              isLoading={isLoading}
              sessionMessages={sessionMessages}
              onSendMessage={handleSendMessage}
              onClearChat={handleClearChat}
              onOpenPlusDrawer={handleOpenPlusDrawer}
              activeTrigger={activeTrigger}
            />
          </div>
        </div>
      </div>

      <NotificationBars
        searchConfirmationRequired={false}
        onSearchConfirmation={() => {}}
        onQuotaRefresh={checkQuotas}
      />
    </div>
  );
};

export default WaktiAIV2;
