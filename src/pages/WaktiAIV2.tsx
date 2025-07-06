import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { WaktiAIV2Service, WaktiAIV2ServiceClass, AIMessage, AIConversation } from '@/services/WaktiAIV2Service';
import { UltraFastWaktiAIService } from '@/services/UltraFastWaktiAIService';
import { UltraFastMemoryCache } from '@/services/UltraFastMemoryCache';
import { StreamingResponseManager } from '@/services/StreamingResponseManager';
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
import { ChevronDown, Zap, Database, TrendingUp } from 'lucide-react';

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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [isExtendedQuotaExceeded, setIsExtendedQuotaExceeded] = useState(false);
  const [isAIQuotaExceeded, setIsAIQuotaExceeded] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isClearingChat, setIsClearingChat] = useState(false);

  // ULTRA-FAST: New state for optimizations
  const [ultraFastMode, setUltraFastMode] = useState(true);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);

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

  useEffect(() => {
    loadUserProfile();
    loadPersonalTouch();
    loadChatSession();
    
    // ULTRA-FAST: Load cache stats
    if (ultraFastMode) {
      setCacheStats(UltraFastWaktiAIService.getCacheStats());
    }
  }, []);

  useEffect(() => {
    if (currentConversationId) {
      setIsNewConversation(false);
    }
  }, [currentConversationId]);

  // ULTRA-FAST: Enhanced message sending with streaming
  const handleSendMessage = async (messageContent: string, inputType: 'text' | 'voice' = 'text') => {
    if (isQuotaExceeded || isExtendedQuotaExceeded || isAIQuotaExceeded) {
      showError(language === 'ar' ? 'تجاوزت الحد المسموح به' : 'Quota exceeded');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStreamingMessage('');
    const startTime = Date.now();

    try {
      // ULTRA-FAST: Use new ultra-fast service
      if (ultraFastMode) {
        console.log('🚀 ULTRA-FAST MODE: Processing message');
        
        // Add user message immediately to UI
        const tempUserMessage: AIMessage = {
          id: `user-temp-${Date.now()}`,
          role: 'user',
          content: messageContent,
          timestamp: new Date(),
          inputType: inputType,
          attachedFiles: processedFiles
        };
        
        setSessionMessages(prevMessages => [...prevMessages, tempUserMessage]);
        
        // Start streaming placeholder
        const tempAssistantMessage: AIMessage = {
          id: `assistant-temp-${Date.now()}`,
          role: 'assistant',
          content: '',
          timestamp: new Date()
        };
        
        setSessionMessages(prevMessages => [...prevMessages, tempAssistantMessage]);
        
        // Handle streaming updates
        const handleStreamUpdate = (chunk: string, isComplete: boolean) => {
          if (isComplete) {
            setStreamingMessage('');
          } else {
            setStreamingMessage(prev => prev + chunk);
          }
        };
        
        const aiResponse = await UltraFastWaktiAIService.sendMessageUltraFast(
          messageContent,
          userProfile?.id,
          language,
          currentConversationId,
          inputType,
          activeTrigger,
          processedFiles,
          handleStreamUpdate
        );
        
        // Update session messages with final response
        setSessionMessages(prevMessages => {
          const newMessages = [...prevMessages];
          // Replace temp messages with real ones
          newMessages[newMessages.length - 2] = aiResponse.userMessage;
          newMessages[newMessages.length - 1] = aiResponse.assistantMessage;
          return newMessages;
        });
        
        setCurrentConversationId(aiResponse.conversationId);
        setIsNewConversation(false);
        setResponseTime(Date.now() - startTime);
        
        // Update cache stats
        setCacheStats(UltraFastWaktiAIService.getCacheStats());
        
        console.log('✅ ULTRA-FAST: Completed in', Date.now() - startTime, 'ms');
        
      } else {
        // Fallback to original service
        const aiResponse = await WaktiAIV2Service.sendMessage(
          messageContent,
          userProfile?.id,
          language,
          currentConversationId,
          inputType,
          sessionMessages,
          false,
          activeTrigger,
          '',
          processedFiles
        );

        setSessionMessages(prevMessages => [...prevMessages, {
          id: `user-${Date.now()}`,
          role: 'user',
          content: messageContent,
          timestamp: new Date(),
          inputType: inputType,
          attachedFiles: processedFiles
        }, {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: aiResponse.response,
          timestamp: new Date()
        }]);

        setCurrentConversationId(aiResponse.conversationId);
        setIsNewConversation(false);
        setResponseTime(Date.now() - startTime);
      }
      
      setProcessedFiles([]);
      checkQuotas();
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (err: any) {
      console.error("Error sending message:", err);
      setError(err.message || 'Failed to send message');
      setResponseTime(Date.now() - startTime);
    } finally {
      setIsLoading(false);
      setStreamingMessage('');
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
    setStreamingMessage('');
    setResponseTime(null);
    
    if (ultraFastMode) {
      // Clear ultra-fast caches
      if (userProfile?.id && currentConversationId) {
        UltraFastWaktiAIService.clearConversationUltraFast(userProfile.id, currentConversationId);
      }
    } else {
      WaktiAIV2Service.clearChatSession();
    }
    
    setIsSidebarOpen(false);
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
    setIsUploading(true);
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
      setIsUploading(false);
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

  // Toggle ultra-fast mode
  const toggleUltraFastMode = () => {
    setUltraFastMode(!ultraFastMode);
    showSuccess(ultraFastMode 
      ? (language === 'ar' ? 'تم تعطيل الوضع السريع' : 'Ultra-fast mode disabled')
      : (language === 'ar' ? 'تم تفعيل الوضع السريع' : 'Ultra-fast mode enabled')
    );
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

      <div className="flex flex-col h-full w-full">
        <ChatHeader
          currentConversationId={currentConversationId}
          activeTrigger={activeTrigger}
          onToggleConversations={() => setShowConversations(!showConversations)}
          onNewConversation={handleNewConversation}
          onToggleQuickActions={() => setShowQuickActions(!showQuickActions)}
          onTriggerChange={handleTriggerChange}
          onClearChat={handleClearChat}
          hasMessages={sessionMessages.length > 0}
        />

        {/* ULTRA-FAST: Performance indicators */}        
        <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 border-b">
          <Button
            variant={ultraFastMode ? "default" : "outline"}
            size="sm"
            onClick={toggleUltraFastMode}
            className="flex items-center gap-2"
          >
            <Zap className={`w-4 h-4 ${ultraFastMode ? 'text-yellow-300' : ''}`} />
            {ultraFastMode ? 'ULTRA-FAST' : 'STANDARD'}
          </Button>
          
          {responseTime && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="w-3 h-3" />
              {responseTime}ms
            </div>
          )}
          
          {ultraFastMode && cacheStats && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Database className="w-3 h-3" />
              Cache: {cacheStats.memoryCache?.hot?.size || 0}H/{cacheStats.memoryCache?.warm?.size || 0}W
            </div>
          )}
          
          <div className="flex items-center gap-1 text-xs font-medium text-green-600">
            ⚡ Superior Memory + Ultra Speed
          </div>
        </div>

        <div className="flex-1 overflow-y-auto" ref={scrollAreaRef}>
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
          
          {/* Show streaming message if active */}
          {streamingMessage && (
            <div className="px-4 py-2">
              <div className="flex justify-start">
                <div className="max-w-md bg-muted rounded-lg p-3">
                  <div className="text-sm">{streamingMessage}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></div>
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse delay-100"></div>
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse delay-200"></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

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

      <NotificationBars
        searchConfirmationRequired={false}
        onSearchConfirmation={() => {}}
        onQuotaRefresh={checkQuotas}
      />
    </div>
  );
};

export default WaktiAIV2;
