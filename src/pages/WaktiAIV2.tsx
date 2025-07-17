
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { WaktiAIV2Service, WaktiAIV2ServiceClass, AIMessage, AIConversation } from '@/services/WaktiAIV2Service';
import { useToastHelper } from "@/hooks/use-toast-helper";
import { useExtendedQuotaManagement } from '@/hooks/useExtendedQuotaManagement';
import { useQuotaManagement } from '@/hooks/useQuotaManagement';
import { useAIQuotaManagement } from '@/hooks/useAIQuotaManagement';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessages } from '@/components/wakti-ai-v2/ChatMessages';
import { ChatInput } from '@/components/wakti-ai-v2/ChatInput';
import { ChatDrawers } from '@/components/wakti-ai-v2/ChatDrawers';
import { NotificationBars } from '@/components/wakti-ai-v2/NotificationBars';
import { TRService } from '@/services/trService';
import { useVideoStatusPoller } from '@/hooks/useVideoStatusPoller';

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
  const [newMessage, setNewMessage] = useState('');
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
  const { addTask: addVideoTask } = useVideoStatusPoller();

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
      const limitedMessages = session.messages.slice(-25);
      setSessionMessages(limitedMessages);
      setCurrentConversationId(session.conversationId || null);
      setIsNewConversation(!session.conversationId);
    }
  };

  useEffect(() => {
    const handleSessionMessageUpdate = (event: CustomEvent) => {
      const { filter, update } = event.detail;
      
      setSessionMessages(prevMessages => 
        prevMessages.map(msg => {
          if (filter(msg)) {
            return update(msg);
          }
          return msg;
        })
      );
    };
    
    window.addEventListener('updateSessionMessage', handleSessionMessageUpdate as EventListener);
    
    return () => {
      window.removeEventListener('updateSessionMessage', handleSessionMessageUpdate as EventListener);
    };
  }, []);

  useEffect(() => {
    const handleOpenConversationsDrawer = () => {
      console.log('💬 EXTRA BUTTON: Opening conversations drawer');
      setShowConversations(true);
    };

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

  const isExplicitTaskCommand = (messageContent: string): boolean => {
    const lowerMessage = messageContent.toLowerCase().trim();
    
    const englishTaskPatterns = [
      /^(please\s+)?(create|make|add|new)\s+(a\s+)?task\s*:?\s*(.{5,})/i,
      /^(can\s+you\s+)?(create|make|add)\s+(a\s+)?task\s+(for|about|to|that)\s+(.{5,})/i,
      /^(i\s+need\s+)?(a\s+)?(new\s+)?task\s+(for|about|to|that)\s+(.{5,})/i,
      /^task\s*:\s*(.{5,})/i,
      /^add\s+task\s*:?\s*(.{5,})/i,
      /^create\s+task\s*:?\s*(.{5,})/i,
      /^make\s+task\s*:?\s*(.{5,})/i
    ];
    
    const arabicTaskPatterns = [
      /^(من\s+فضلك\s+)?(أنشئ|اعمل|أضف|مهمة\s+جديدة)\s*(مهمة)?\s*:?\s*(.{5,})/i,
      /^(هل\s+يمكنك\s+)?(إنشاء|عمل|إضافة)\s+(مهمة)\s+(لـ|حول|من\s+أجل|بخصوص)\s+(.{5,})/i,
      /^(أحتاج\s+)?(إلى\s+)?(مهمة\s+جديدة)\s+(لـ|حول|من\s+أجل|بخصوص)\s+(.{5,})/i,
      /^مهمة\s*:\s*(.{5,})/i,
      /^أضف\s+مهمة\s*:?\s*(.{5,})/i,
      /^أنشئ\s+مهمة\s*:?\s*(.{5,})/i,
      /^اعمل\s+مهمة\s*:?\s*(.{5,})/i
    ];

    const allPatterns = [...englishTaskPatterns, ...arabicTaskPatterns];
    return allPatterns.some(pattern => pattern.test(messageContent));
  };

  const handleSendMessage = async (messageContent: string, trigger: string = 'chat', attachedFiles?: any[]) => {
    if (isQuotaExceeded || isExtendedQuotaExceeded || isAIQuotaExceeded) {
      showError(language === 'ar' ? 'تجاوزت الحد المسموح به' : 'Quota exceeded');
      return;
    }

    if (!messageContent || !messageContent.trim()) {
      showError(language === 'ar' ? 'يرجى كتابة رسالة' : 'Please enter a message');
      return;
    }

    if (!userProfile?.id) {
      showError(language === 'ar' ? 'يرجى تسجيل الدخول' : 'Please login first');
      return;
    }

    let finalInputType: 'text' | 'voice' | 'vision' = 'text';
    let routingMode = activeTrigger;

    if (attachedFiles && attachedFiles.length > 0) {
      finalInputType = 'vision';
      if (routingMode !== 'video') {
        routingMode = 'vision';
      }
    }

    console.log('🚀 SIMPLIFIED MESSAGE ROUTING: Respecting selected mode', {
      selectedMode: activeTrigger,
      routingMode: routingMode,
      messagePreview: messageContent.substring(0, 50) + '...',
      hasFiles: !!attachedFiles?.length
    });

    setIsLoading(true);
    setError(null);
    const startTime = Date.now();

    try {
      if (routingMode === 'image') {
        console.log('🎨 ROUTING TO IMAGE MODE: Selected mode overrides content detection');
        
        const tempUserMessage: AIMessage = {
          id: `user-temp-${Date.now()}`,
          role: 'user',
          content: messageContent,
          timestamp: new Date(),
          inputType: finalInputType,
          attachedFiles: attachedFiles
        };
        
        setSessionMessages(prevMessages => [...prevMessages, tempUserMessage]);
        
        const imageResponse = await WaktiAIV2Service.sendMessage(
          messageContent,
          userProfile?.id,
          language,
          currentConversationId,
          finalInputType,
          [],
          false,
          'image',
          '',
          attachedFiles || []
        );
        
        if (imageResponse.error) {
          throw new Error(imageResponse.error);
        }
        
        const assistantMessage: AIMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: imageResponse.response || 'Image generation completed',
          timestamp: new Date(),
          imageUrl: imageResponse.imageUrl
        };
        
        setSessionMessages(prevMessages => {
          const newMessages = [...prevMessages];
          newMessages[newMessages.length - 1] = assistantMessage;
          return [...newMessages.slice(0, -1), tempUserMessage, assistantMessage];
        });
        
        setCurrentConversationId(imageResponse.conversationId);
        setIsNewConversation(false);
        
      } else if (routingMode === 'search') {
        console.log('🔍 ROUTING TO SEARCH MODE: Selected mode overrides content detection');
        
        const tempUserMessage: AIMessage = {
          id: `user-temp-${Date.now()}`,
          role: 'user',
          content: messageContent,
          timestamp: new Date(),
          inputType: finalInputType,
          attachedFiles: attachedFiles
        };
        
        setSessionMessages(prevMessages => [...prevMessages, tempUserMessage]);
        
        const searchResponse = await WaktiAIV2Service.sendMessage(
          messageContent,
          userProfile?.id,
          language,
          currentConversationId,
          finalInputType,
          [],
          false,
          'search',
          '',
          attachedFiles || []
        );
        
        if (searchResponse.error) {
          throw new Error(searchResponse.error);
        }
        
        const assistantMessage: AIMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: searchResponse.response || 'Search completed',
          timestamp: new Date(),
          browsingUsed: searchResponse.browsingUsed,
          browsingData: searchResponse.browsingData
        };
        
        setSessionMessages(prevMessages => {
          const newMessages = [...prevMessages];
          newMessages[newMessages.length - 1] = assistantMessage;
          return [...newMessages.slice(0, -1), tempUserMessage, assistantMessage];
        });
        
        setCurrentConversationId(searchResponse.conversationId);
        setIsNewConversation(false);
        
      } else {
        // CHAT MODE OR EXPLICIT TASK COMMANDS (existing logic for chat/tasks)
        if (isExplicitTaskCommand(messageContent)) {
          console.log('🎯 EXPLICIT TASK COMMAND DETECTED: Processing with task confirmation UI');
          
          const taskResponse = await supabase.functions.invoke('process-ai-intent', {
            body: {
              text: messageContent,
              mode: 'assistant',
              userId: userProfile.id,
              conversationHistory: sessionMessages.slice(-10)
            }
          });

          if (taskResponse.error) {
            console.error('❌ TASK PROCESSING ERROR:', taskResponse.error);
            throw new Error(`Task processing failed: ${taskResponse.error.message}`);
          }

          const taskData = taskResponse.data;

          const tempUserMessage: AIMessage = {
            id: `user-temp-${Date.now()}`,
            role: 'user',
            content: messageContent,
            timestamp: new Date(),
            inputType: finalInputType,
            attachedFiles: attachedFiles
          };

          const taskMessage: AIMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: taskData.response || 'Task processing completed',
            timestamp: new Date()
          };

          setSessionMessages(prevMessages => [...prevMessages, tempUserMessage, taskMessage]);

          if (taskData.intent === 'parse_task' && taskData.intentData?.pendingTask) {
            setPendingTaskData(taskData.intentData.pendingTask);
            setTimeout(() => {
              setShowTaskConfirmation(true);
            }, 50);
          }

          setIsLoading(false);
          return;
        }

        // DEFAULT CHAT MODE WITH SIMPLIFIED MEMORY
        console.log('💬 ROUTING TO CHAT MODE: Regular conversation with simplified memory');
        
        const tempUserMessage: AIMessage = {
          id: `user-temp-${Date.now()}`,
          role: 'user',
          content: messageContent,
          timestamp: new Date(),
          inputType: finalInputType,
          attachedFiles: attachedFiles
        };
        
        setSessionMessages(prevMessages => [...prevMessages, tempUserMessage]);
        
        const aiResponse = await WaktiAIV2Service.sendMessage(
          messageContent,
          userProfile?.id,
          language,
          currentConversationId,
          finalInputType,
          [],
          false,
          'chat',
          '',
          attachedFiles || []
        );

        if (aiResponse.error) {
          throw new Error(aiResponse.error);
        }
        
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

        if (aiResponse.showTaskForm && aiResponse.taskData) {
          setPendingTaskData(aiResponse.taskData);
          setShowTaskConfirmation(true);
        }

        if (aiResponse.reminderCreated && aiResponse.reminderData) {
          showSuccess(language === 'ar' ? 'تم إنشاء التذكير بنجاح!' : 'Reminder created successfully!');
        }
        
        setSessionMessages(prevMessages => {
          const newMessages = [...prevMessages];
          newMessages[newMessages.length - 1] = assistantMessage;
          return [...newMessages.slice(0, -1), tempUserMessage, assistantMessage];
        });
        
        setCurrentConversationId(aiResponse.conversationId);
        setIsNewConversation(false);
      }
      
      const totalTime = Date.now() - startTime;
      console.log(`✅ SIMPLIFIED MEMORY SUCCESS: Message routed to ${routingMode} mode in ${totalTime}ms`);
      
      setProcessedFiles([]);
      checkQuotas();
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (err: any) {
      const totalTime = Date.now() - startTime;
      console.error("❌ ERROR:", err);
      console.error("📊 ERROR DETAILS:", {
        message: err.message,
        totalTime: totalTime + 'ms',
        stack: err.stack?.substring(0, 300)
      });
      
      setSessionMessages(prevMessages => {
        const newMessages = [...prevMessages];
        newMessages.pop();
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

    const aiQuotaExceeded = false;
    setIsAIQuotaExceeded(aiQuotaExceeded);
  };

  useEffect(() => {
    checkQuotas();
  }, [canTranslate, canUseVoice]);

  const handleTaskConfirmation = async (taskData: any) => {
    setTaskConfirmationLoading(true);
    try {
      console.log('🎯 CREATING TASK:', taskData);
      
      const createdTask = await TRService.createTask({
        title: taskData.title,
        description: taskData.description || '',
        due_date: taskData.due_date || undefined,
        due_time: taskData.due_time || undefined,
        priority: taskData.priority || 'normal',
        task_type: 'one-time',
        is_shared: false
      });

      console.log('✅ TASK CREATED:', createdTask);

      if (taskData.subtasks && taskData.subtasks.length > 0) {
        console.log('🎯 CREATING SUBTASKS:', taskData.subtasks);
        for (let i = 0; i < taskData.subtasks.length; i++) {
          await TRService.createSubtask({
            task_id: createdTask.id,
            title: taskData.subtasks[i],
            completed: false,
            order_index: i,
          });
        }
      }

      showSuccess(language === 'ar' ? 'تم إنشاء المهمة بنجاح!' : 'Task created successfully!');
    } catch (error) {
      console.error('❌ TASK CREATION ERROR:', error);
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

  const handleNewConversation = () => {
    setSessionMessages([]);
    setCurrentConversationId(null);
    setIsNewConversation(true);
    setIsSidebarOpen(false);
    
    console.log('🗑️ SIMPLIFIED MEMORY: New conversation started');
  };

  const handleSelectConversation = async (conversationId: string) => {
    try {
      const messages = await WaktiAIV2Service.getConversationMessages(conversationId);
      const limitedMessages = messages.slice(-25).map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: new Date(msg.created_at),
        intent: msg.intent,
        confidence: msg.confidence_level as 'high' | 'medium' | 'low',
        actionTaken: msg.action_taken,
        inputType: msg.input_type as 'text' | 'voice' | 'vision',
        browsingUsed: msg.browsing_used,
        browsingData: msg.browsing_data
      }));
      
      setSessionMessages(limitedMessages);
      setCurrentConversationId(conversationId);
      setIsNewConversation(false);
      setIsSidebarOpen(false);

      WaktiAIV2Service.saveChatSession(limitedMessages, conversationId);

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
      
      console.log('🗑️ SIMPLIFIED MEMORY: Chat cleared');
      
      setIsClearingChat(false);
    }, 500);
  };

  const handleFileChange = (file: File) => {
    setFile(file);
    // Handle file processing logic here
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Chat Messages */}
      <div className="flex-1 overflow-hidden">
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

      {/* Chat Input */}
      <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <ChatInput
          onSendMessage={handleSendMessage}
          onFileUpload={handleFileChange}
          disabled={isLoading}
          placeholder={language === 'ar' ? 'اكتب رسالتك...' : 'Type your message...'}
        />
      </div>

      {/* Drawers and Overlays */}
      <ChatDrawers
        showConversations={showConversations}
        setShowConversations={setShowConversations}
        showQuickActions={showQuickActions}
        setShowQuickActions={setShowQuickActions}
        conversations={conversations}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onNewConversation={handleNewConversation}
        currentConversationId={currentConversationId}
        fetchConversations={() => {}}
        onSendMessage={handleSendMessage}
        activeTrigger={activeTrigger}
        onTriggerChange={setActiveTrigger}
        onTextGenerated={() => {}}
        onClearChat={handleClearChat}
        sessionMessages={sessionMessages}
        isLoading={isLoading}
      />

      {/* Notification Bars */}
      <NotificationBars
        searchConfirmationRequired={false}
        onSearchConfirmation={() => {}}
        onQuotaRefresh={() => {}}
        quotaStatus={{ needs_upgrade: isQuotaExceeded }}
        requestTimeout={false}
        onTimeoutRetry={() => {}}
      />
    </div>
  );
};

export default WaktiAIV2;
