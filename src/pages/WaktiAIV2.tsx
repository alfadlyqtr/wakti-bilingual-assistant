import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { TRService } from '@/services/trService';
import { useMobileKeyboard } from '@/hooks/useMobileKeyboard';
import { cn } from '@/lib/utils';


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
  const abortControllerRef = useRef<AbortController | null>(null);
  // Track the latest request to avoid stale isLoading resets from older callbacks
  const requestIdRef = useRef(0);
  const { language } = useTheme();
  const { showSuccess, showError } = useToastHelper();
  const { canTranslate, refreshTranslationQuota } = useQuotaManagement();
  const { canUseVoice, refreshVoiceQuota } = useExtendedQuotaManagement();
  const { quota, fetchQuota } = useAIQuotaManagement();
  const { isKeyboardVisible, keyboardHeight } = useMobileKeyboard();
  
  // Memoized values for performance
  const quotaStatus = useMemo(() => ({
    isQuotaExceeded,
    isExtendedQuotaExceeded,
    isAIQuotaExceeded
  }), [isQuotaExceeded, isExtendedQuotaExceeded, isAIQuotaExceeded]);

  const canSendMessage = useMemo(() => {
    return !isLoading && !isClearingChat && userProfile?.id;
  }, [isLoading, isClearingChat, userProfile?.id]);

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

  // Listen for Personal Touch updates and reflect immediately
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      try {
        setPersonalTouch(e.detail || JSON.parse(localStorage.getItem('wakti_personal_touch') || 'null'));
      } catch {
        loadPersonalTouch();
      }
    };
    window.addEventListener('wakti-personal-touch-updated', handler as EventListener);
    return () => window.removeEventListener('wakti-personal-touch-updated', handler as EventListener);
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

  const handleSendMessage = useCallback(async (messageContent: string, trigger: string, attachedFiles?: any[], imageMode?: string, imageQuality?: 'fast' | 'best_fast') => {
    console.log('🔥 DEBUG: handleSendMessage called', { trigger, messagePreview: messageContent.substring(0, 50), filesCount: attachedFiles?.length || 0, imageMode: imageMode || 'n/a', imageQuality: imageQuality || 'n/a' });
    
    if (abortControllerRef.current) {
      console.log('🔥 DEBUG: Aborting previous request');
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    // Bump request id for this send cycle
    const requestId = ++requestIdRef.current;

    const startTime = Date.now();
    console.log('🔥 DEBUG: About to set isLoading(true)');
    setIsLoading(true);
    console.log('⏳ isLoading -> true (handleSendMessage start)');
    setProcessedFiles(attachedFiles || []);
    
    console.log(`🚀 FRONTEND BOSS: Starting ${trigger} mode request`, {
      messageLength: messageContent.length,
      filesCount: attachedFiles?.length || 0,
      imageMode: imageMode || 'none'
    });

    try {
      console.log('🔥 DEBUG: Entered try block');
      // No global quota check here (chat/search/image/vision are not gated)

      // FILE PROCESSING
      let processedAttachedFiles = attachedFiles;
      let finalInputType: 'text' | 'voice' | 'vision' = 'text';

      // Background-removal flag: special-case behavior in image mode
      const isBgRemoval = trigger === 'image' && imageMode === 'background-removal';

      if (attachedFiles && attachedFiles.length > 0) {
        console.log('📎 FRONTEND BOSS: Processing attached files');
        
        // Separate image files from other files
        const imageFiles = attachedFiles.filter(file => file.type?.startsWith('image/'));
        const otherFiles = attachedFiles.filter(file => !file.type?.startsWith('image/'));

        if (imageFiles.length > 0) {
          // Only auto-mark as vision if not background-removal image mode
          if (!isBgRemoval) {
            finalInputType = 'vision';
            console.log(`🖼️ FRONTEND BOSS: Found ${imageFiles.length} image files, switching to vision mode`);
          } else {
            console.log(`🧼 FRONTEND BOSS: Background removal mode detected, staying in image mode`);
          }
          
          // Convert images for downstream usage
          const processedImageFiles = await Promise.all(
            imageFiles.map(async (file) => {
              try {
                // For background-removal we need FULL data URL in `data`
                if (isBgRemoval) {
                  // If we already have a data URL in url/base64, use it directly
                  const dataUrl: string | undefined =
                    (typeof file.url === 'string' && file.url.startsWith('data:')) ? file.url
                    : (typeof file.base64 === 'string' && file.base64.startsWith('data:')) ? file.base64
                    : undefined;

                  if (dataUrl) {
                    return { ...file, data: dataUrl };
                  }

                  // Fallback: fetch blob and keep full data URL
                  if (file.url) {
                    const response = await fetch(file.url);
                    if (controller.signal.aborted) return null;
                    const blob = await response.blob();
                    if (controller.signal.aborted) return null;

                    return new Promise((resolve) => {
                      const reader = new FileReader();
                      reader.onload = () => {
                        const fullDataUrl = reader.result as string; // keep full data URL
                        resolve({ ...file, data: fullDataUrl });
                      };
                      reader.readAsDataURL(blob);
                    });
                  }

                  // As a last resort, pass through unchanged
                  return file;
                }

                // Default behavior (vision/others): convert to raw base64 payload only
                if (file.url) {
                  const response = await fetch(file.url);
                  if (controller.signal.aborted) return null;
                  
                  const blob = await response.blob();
                  if (controller.signal.aborted) return null;
                  
                  return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                      const base64 = (reader.result as string).split(',')[1];
                      resolve({
                        ...file,
                        data: base64
                      });
                    };
                    reader.readAsDataURL(blob);
                  });
                }
                return file;
              } catch (error) {
                console.error('Error processing image file:', error);
                return file;
              }
            })
          );

          // Filter out null results from aborted operations
          const validImageFiles = processedImageFiles.filter(file => file !== null);
          if (controller.signal.aborted) return;

          processedAttachedFiles = [...validImageFiles, ...otherFiles];
        }
      }
      
      // ROUTING LOGIC
      let routingMode = trigger;

      // IMAGE MODE ROUTING
      if (trigger === 'image') {
        console.log('🎨 FRONTEND BOSS: Processing image generation request', { imageMode, imageQuality });
        
        const tempUserMessage: AIMessage = {
          id: `user-temp-${Date.now()}`,
          role: 'user',
          content: messageContent,
          timestamp: new Date(),
          inputType: 'text',
          intent: 'image',
          attachedFiles: processedAttachedFiles,
          metadata: { imageMode }
        };
        
        const newMessages = [...sessionMessages, tempUserMessage];
        setSessionMessages(newMessages);
        
        EnhancedFrontendMemory.saveActiveConversation(newMessages, currentConversationId);

        // Insert assistant placeholder with loading state (blurred image placeholder UI)
        const assistantId = `assistant-${Date.now()}`;
        const placeholderAssistant: AIMessage = {
          id: assistantId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          intent: 'image',
          metadata: { loading: true, prompt: messageContent, imageMode }
        };
        setSessionMessages(prev => [...prev, placeholderAssistant]);
        
        const imageResponse = await WaktiAIV2Service.sendMessage(
          messageContent,
          userProfile?.id,
          language,
          currentConversationId,
          finalInputType,
          newMessages,
          false,
          'image',
          '',
          processedAttachedFiles || [],
          controller.signal,
          imageMode,
          imageQuality
        );

        if (controller.signal.aborted) {
          console.log('🚫 Image request aborted');
          return;
        }

        if (imageResponse.error) {
          throw new Error(imageResponse.error);
        }
        
        // Update the placeholder with the final image result
        setSessionMessages(prev => {
          const updated = prev.map(m => m.id === assistantId ? {
            ...m,
            content: imageResponse.response || 'Image generated',
            intent: imageResponse.intent || 'image',
            confidence: (imageResponse.confidence as 'high' | 'medium' | 'low') || 'high',
            actionTaken: imageResponse.actionTaken || undefined,
            imageUrl: imageResponse.imageUrl || undefined,
            metadata: {
              ...(m.metadata || {}),
              loading: false,
              runwareCost: imageResponse.runwareCost,
              modelUsed: imageResponse.modelUsed,
              responseTime: imageResponse.responseTime,
              imageMode
            }
          } : m);
          EnhancedFrontendMemory.saveActiveConversation(updated, currentConversationId);
          return updated;
        });
        
        console.log('🔥 DEBUG: Image mode completed, about to set isLoading(false)');
        console.log('✅ isLoading -> false (image mode completed)');
        if (requestIdRef.current === requestId) setIsLoading(false);
        console.log('🔥 DEBUG: Image mode - isLoading set to false, returning');
        return;
      }

      // No quota gating here; voice-only flows enforce quotas elsewhere

      if (!messageContent || !messageContent.trim()) {
        showError(language === 'ar' ? 'يرجى كتابة رسالة' : 'Please enter a message');
        if (requestIdRef.current === requestId) setIsLoading(false);
        return;
      }

      if (!userProfile?.id) {
        showError(language === 'ar' ? 'يرجى تسجيل الدخول' : 'Please login first');
        if (requestIdRef.current === requestId) setIsLoading(false);
        return;
      }

      // Ensure conversation ID exists
      let workingConversationId = currentConversationId;
      if (!workingConversationId) {
        workingConversationId = EnhancedFrontendMemory.saveActiveConversation([], null);
        setCurrentConversationId(workingConversationId);
        setIsNewConversation(false);
      }

      // VISION MODE ROUTING - separate from image mode
      if (trigger === 'vision' || finalInputType === 'vision') {
        console.log('👁️ FRONTEND BOSS: Processing vision request (image analysis)');
        
        const tempUserMessage: AIMessage = {
          id: `user-temp-${Date.now()}`,
          role: 'user',
          content: messageContent,
          timestamp: new Date(),
          inputType: finalInputType,
          intent: routingMode,
          attachedFiles: processedAttachedFiles
        };
        
        const newMessages = [...sessionMessages, tempUserMessage];
        setSessionMessages(newMessages);
        
        EnhancedFrontendMemory.saveActiveConversation(newMessages, workingConversationId);

        // Insert assistant placeholder with loading state so UI shows analyzing indicator
        const assistantId = `assistant-${Date.now()}`;
        const placeholderAssistant: AIMessage = {
          id: assistantId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          intent: 'vision',
          metadata: { loading: true }
        };
        setSessionMessages(prev => [...prev, placeholderAssistant]);
        
        const visionResponse = await WaktiAIV2Service.sendMessage(
          messageContent,
          userProfile?.id,
          language,
          workingConversationId,
          finalInputType,
          newMessages, // Do NOT include placeholder here
          false,
          'chat', // Vision uses chat mode in backend
          '',
          processedAttachedFiles || [],
          controller.signal
        );

        if (controller.signal.aborted) {
          console.log('🚫 Vision request aborted');
          return;
        }

        if (visionResponse.error) {
          throw new Error(visionResponse.error);
        }
        
        // Update the placeholder with the final vision analysis
        setSessionMessages(prev => {
          const updated = prev.map(m => m.id === assistantId ? {
            ...m,
            content: visionResponse.response || 'Vision analysis completed',
            intent: visionResponse.intent || 'vision',
            confidence: (visionResponse.confidence as 'high' | 'medium' | 'low') || 'high',
            actionTaken: visionResponse.actionTaken || undefined,
            browsingUsed: visionResponse.browsingUsed || undefined,
            browsingData: visionResponse.browsingData || undefined,
            metadata: { ...(m.metadata || {}), loading: false }
          } : m);
          EnhancedFrontendMemory.saveActiveConversation(updated, workingConversationId);
          return updated;
        });
        
        console.log('🔥 DEBUG: Vision mode completed, about to set isLoading(false)');
        if (requestIdRef.current === requestId) setIsLoading(false);
        console.log('🔥 DEBUG: Vision mode - isLoading set to false, returning');
        return;
      }

      // SEARCH MODE
      if (routingMode === 'search') {
        console.log('🔍 FRONTEND BOSS: Processing search (streaming)');
        
        const tempUserMessage: AIMessage = {
          id: `user-temp-${Date.now()}`,
          role: 'user',
          content: messageContent,
          timestamp: new Date(),
          inputType: finalInputType,
          intent: routingMode,
          attachedFiles: processedAttachedFiles
        };
        
        const newMessages = [...sessionMessages, tempUserMessage];
        setSessionMessages(newMessages);
        
        EnhancedFrontendMemory.saveActiveConversation(newMessages, workingConversationId);

        // Add streaming placeholder assistant message
        const assistantId = `assistant-${Date.now()}`;
        const placeholderAssistant: AIMessage = {
          id: assistantId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          intent: 'search'
        };
        setSessionMessages(prev => [...prev, placeholderAssistant]);

        // OPTION 1: If YouTube-prefixed search (yt: or yt ), use non-streaming path and attach metadata
        const ytPrefixMatch = /^(?:\s*yt:\s*|\s*yt\s+)(.*)$/i.exec(messageContent || '');
        if (ytPrefixMatch) {
          console.log('🔴 YT ROUTE: Using non-streaming sendMessage() for YouTube search');
          const ytResp = await WaktiAIV2Service.sendMessage(
            messageContent,
            userProfile?.id,
            language,
            workingConversationId,
            finalInputType,
            newMessages,
            false,
            'search',
            '',
            processedAttachedFiles || [],
            controller.signal
          );

          if (controller.signal.aborted) {
            console.log('🚫 YouTube search request aborted');
            return;
          }

          if (ytResp.error) {
            setSessionMessages(prev => prev.map(m => m.id === assistantId ? {
              ...m,
              content: ytResp.response || (language === 'ar' ? '🌐 تعذر الوصول إلى بحث يوتيوب حالياً.' : '🌐 Unable to reach YouTube search right now.'),
              intent: 'search',
              metadata: { ...(m.metadata || {}), ...(ytResp.metadata || {}) }
            } : m));
            EnhancedFrontendMemory.saveActiveConversation(
              [...newMessages, {
                id: assistantId,
                role: 'assistant',
                content: ytResp.response || (language === 'ar' ? '🌐 تعذر الوصول إلى بحث يوتيوب حالياً.' : '🌐 Unable to reach YouTube search right now.'),
                timestamp: new Date()
              }],
              workingConversationId
            );
            if (requestIdRef.current === requestId) setIsLoading(false);
            return;
          }

          setSessionMessages(prev => {
            const updated = prev.map(m => m.id === assistantId ? {
              ...m,
              content: ytResp.response || '',
              intent: 'search',
              browsingUsed: ytResp.browsingUsed ?? true,
              browsingData: ytResp.browsingData,
              metadata: { ...(m.metadata || {}), ...(ytResp.metadata || {}) }
            } : m);
            EnhancedFrontendMemory.saveActiveConversation(updated, workingConversationId);
            return updated;
          });
          if (requestIdRef.current === requestId) setIsLoading(false);
          return;
        }

        console.log('🔥 DEBUG: About to call sendStreamingMessage for search mode');
        // Anti-greeting streaming state
        let acc_search = '';
        await WaktiAIV2Service.sendStreamingMessage(
          messageContent,
          userProfile?.id,
          language,
          workingConversationId,
          finalInputType,
          newMessages, // Do NOT include placeholder here
          false,
          'search',
          '',
          processedAttachedFiles || [],
          // onToken
          (token: string) => {
            acc_search += token;
            setSessionMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: acc_search } : m));
          },
          // onComplete
          (meta: any) => {
            setSessionMessages(prev => {
              const updated = prev.map(m => m.id === assistantId
                ? { ...m, content: acc_search, intent: 'search', browsingUsed: meta?.browsingUsed, browsingData: meta?.browsingData }
                : m
              );
              EnhancedFrontendMemory.saveActiveConversation(updated, workingConversationId);
              return updated;
            });
            
            // Fallback UI refresh after completion
            setTimeout(() => {
              console.log('🔥 DEBUG: Fallback UI refresh - ensuring loading state is reset');
              if (requestIdRef.current === requestId) setIsLoading(false);
            }, 1000);
          },
          // onError
          (errMsg: string) => {
            setSessionMessages(prev => prev.map(m => m.id === assistantId ? {
              ...m,
              content: language === 'ar'
                ? '❌ حدث خطأ أثناء البث. يرجى المحاولة مرة أخرى.'
                : '❌ A streaming error occurred. Please try again.'
            } : m));
            EnhancedFrontendMemory.saveActiveConversation(
              [...newMessages, {
                id: assistantId,
                role: 'assistant',
                content: language === 'ar'
                  ? '❌ حدث خطأ أثناء البث. يرجى المحاولة مرة أخرى.'
                  : '❌ A streaming error occurred. Please try again.',
                timestamp: new Date()
              }],
              workingConversationId
            );
            
            // Fallback UI refresh after error
            setTimeout(() => {
              console.log('🔥 DEBUG: Fallback UI refresh after error - ensuring loading state is reset');
              if (requestIdRef.current === requestId) setIsLoading(false);
            }, 1000);
          },
          // signal
          controller.signal
        );
        
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
            intent: routingMode,
            attachedFiles: processedAttachedFiles
          };

          const taskMessage: AIMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: taskData.response || 'Task processing completed',
            timestamp: new Date(),
            intent: taskData.intent || 'parse_task'
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
          intent: routingMode,
          attachedFiles: processedAttachedFiles
        };
        
        const newMessages = [...sessionMessages, tempUserMessage];
        setSessionMessages(newMessages);
        
        EnhancedFrontendMemory.saveActiveConversation(newMessages, workingConversationId);
        
        // STREAMING: Add placeholder assistant message and stream tokens into it
        const assistantId = `assistant-${Date.now()}`;
        const placeholderAssistant: AIMessage = {
          id: assistantId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          intent: 'chat'
        };
        setSessionMessages(prev => [...prev, placeholderAssistant]);

        console.log('🔥 DEBUG: About to call sendStreamingMessage for chat mode');
        // Anti-greeting streaming state
        let acc_chat = '';
        await WaktiAIV2Service.sendStreamingMessage(
          messageContent,
          userProfile?.id,
          language,
          workingConversationId,
          finalInputType,
          newMessages,
          false,
          'chat',
          '',
          processedAttachedFiles || [],
          // onToken
          (token: string) => {
            acc_chat += token;
            setSessionMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: acc_chat } : m));
          },
          // onComplete
          (meta: any) => {
            console.log('🔥 DEBUG: Chat streaming onComplete called');
            setSessionMessages(prev => {
              const updated = prev.map(m => m.id === assistantId
                ? { ...m, content: acc_chat, intent: 'chat', browsingUsed: meta?.browsingUsed, browsingData: meta?.browsingData }
                : m
              );
              EnhancedFrontendMemory.saveActiveConversation(updated, workingConversationId);
              return updated;
            });
            
            // Fallback UI refresh after completion
            setTimeout(() => {
              console.log('🔥 DEBUG: Fallback UI refresh - ensuring loading state is reset');
              setIsLoading(false);
            }, 1000);
          },
          // onError
          (errMsg: string) => {
            console.log('🔥 DEBUG: Chat streaming onError called:', errMsg);
            setSessionMessages(prev => {
              const updated = prev.map(m => m.id === assistantId ? {
                ...m,
                content: language === 'ar'
                  ? '❌ حدث خطأ أثناء البث. يرجى المحاولة مرة أخرى.'
                  : '❌ A streaming error occurred. Please try again.'
              } : m);
              EnhancedFrontendMemory.saveActiveConversation(updated, workingConversationId);
              return updated;
            });
            setError(errMsg || 'Streaming error');
            
            // Fallback UI refresh after error
            setTimeout(() => {
              console.log('🔥 DEBUG: Fallback UI refresh after error - ensuring loading state is reset');
              setIsLoading(false);
            }, 1000);
          },
          // signal
          controller.signal
        );
        console.log('🔥 DEBUG: Chat streaming sendStreamingMessage completed');
      }
      
      const totalTime = Date.now() - startTime;
      console.log(`✅ FRONTEND BOSS: Message processed in ${totalTime}ms`);
      console.log('🔥 DEBUG: About to exit try block normally');
      
      setProcessedFiles([]);
      checkQuotas();
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (err: any) {
      console.log('🔥 DEBUG: Entered catch block with error:', err.message);
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
        // Persist error state to conversation memory
        EnhancedFrontendMemory.saveActiveConversation(newMessages, currentConversationId);
        return newMessages;
      });
      
      setError(err.message || 'Failed to send message');
      showError(language === 'ar' 
        ? 'فشل في إرسال الرسالة. يرجى المحاولة مرة أخرى.' 
        : 'Failed to send message. Please try again.'
      );
    } finally {
      console.log('🔥 DEBUG: Entered finally block');
      console.log('🔚 finally: isLoading -> false (handleSendMessage end)');
      if (requestIdRef.current === requestId) setIsLoading(false);
      
      // Mobile-safe AbortController cleanup
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      console.log('🔥 DEBUG: Finally block - isLoading set to false, abortController safely cleared');
    }
  }, [abortControllerRef, sessionMessages, currentConversationId, userProfile, language, isQuotaExceeded, isExtendedQuotaExceeded, isAIQuotaExceeded, fileInputRef]);

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
    <div className="flex min-h-[100dvh] md:pt-[calc(var(--desktop-header-h)+24px)] antialiased text-slate-900 selection:bg-blue-500 selection:text-white">
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
        <div
          className="flex-1 overflow-y-auto scrollbar-hide overscroll-contain touch-pan-y"
          style={{
            ...(window.innerWidth < 768
              ? (isKeyboardVisible
                  ? {
                      // Mobile + keyboard visible: use visual viewport and subtract fixed header + input
                      height:
                        'calc(var(--viewport-height, 100vh) - var(--app-header-h) - var(--chat-input-height,80px))',
                      maxHeight:
                        'calc(var(--viewport-height, 100vh) - var(--app-header-h) - var(--chat-input-height,80px))',
                    }
                  : {
                      // Mobile + keyboard hidden: subtract fixed header + input (no bottom nav anymore)
                      height:
                        'calc(100vh - var(--app-header-h) - var(--chat-input-height,80px))',
                    })
              : {
                  // Desktop/Tablet: keep prior logic
                  height:
                    'calc(100vh - var(--desktop-header-h) - var(--chat-input-height,80px) - 24px)',
                }),
          }}
          ref={scrollAreaRef}
        >
          <ChatMessages
            sessionMessages={sessionMessages.slice(-35)}
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

        <div 
          className={cn(
            "fixed left-0 right-0 z-[2147483000] bg-background/95 backdrop-blur-md ios-reduce-blur touch-manipulation border-t border-border/50 md:left-[var(--current-sidebar-width,0px)]"
          )}
          style={{
            bottom: isKeyboardVisible 
              ? `${keyboardHeight}px`
              : '0px', // Changed from var(--app-bottom-tabs-h) to 0px since no bottom nav
            // Remove bottom safe-area padding so input sits flush at all times
            paddingBottom: '0px',
            transition: 'bottom 180ms ease-out',
            willChange: 'bottom',
            transform: 'translateZ(0)'
          }}
        >
          <div className="w-full max-w-none px-2 sm:px-3 py-0 md:px-4 md:py-0">
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
    </div>
  );
};

export default WaktiAIV2;
