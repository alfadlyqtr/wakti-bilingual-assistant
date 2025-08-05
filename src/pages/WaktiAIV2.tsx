import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { WaktiAIV2Service, AIMessage } from '@/services/WaktiAIV2Service';
import { EnhancedFrontendMemory, ConversationMetadata } from '@/services/EnhancedFrontendMemory';
import { useToastHelper } from "@/hooks/use-toast-helper";
import { useExtendedQuotaManagement } from '@/hooks/useExtendedQuotaManagement';
import { useQuotaManagement } from '@/hooks/useQuotaManagement';
import { useAIQuotaManagement } from '@/hooks/useAIQuotaManagement';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessages } from '@/components/wakti-ai-v2/ChatMessages';
import { ChatInput } from '@/components/wakti-ai-v2/ChatInput';
import { ChatDrawers } from '@/components/wakti-ai-v2/ChatDrawers';
import { ConversationSidebar } from '@/components/wakti-ai-v2/ConversationSidebar';
import { NotificationBars } from '@/components/wakti-ai-v2/NotificationBars';
import { TRService } from '@/services/trService';


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

// Helper function to convert file to base64
const convertFileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Helper function to check if file is an image
const isImageFile = (file: any): boolean => {
  return file.type && file.type.startsWith('image/');
};

