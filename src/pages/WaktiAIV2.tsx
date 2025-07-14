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
    let routingMode = activeTrigger;

    if (attachedFiles && attachedFiles.length > 0) {
      finalInputType = 'vision';
      if (routingMode !== 'video') {
        routingMode = 'vision';
      }
    }

    console.log('🚀 MESSAGE ROUTING: Respecting selected mode', {
      selectedMode: activeTrigger,
      routingMode: routingMode,
      messagePreview: messageContent.substring(0, 50) + '...',
      hasFiles: !!attachedFiles?.length
    });

    setIsLoading(true);
    setError(null);
    const startTime = Date.now();

    try {
      const tempUserMessage: AIMessage = {
        id: `user-temp-${Date.now()}`,
        role: 'user',
        content: messageContent,
        timestamp: new Date(),
        inputType: finalInputType,
        attachedFiles: attachedFiles
      };
      
      setSessionMessages(prevMessages => [...prevMessages, tempUserMessage]);

      if (routingMode === 'image') {
        console.log('🎨 ROUTING TO IMAGE MODE: Selected mode overrides content detection');
        
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
        console.log('💬 ROUTING TO CHAT MODE: Regular conversation');
        
        const hybridContext = await HybridMemoryService.getHybridContext(
          userProfile.id, 
          currentConversationId
        );
        
        const aiResponse = await WaktiAIV2Service.sendMessage(
          messageContent,
          userProfile?.id,
          language,
          currentConversationId,
          finalInputType,
          hybridContext.recentMessages,
          false,
          'chat',
          hybridContext.conversationSummary,
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
      }
      
      const totalTime = Date.now() - startTime;
      console.log(`✅ SUCCESS: Message routed to ${routingMode} mode in ${totalTime}ms`);
      
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
