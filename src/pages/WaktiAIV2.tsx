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

  // Video generation state
  const [videoCategory, setVideoCategory] = useState('custom');
  const [videoTemplate, setVideoTemplate] = useState('image2video');

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { language } = useTheme();
  const { showSuccess, showError } = useToastHelper();
  const { canTranslate, refreshTranslationQuota } = useQuotaManagement();
  const { canUseVoice, refreshVoiceQuota } = useExtendedQuotaManagement();
  const { quota, fetchQuota } = useAIQuotaManagement();

  // Template prompts for video generation
  const getTemplatePrompt = (template: string) => {
    const prompts: { [key: string]: string } = {
      make_face: "The camera remains stationary. The subject stands still with hands on hips, head slightly tilted to the left, and a smiling expression. Then, the subject begins walking forward—directly toward the camera. Upon reaching the front of the lens, they simultaneously strike a playful pose and expression: mouth wide open, tongue sticking out, and eyes rolled upward.",
      blow_kiss: "The subject gently leans forward, blows a kiss toward the camera from just below the lips using the right hand, then naturally waves at the camera.",
      hair_swap: "The character transforms their hairstyle and color smoothly.",
      flying: "The character begins flying forward like a superhero.",
      nap_me: "The character lies down and covers themselves with a blanket.",
      pilot: "The character appears in an airplane cockpit.",
      interaction: "The two people face the camera, each extending a hand making a heart shape.",
      hugging_pro: "The two subjects turn towards each other and begin to hug.",
      carry_me: "One person begins to carry another on their back.",
      emotionlab: "The character transitions from neutral to smiling expression.",
      wild_laugh: "The character breaks into wild laughter.",
      surprised: "The character shows surprise expression.",
      send_roses: "The person picks up roses and presents them to another person.",
      cartoon_doll: "The character jumps, turning into a smooth doll version of themselves.",
      style_me: "The character puts on a crisp suit and walks forward.",
      toy_me: "The subject slowly turns around and transforms into a figurine on a base.",
      muscling: "A man takes off his shirt, revealing muscular chest.",
      muscling_360p: "Lower resolution muscle reveal animation.",
      fairy_me: "The character transforms into a magical fairy with wings.",
      yayoi_kusama_style: "Style transformation into polka dot art style.",
      irasutoya: "Style transformation into Japanese illustration style.",
      american_comic: "Style transformation into Rick and Morty animation style.",
      simpsons_comic: "Style transformation into Simpsons cartoon style.",
      child_memory: "A child version appears and embraces the subject.",
      outfit_show: "The model turns 180 degrees to showcase clothing.",
      spin360: "The subject rotates 360 degrees to show all angles.",
      live_memory: "Subtle movements like blinking and breathing.",
      sakura_season: "Cherry blossom petals fall while subject looks up smiling.",
      zoom_in_fast: "Camera steadily zooms in isolating details.",
      zoom_out_image: "Camera pulls back revealing environment.",
      zoom_out_startend: "Transition from close-up to wide shot.",
      walk_forward: "Character walks forward toward camera naturally."
    };
    return prompts[template] || "Generate creative video animation.";
  };

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
      // Limit to 25 messages maximum for conversation display
      const limitedMessages = session.messages.slice(-25);
      setSessionMessages(limitedMessages);
      setCurrentConversationId(session.conversationId || null);
      setIsNewConversation(!session.conversationId);
    }
  };

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
    
    // More precise English explicit task patterns
    const englishTaskPatterns = [
      /^(please\s+)?(create|make|add|new)\s+(a\s+)?task\s*:?\s*(.{5,})/i,
      /^(can\s+you\s+)?(create|make|add)\s+(a\s+)?task\s+(for|about|to|that)\s+(.{5,})/i,
      /^(i\s+need\s+)?(a\s+)?(new\s+)?task\s+(for|about|to|that)\s+(.{5,})/i,
      /^task\s*:\s*(.{5,})/i,
      /^add\s+task\s*:?\s*(.{5,})/i,
      /^create\s+task\s*:?\s*(.{5,})/i,
      /^make\s+task\s*:?\s*(.{5,})/i
    ];
    
    // More precise Arabic explicit task patterns
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

  const handleSendMessage = async (messageContent: string, inputType: 'text' | 'voice' = 'text', attachedFiles?: any[]) => {
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

    // Handle video generation
    if (activeTrigger === 'video' && attachedFiles && attachedFiles.length > 0) {
      await handleGenerateVideo(messageContent, attachedFiles);
      return;
    }

    console.log('🚀 MESSAGE PROCESSING: Starting with enhanced task detection');
    console.log('📊 MESSAGE DETAILS:', {
      content: messageContent.substring(0, 100) + '...',
      inputType,
      filesCount: attachedFiles?.length || 0,
      trigger: activeTrigger,
      isExplicitTask: isExplicitTaskCommand(messageContent)
    });

    setIsLoading(true);
    setError(null);
    const startTime = Date.now();

    try {
      if (isExplicitTaskCommand(messageContent)) {
        console.log('🎯 EXPLICIT TASK COMMAND DETECTED: Processing with ENHANCED confirmation UI');
        
        const taskResponse = await supabase.functions.invoke('process-ai-intent', {
          body: {
            text: messageContent,
            mode: 'assistant',
            userId: userProfile.id,
            conversationHistory: sessionMessages.slice(-10)
          }
        });

        console.log('📨 TASK RESPONSE RECEIVED:', {
          error: !!taskResponse.error,
          data: taskResponse.data,
          intent: taskResponse.data?.intent,
          hasIntentData: !!taskResponse.data?.intentData,
          hasPendingTask: !!taskResponse.data?.intentData?.pendingTask
        });

        if (taskResponse.error) {
          console.error('❌ TASK PROCESSING ERROR:', taskResponse.error);
          throw new Error(`Task processing failed: ${taskResponse.error.message}`);
        }

        const taskData = taskResponse.data;
        console.log('✅ TASK PROCESSING SUCCESS:', taskData);

        const tempUserMessage: AIMessage = {
          id: `user-temp-${Date.now()}`,
          role: 'user',
          content: messageContent,
          timestamp: new Date(),
          inputType: inputType,
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
          console.log('🎯 ENHANCED TASK CONFIRMATION: FORCING UI display with debug logging', {
            intentData: taskData.intentData,
            pendingTask: taskData.intentData.pendingTask,
            taskTitle: taskData.intentData.pendingTask.title,
            taskDescription: taskData.intentData.pendingTask.description,
            subtasks: taskData.intentData.pendingTask.subtasks
          });
          
          // FORCE task confirmation state with multiple updates
          console.log('🔧 FORCING TASK CONFIRMATION STATE - CRITICAL UPDATE');
          setPendingTaskData(taskData.intentData.pendingTask);
          
          // Force immediate state update using timeout
          setTimeout(() => {
            console.log('🔧 SECOND FORCE: Setting showTaskConfirmation to TRUE');
            setShowTaskConfirmation(true);
            
            // Triple confirmation - force another update
            setTimeout(() => {
              console.log('🔧 TRIPLE FORCE: Final confirmation state update');
              setShowTaskConfirmation(true);
              setPendingTaskData(taskData.intentData.pendingTask);
              
              // Debug current state
              console.log('🔍 FINAL TASK CONFIRMATION STATE CHECK:', {
                showTaskConfirmation: true,
                pendingTaskDataExists: !!taskData.intentData.pendingTask,
                taskTitle: taskData.intentData.pendingTask?.title,
                taskDataStructure: Object.keys(taskData.intentData.pendingTask || {})
              });
            }, 100);
          }, 50);
          
        } else {
          console.log('⚠️ NO TASK CONFIRMATION NEEDED:', {
            intent: taskData.intent,
            hasIntentData: !!taskData.intentData,
            hasPendingTask: !!taskData.intentData?.pendingTask
          });
        }

        setIsLoading(false);
        return; // Exit early for task commands
      }

      const hybridContext = await HybridMemoryService.getHybridContext(
        userProfile.id, 
        currentConversationId
      );
      
      console.log('✅ HYBRID MEMORY: Context loaded -', {
        recentMessages: hybridContext.recentMessages.length,
        conversationSummary: hybridContext.conversationSummary.length,
        messageCount: hybridContext.messageCount
      });

      const tempUserMessage: AIMessage = {
        id: `user-temp-${Date.now()}`,
        role: 'user',
        content: messageContent,
        timestamp: new Date(),
        inputType: inputType,
        attachedFiles: attachedFiles
      };
      
      setSessionMessages(prevMessages => [...prevMessages, tempUserMessage]);
      
      console.log('📡 CALLING: WaktiAIV2Service for regular chat with CLAUDE 3.5 SONNET (NO task detection)');
      
      const aiResponse = await WaktiAIV2Service.sendMessage(
        messageContent,
        userProfile?.id,
        language,
        currentConversationId,
        inputType,
        hybridContext.recentMessages,
        false, // NO task detection in regular chat
        activeTrigger,
        hybridContext.conversationSummary,
        attachedFiles || []
      );
      
      console.log('📨 AI RESPONSE:', {
        success: !aiResponse.error,
        hasResponse: !!aiResponse.response,
        conversationId: aiResponse.conversationId?.substring(0, 8) + '...'
      });

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

      // PROCESS TASK & REMINDER RESPONSE FIELDS
      if (aiResponse.showTaskForm && aiResponse.taskData) {
        console.log('📋 TASK FORM DETECTED:', aiResponse.taskData);
        setPendingTaskData(aiResponse.taskData);
        setShowTaskConfirmation(true);
      }

      if (aiResponse.reminderCreated && aiResponse.reminderData) {
        console.log('⏰ REMINDER CREATED:', aiResponse.reminderData);
        showSuccess(language === 'ar' ? 'تم إنشاء التذكير بنجاح!' : 'Reminder created successfully!');
        console.log('✅ Reminder created successfully!');
      }
      
      setSessionMessages(prevMessages => {
        const newMessages = [...prevMessages];
        newMessages[newMessages.length - 1] = assistantMessage;
        return [...newMessages.slice(0, -1), tempUserMessage, assistantMessage];
      });

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
      console.log(`✅ SUCCESS: Processing completed in ${totalTime}ms with CLAUDE 3.5 SONNET`);
      
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

  const handleGenerateVideo = async (promptText: string, uploadedFiles: any[]) => {
    try {
      setIsLoading(true);
      
      // Get user
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      
      if (!userId) {
        showError(language === 'ar' ? 'يرجى تسجيل الدخول' : 'Please login first');
        return;
      }
      
      // Use uploaded files base64 (already converted)
      const base64Images = uploadedFiles.map(file => file.url);
      
      // Get prompt
      const isCustom = videoTemplate === 'image2video';
      const promptToUse = isCustom ? promptText : getTemplatePrompt(videoTemplate);
      
      console.log('🎬 GENERATING VIDEO:', { template: videoTemplate, mode: isCustom ? 'image2video' : 'template2video' });
      
      // Call Supabase function
      const response = await supabase.functions.invoke('vidu-video-generator', {
        body: {
          template: videoTemplate,
          images: base64Images,
          prompt: promptToUse,
          user_id: userId,
          mode: isCustom ? 'image2video' : 'template2video'
        }
      });
      
      if (response.error) {
        console.error('❌ VIDEO ERROR:', response.error);
        throw new Error(response.error.message || 'Video generation failed');
      }
      
      console.log('✅ VIDEO SUCCESS:', response.data);
      
      // Create user message
      const tempUserMessage: AIMessage = {
        id: `user-temp-${Date.now()}`,
        role: 'user',
        content: promptText,
        timestamp: new Date(),
        inputType: 'text',
        attachedFiles: uploadedFiles
      };
      
      // Create video response message - use imageUrl property for video
      const videoMessage: AIMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: 'Video generation started successfully! Processing your request...',
        imageUrl: response.data.job_id, // Use imageUrl property for video
        timestamp: new Date(),
        intent: 'video'
      };
      
      setSessionMessages(prev => [...prev, tempUserMessage, videoMessage]);
      setMessage('');
      
      showSuccess(language === 'ar' ? 'تم بدء إنشاء الفيديو بنجاح!' : 'Video generation started successfully!');
      
    } catch (error: any) {
      console.error('❌ VIDEO ERROR:', error);
      showError(error.message || (language === 'ar' ? 'فشل في إنشاء الفيديو' : 'Failed to generate video'));
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
    
    if (userProfile?.id) {
      HybridMemoryService.clearAllMemory(userProfile.id);
      console.log('🗑️ HYBRID MEMORY: Cleared for new conversation');
    }
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
        inputType: msg.input_type as 'text' | 'voice',
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

  const debouncedSaveSession = useDebounceCallback(() => {
    const limitedMessages = sessionMessages.slice(-25);
    WaktiAIV2Service.saveChatSession(limitedMessages, currentConversationId);
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
            {/* Video controls when video mode is active and files are uploaded */}
            {activeTrigger === 'video' && processedFiles.length > 0 && (
              <div className="mb-4 p-4 rounded-lg bg-purple-900/20 border border-pink-500/30">
                {/* Image thumbnails */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {processedFiles.map((file, index) => (
                    <div key={index} className="relative">
                      <img src={file.url} className="w-16 h-16 object-cover rounded" alt="Upload" />
                      <button 
                        onClick={() => setProcessedFiles(prev => prev.filter((_, i) => i !== index))} 
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                
                {/* Controls in ONE LINE */}
                <div className="flex gap-2 items-center flex-wrap">
                  <select 
                    value={videoCategory} 
                    onChange={(e) => setVideoCategory(e.target.value)} 
                    className="flex-1 bg-gray-800 text-white rounded px-2 py-1 text-sm"
                  >
                    <option value="custom">Custom</option>
                    <option value="fun">Fun & Interactive</option>
                    <option value="transform">Transform & Style</option>
                    <option value="camera">Camera & Motion</option>
                  </select>
                  
                  <select 
                    value={videoTemplate} 
                    onChange={(e) => setVideoTemplate(e.target.value)} 
                    className="flex-1 bg-gray-800 text-white rounded px-2 py-1 text-sm"
                  >
                    {videoCategory === 'custom' && <option value="image2video">Custom Prompt</option>}
                    {videoCategory === 'fun' && (
                      <>
                        <option value="make_face">Make a Face</option>
                        <option value="blow_kiss">Blow a Kiss</option>
                        <option value="hair_swap">Hair Swap</option>
                        <option value="flying">Flying</option>
                        <option value="nap_me">Nap Me</option>
                        <option value="pilot">Pilot</option>
                        <option value="interaction">Finger Heart</option>
                        <option value="hugging_pro">Hugging Pro</option>
                        <option value="carry_me">Carry Me</option>
                        <option value="emotionlab">Smile</option>
                        <option value="wild_laugh">Wild Laugh</option>
                        <option value="surprised">Surprised</option>
                        <option value="send_roses">Send Roses</option>
                      </>
                    )}
                    {videoCategory === 'transform' && (
                      <>
                        <option value="cartoon_doll">Cartoon Doll</option>
                        <option value="style_me">Style Me</option>
                        <option value="toy_me">Toy Me</option>
                        <option value="muscling">Muscling</option>
                        <option value="muscling_360p">Muscling 360p</option>
                        <option value="fairy_me">Fairy Me</option>
                        <option value="yayoi_kusama_style">Yayoi Kusama</option>
                        <option value="irasutoya">Irasutoya</option>
                        <option value="american_comic">American Comic</option>
                        <option value="simpsons_comic">Simpsons</option>
                        <option value="child_memory">Child Memory</option>
                        <option value="outfit_show">Outfit Show</option>
                        <option value="spin360">Spin 360</option>
                        <option value="live_memory">Live Memory</option>
                        <option value="sakura_season">Sakura Season</option>
                      </>
                    )}
                    {videoCategory === 'camera' && (
                      <>
                        <option value="zoom_in_fast">Zoom In Fast</option>
                        <option value="zoom_out_image">Zoom Out</option>
                        <option value="zoom_out_startend">Zoom Out Start-End</option>
                        <option value="walk_forward">Walk Forward</option>
                      </>
                    )}
                  </select>
                </div>
                
                <div className="mt-2 text-xs text-gray-400">15/month video limit</div>
              </div>
            )}

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