const WaktiAIV2 = () => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archivedConversations, setArchivedConversations] = useState<ConversationMetadata[]>([]);
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

  // FRONTEND BOSS: Load memory and conversations
  const loadFrontendMemory = () => {
    console.log('👑 FRONTEND BOSS: Loading memory and conversations');
    
    // Load active conversation
    const { messages, conversationId } = EnhancedFrontendMemory.loadActiveConversation();
    setSessionMessages(messages);
    setCurrentConversationId(conversationId);
    setIsNewConversation(!conversationId || messages.length === 0);
    
    // Load archived conversations for sidebar
    const archived = EnhancedFrontendMemory.loadArchivedConversations();
    setArchivedConversations(archived);
    
    console.log('✅ FRONTEND BOSS: Loaded', messages.length, 'active messages and', archived.length, 'archived conversations');
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
      console.log('💬 OPENING CONVERSATIONS SIDEBAR');
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
    loadFrontendMemory();
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

  const handleSendMessage = async (messageContent: string, trigger: string, attachedFiles?: any[]) => {
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
    let routingMode = activeTrigger; // FIXED: Don't override user's selected mode

    // CLAUDE WAY: Process images differently for vision vs storage
    let processedAttachedFiles: any[] = [];
    
    if (attachedFiles && attachedFiles.length > 0) {
      console.log('🖼️ CLAUDE WAY: Processing attached files for vision', attachedFiles.length);
      
      // Separate images from other files
      const imageFiles = attachedFiles.filter(file => isImageFile(file));
      const nonImageFiles = attachedFiles.filter(file => !isImageFile(file));
      
      if (imageFiles.length > 0) {
        // FIXED: Only set vision mode if user hasn't explicitly selected another mode
        // OR if they selected chat mode (which can handle vision)
        if (routingMode === 'chat' || routingMode === 'vision') {
          finalInputType = 'vision';
          // Only switch to vision mode if user was in chat mode
          if (routingMode === 'chat') {
            routingMode = 'vision';
          }
        }
        
        console.log('🖼️ CLAUDE WAY: Converting', imageFiles.length, 'images to base64 for Claude');
        
        // Convert images to base64 (Claude Way)
        for (const imageFile of imageFiles) {
          try {
            let base64Data: string;
            
            if (imageFile.url && imageFile.url.startsWith('data:')) {
              // Already base64
              base64Data = imageFile.url;
            } else if (imageFile.file) {
              // Convert File object to base64
              base64Data = await convertFileToBase64(imageFile.file);
            } else if (imageFile.url) {
              // Fetch image from URL and convert to base64
              const response = await fetch(imageFile.url);
              const blob = await response.blob();
              const file = new File([blob], imageFile.name || 'image', { type: imageFile.type });
              base64Data = await convertFileToBase64(file);
            } else {
              throw new Error('Invalid image file format');
            }
            
            processedAttachedFiles.push({
              name: imageFile.name,
              type: imageFile.type,
              size: imageFile.size,
              url: base64Data, // Claude Way: Use base64 directly
              preview: imageFile.preview,
              imageType: imageFile.imageType || { id: 'general', name: 'General' }
            });
            
          } catch (error) {
            console.error('❌ CLAUDE WAY: Failed to convert image to base64:', error);
            showError(language === 'ar' ? 'فشل في معالجة الصورة' : 'Failed to process image');
            return;
          }
        }
        
        console.log('✅ CLAUDE WAY: Converted', processedAttachedFiles.length, 'images to base64');
      }
      
      // For non-image files, keep current upload system
      if (nonImageFiles.length > 0) {
        console.log('📁 STORAGE WAY: Processing', nonImageFiles.length, 'non-image files via Supabase');
        // Add non-image files as-is (they should already be uploaded to storage)
        processedAttachedFiles.push(...nonImageFiles);
      }
    }

    console.log('👑 FRONTEND BOSS: Processing message in', routingMode, 'mode');

    setIsLoading(true);
    setError(null);
    const startTime = Date.now();

    try {
      // FRONTEND BOSS: Ensure conversation ID exists
      let workingConversationId = currentConversationId;
      if (!workingConversationId) {
        workingConversationId = EnhancedFrontendMemory.saveActiveConversation([], null);
        setCurrentConversationId(workingConversationId);
        setIsNewConversation(false);
      }

      if (routingMode === 'image') {
        console.log('🎨 FRONTEND BOSS: Processing image generation');
        
        const tempUserMessage: AIMessage = {
          id: `user-temp-${Date.now()}`,
          role: 'user',
          content: messageContent,
          timestamp: new Date(),
          inputType: finalInputType,
          attachedFiles: processedAttachedFiles
        };
        
        const newMessages = [...sessionMessages, tempUserMessage];
        setSessionMessages(newMessages);
        
        // Save to frontend memory
        EnhancedFrontendMemory.saveActiveConversation(newMessages, workingConversationId);
        
        const imageResponse = await WaktiAIV2Service.sendMessage(
          messageContent,
          userProfile?.id,
          language,
          workingConversationId,
          finalInputType,
          newMessages,
          false,
          'image',
          '',
          processedAttachedFiles || []
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
        
        const finalMessages = [...newMessages, assistantMessage];
        setSessionMessages(finalMessages);
        
        // FRONTEND BOSS: Save to memory
        EnhancedFrontendMemory.saveActiveConversation(finalMessages, workingConversationId);
        
      } else if (routingMode === 'search') {
        console.log('🔍 FRONTEND BOSS: Processing search');
        
        const tempUserMessage: AIMessage = {
          id: `user-temp-${Date.now()}`,
          role: 'user',
          content: messageContent,
          timestamp: new Date(),
          inputType: finalInputType,
          attachedFiles: processedAttachedFiles
        };
        
        const newMessages = [...sessionMessages, tempUserMessage];
        setSessionMessages(newMessages);
        
        EnhancedFrontendMemory.saveActiveConversation(newMessages, workingConversationId);
        
        const searchResponse = await WaktiAIV2Service.sendMessage(
          messageContent,
          userProfile?.id,
          language,
          workingConversationId,
          finalInputType,
          newMessages,
          false,
          'search',
          '',
          processedAttachedFiles || []
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
        
        const finalMessages = [...newMessages, assistantMessage];
        setSessionMessages(finalMessages);
        
        EnhancedFrontendMemory.saveActiveConversation(finalMessages, workingConversationId);
        
      } else {
        // CHAT MODE OR EXPLICIT TASK COMMANDS (INCLUDING VISION)
        if (isExplicitTaskCommand(messageContent)) {
          console.log('🎯 FRONTEND BOSS: Processing explicit task command');
          
          const taskResponse = await supabase.functions.invoke('process-ai-intent', {
            body: {
              text: messageContent,
              mode: 'assistant',
              userId: userProfile.id,
              conversationHistory: sessionMessages.slice(-10)
            }
          });

          if (taskResponse.error) {
            console.error('❌ FRONTEND BOSS: Task processing error:', taskResponse.error);
            throw new Error(`Task processing failed: ${taskResponse.error.message}`);
          }

          const taskData = taskResponse.data;

          const tempUserMessage: AIMessage = {
            id: `user-temp-${Date.now()}`,
            role: 'user',
            content: messageContent,
            timestamp: new Date(),
            inputType: finalInputType,
            attachedFiles: processedAttachedFiles
          };

          const taskMessage: AIMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: taskData.response || 'Task processing completed',
            timestamp: new Date()
          };

          const finalMessages = [...sessionMessages, tempUserMessage, taskMessage];
          setSessionMessages(finalMessages);

          if (taskData.intent === 'parse_task' && taskData.intentData?.pendingTask) {
            setPendingTaskData(taskData.intentData.pendingTask);
            setTimeout(() => {
              setShowTaskConfirmation(true);
            }, 50);
          }

          EnhancedFrontendMemory.saveActiveConversation(finalMessages, workingConversationId);

          setIsLoading(false);
          return;
        }

        // DEFAULT CHAT MODE - INCLUDING VISION WITH CLAUDE WAY
        console.log('💬 FRONTEND BOSS: Processing chat mode (including Claude Way vision)');
        
        const tempUserMessage: AIMessage = {
          id: `user-temp-${Date.now()}`,
          role: 'user',
          content: messageContent,
          timestamp: new Date(),
          inputType: finalInputType,
          attachedFiles: processedAttachedFiles
        };
        
        const newMessages = [...sessionMessages, tempUserMessage];
        setSessionMessages(newMessages);
        
        EnhancedFrontendMemory.saveActiveConversation(newMessages, workingConversationId);
        
        const aiResponse = await WaktiAIV2Service.sendMessage(
          messageContent,
          userProfile?.id,
          language,
          workingConversationId,
          finalInputType,
          newMessages,
          false,
          'chat',
          '',
          processedAttachedFiles || []
        );

        if (aiResponse.error) {
          throw new Error(aiResponse.error);
        }
        
        // FIXED: Safe property access for vision responses
        const assistantMessage: AIMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: aiResponse.response || 'Response received',
          timestamp: new Date(),
          intent: aiResponse.intent || undefined,
          confidence: (aiResponse.confidence as 'high' | 'medium' | 'low') || undefined,
          actionTaken: aiResponse.actionTaken || undefined,
          imageUrl: aiResponse.imageUrl || undefined,
          browsingUsed: aiResponse.browsingUsed || undefined,
          browsingData: aiResponse.browsingData || undefined
        };

        // FIXED: Safe task form handling
        if (aiResponse.showTaskForm && aiResponse.taskData) {
          setPendingTaskData(aiResponse.taskData);
          setShowTaskConfirmation(true);
        }

        // FIXED: Safe reminder handling
        if (aiResponse.reminderCreated && aiResponse.reminderData) {
          showSuccess(language === 'ar' ? 'تم إنشاء التذكير بنجاح!' : 'Reminder created successfully!');
        }
        
        const finalMessages = [...newMessages, assistantMessage];
        setSessionMessages(finalMessages);
        
        EnhancedFrontendMemory.saveActiveConversation(finalMessages, workingConversationId);
      }
      
      const totalTime = Date.now() - startTime;
      console.log(`✅ FRONTEND BOSS: Message processed in ${totalTime}ms`);
      
      setProcessedFiles([]);
      checkQuotas();
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (err: any) {
      const totalTime = Date.now() - startTime;
      console.error("❌ FRONTEND BOSS ERROR:", err);
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

  // FRONTEND BOSS: New conversation workflow
  const handleNewConversation = () => {
    console.log('👑 FRONTEND BOSS: Starting new conversation workflow');
    
    const newConversationId = EnhancedFrontendMemory.startNewConversation(sessionMessages, currentConversationId);
    
    setSessionMessages([]);
    setCurrentConversationId(newConversationId);
    setIsNewConversation(true);
    setIsSidebarOpen(false);
    
    // Refresh archived conversations
    const archived = EnhancedFrontendMemory.loadArchivedConversations();
    setArchivedConversations(archived);
    
    console.log('✅ FRONTEND BOSS: New conversation workflow complete');
  };

  // FRONTEND BOSS: Select archived conversation
  const handleSelectConversation = async (conversationId: string) => {
    console.log('👑 FRONTEND BOSS: Loading archived conversation', conversationId);
    
    try {
      // Archive current conversation first
      if (currentConversationId && sessionMessages.length > 0) {
        EnhancedFrontendMemory.archiveCurrentConversation(sessionMessages, currentConversationId);
      }
      
      const conversation = EnhancedFrontendMemory.loadArchivedConversation(conversationId);
      
      if (conversation) {
        setSessionMessages(conversation.messages);
        setCurrentConversationId(conversation.conversationId);
        setIsNewConversation(false);
        setIsSidebarOpen(false);

        // Save as new active conversation
        EnhancedFrontendMemory.saveActiveConversation(conversation.messages, conversation.conversationId);
        
        // Refresh archived list
        const archived = EnhancedFrontendMemory.loadArchivedConversations();
        setArchivedConversations(archived);
        
        console.log('✅ FRONTEND BOSS: Loaded archived conversation successfully');
      } else {
        throw new Error('Conversation not found');
      }

    } catch (error) {
      console.error("❌ FRONTEND BOSS: Error loading conversation:", error);
      showError(language === 'ar' ? 'فشل في جلب المحادثة' : 'Failed to load conversation');
    }
  };

  // FRONTEND BOSS: Delete archived conversation
  const handleDeleteConversation = async (conversationId: string) => {
    console.log('👑 FRONTEND BOSS: Deleting conversation', conversationId);
    
    try {
      const success = EnhancedFrontendMemory.deleteArchivedConversation(conversationId);
      
      if (success) {
        // Refresh archived conversations
        const archived = EnhancedFrontendMemory.loadArchivedConversations();
        setArchivedConversations(archived);
        
        // If this was the current conversation, start new one
        if (currentConversationId === conversationId) {
          handleNewConversation();
        }
        
        showSuccess(language === 'ar' ? 'تم حذف المحادثة بنجاح' : 'Conversation deleted successfully');
      } else {
        throw new Error('Failed to delete conversation');
      }
    } catch (error) {
      console.error("❌ FRONTEND BOSS: Error deleting conversation:", error);
      showError(language === 'ar' ? 'فشل في حذف المحادثة' : 'Failed to delete conversation');
    }
  };

  const handleClearChat = () => {
    console.log('👑 FRONTEND BOSS: Clearing current chat');
    setIsClearingChat(true);
    
    setTimeout(() => {
      // Archive current conversation if it has messages
      if (currentConversationId && sessionMessages.length > 0) {
        EnhancedFrontendMemory.archiveCurrentConversation(sessionMessages, currentConversationId);
      }
      
      setSessionMessages([]);
      setCurrentConversationId(null);
      setIsNewConversation(true);
      
      // Clear active conversation
      EnhancedFrontendMemory.clearActiveConversation();
      
      // Refresh archived conversations
      const archived = EnhancedFrontendMemory.loadArchivedConversations();
      setArchivedConversations(archived);
      
      console.log('✅ FRONTEND BOSS: Chat cleared and archived');
      
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

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const toggleSettings = () => {
    setIsSettingsOpen(!isSettingsOpen);
  };

  const handleRefreshConversations = async () => {
    console.log('👑 FRONTEND BOSS: Refreshing conversations from memory');
    const archived = EnhancedFrontendMemory.loadArchivedConversations();
    setArchivedConversations(archived);
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
        conversations={archivedConversations.map(conv => ({
          id: conv.id,
          title: conv.title,
          lastMessageAt: conv.lastMessageAt,
          createdAt: conv.createdAt
        }))}
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

      <ConversationSidebar
        isOpen={showConversations}
        onClose={() => setShowConversations(false)}
        conversations={archivedConversations}
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onNewConversation={handleNewConversation}
        onRefreshConversations={handleRefreshConversations}
      />

      <div className="flex flex-col h-full w-full relative">
        <div className="flex-1 overflow-y-auto" ref={scrollAreaRef}>
          <ChatMessages
            sessionMessages={sessionMessages.slice(-25)}
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

        <div className="fixed bottom-16 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border/50 shadow-lg">
          <div className="max-w-4xl mx-auto p-4">
            <ChatInput
              message={message}
              setMessage={setMessage}
              isLoading={isLoading}
              sessionMessages={sessionMessages}
              onSendMessage={handleSendMessage}
              onClearChat={handleClearChat}
              onOpenPlusDrawer={handleOpenPlusDrawer}
              activeTrigger={activeTrigger}
              onTriggerChange={handleTriggerChange}
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
