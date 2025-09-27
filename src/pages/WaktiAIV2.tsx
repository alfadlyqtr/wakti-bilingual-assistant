import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { WaktiAIV2Service, AIMessage } from '@/services/WaktiAIV2Service';
import { EnhancedFrontendMemory, ConversationMetadata } from '@/services/EnhancedFrontendMemory';
import { useToastHelper } from "@/hooks/use-toast-helper";
import { supabase } from '@/integrations/supabase/client';
import { ChatMessages } from '@/components/wakti-ai-v2/ChatMessages';
import { ChatInput } from '@/components/wakti-ai-v2/ChatInput';
import { ChatDrawers } from '@/components/wakti-ai-v2/ChatDrawers';
import { ConversationSidebar } from '@/components/wakti-ai-v2/ConversationSidebar';
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';
import { useIsDesktop } from '@/hooks/use-mobile';

const WaktiAIV2 = () => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionMessages, setSessionMessages] = useState<AIMessage[]>([]);
  const [archivedConversations, setArchivedConversations] = useState<ConversationMetadata[]>([]);
  const [showConversations, setShowConversations] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [activeTrigger, setActiveTrigger] = useState('chat');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [personalTouch, setPersonalTouch] = useState<any>(null);
  const [isNewConversation, setIsNewConversation] = useState(true);
  const [showTaskConfirmation, setShowTaskConfirmation] = useState(false);
  const [pendingTaskData, setPendingTaskData] = useState<any>(null);
  const [pendingReminderData, setPendingReminderData] = useState<any>(null);
  const [taskConfirmationLoading, setTaskConfirmationLoading] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [inputReservePx, setInputReservePx] = useState<number>(120);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { language } = useTheme();
  const { showError } = useToastHelper();
  const { isDesktop } = useIsDesktop();

  const canSendMessage = useMemo(() => !isLoading && userProfile?.id, [isLoading, userProfile?.id]);

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

  const handleRefreshConversations = useCallback(() => {
    const archived = EnhancedFrontendMemory.loadArchivedConversations();
    setArchivedConversations(Array.isArray(archived) ? archived : []);
  }, []);

  const handleClearChat = useCallback(() => {
    if (currentConversationId && sessionMessages.length > 0) {
      EnhancedFrontendMemory.archiveCurrentConversation(sessionMessages, currentConversationId);
    }
    const newId = EnhancedFrontendMemory.startNewConversation([], null);
    setSessionMessages([]);
    setCurrentConversationId(newId);
    setIsNewConversation(true);
    handleRefreshConversations();
  }, [currentConversationId, sessionMessages, handleRefreshConversations]);

  useEffect(() => {
    loadUserProfile();
    loadPersonalTouch();
    const { messages, conversationId } = EnhancedFrontendMemory.loadActiveConversation();
    setSessionMessages(Array.isArray(messages) ? messages : []);
    setCurrentConversationId(conversationId);
    setIsNewConversation(!conversationId || messages.length === 0);
    handleRefreshConversations();
  }, [handleRefreshConversations]);

  // Always portal to document.body to avoid iOS fixed-inside-scroller bugs
  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  // Inject glass-edge CSS overrides for the chat input container
  useEffect(() => {
    const id = 'wakti-glass-edge-css';
    let style = document.getElementById(id) as HTMLStyleElement | null;
    const css = `
      .chat-input-container.solid-bg.glass-edge {\n\
        background: linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.10) 100%), var(--gradient-background) !important;\n\
        backdrop-filter: blur(18px) !important;\n\
        -webkit-backdrop-filter: blur(18px) !important;\n\
        border-top: 1px solid rgba(255,255,255,0.20) !important;\n\
        box-shadow: 0 -14px 36px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255,255,255,0.10) !important;\n\
        border-top-left-radius: 16px !important;\n\
        border-top-right-radius: 16px !important;\n\
        overflow: hidden !important;\n\
      }\n\
      .chat-input-container.solid-bg.glass-edge::before {\n\
        content: "";\n\
        position: absolute;\n\
        inset: 0 0 auto 0;\n\
        height: 100%;\n\
        pointer-events: none;\n\
        border-top-left-radius: 16px;\n\
        border-top-right-radius: 16px;\n\
        background: linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.00) 40%, rgba(255,255,255,0.18) 100%);\n\
        opacity: 0.25;\n\
      }\n`;
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      style.textContent = css;
      document.head.appendChild(style);
    } else {
      style.textContent = css;
    }
    return () => {
      const el = document.getElementById(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    };
  }, []);

  // Listen for ChatInput resize and adjust bottom reserve with a tiny gap (2px)
  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const ce = e as CustomEvent<{ height: number }>;
        const h = Number(ce?.detail?.height ?? 0);
        if (Number.isFinite(h) && h > 0) setInputReservePx(Math.max(60, Math.round(h) + 6));
      } catch {}
    };
    window.addEventListener('wakti-chat-input-resized', handler as EventListener);
    return () => window.removeEventListener('wakti-chat-input-resized', handler as EventListener);
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    if (currentConversationId && sessionMessages.length > 0) {
      EnhancedFrontendMemory.archiveCurrentConversation(sessionMessages, currentConversationId);
    }
    const conv = EnhancedFrontendMemory.loadArchivedConversation(id);
    if (conv) {
      setSessionMessages(conv.messages);
      setCurrentConversationId(conv.conversationId);
      EnhancedFrontendMemory.saveActiveConversation(conv.messages, conv.conversationId);
      setIsNewConversation(false);
    }
    handleRefreshConversations();
    setShowConversations(false);
  }, [currentConversationId, sessionMessages, handleRefreshConversations]);

  const handleDeleteConversation = useCallback((id: string) => {
    EnhancedFrontendMemory.deleteArchivedConversation(id);
    if (id === currentConversationId) {
      handleClearChat();
    }
    handleRefreshConversations();
  }, [currentConversationId, handleClearChat, handleRefreshConversations]);


  const handleSendMessage = useCallback(async (
    messageContent: string,
    trigger: string,
    attachedFiles?: any[],
    imageMode?: string,
    imageQuality?: 'fast' | 'best_fast'
  ) => {
    if (!messageContent.trim() && (!attachedFiles || attachedFiles.length === 0)) {
      showError('Please enter a message or attach a file.');
      return;
    }
    setIsLoading(true);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let convId = currentConversationId;
    if (!convId) {
      convId = EnhancedFrontendMemory.startNewConversation([], null);
      setCurrentConversationId(convId);
      setIsNewConversation(false);
    }

    // Do NOT auto-force 'vision' when files exist; ChatInput already controls trigger.
    const inputType = trigger === 'vision' ? 'vision' : 'text';

    const userMessage: AIMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
      intent: trigger,
      inputType,
      attachedFiles: attachedFiles,
    };
    const newMessages = [...sessionMessages, userMessage];
    setSessionMessages(newMessages);

    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantPlaceholder: AIMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      intent: trigger,
      metadata: { loading: true },
    };
    setSessionMessages([...newMessages, assistantPlaceholder]);

    try {
      if (trigger === 'image') {
        // Non-streaming image pipeline (text2image / image2image / background-removal)
        const response = await WaktiAIV2Service.sendMessage(
          messageContent,
          userProfile.id,
          language,
          convId,
          'text',
          newMessages,
          false,
          trigger,
          '',
          attachedFiles,
          controller.signal,
          imageMode,
          imageQuality
        );

        const finalAssistantMessage: AIMessage = {
          ...assistantPlaceholder,
          content: response.response,
          metadata: { loading: false, ...response.metadata },
          intent: trigger,
          ...(response as any)?.imageUrl ? { imageUrl: (response as any).imageUrl } : {}
        };

        setSessionMessages(prev => {
          const finalMessages = prev.map(m => m.id === assistantMessageId ? finalAssistantMessage : m);
          EnhancedFrontendMemory.saveActiveConversation(finalMessages, convId);
          return finalMessages;
        });
      } else if (inputType === 'vision') {
        let streamed = '';
        let streamMeta: any = {};
        const streamedResp = await WaktiAIV2Service.sendStreamingMessage(
          messageContent,
          userProfile.id,
          language,
          convId,
          inputType, // 'vision'
          newMessages,
          false, // skipContextLoad
          trigger,
          '', // conversationSummary
          attachedFiles,
          (token: string) => {
            streamed += token;
            setSessionMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: streamed } : m));
          },
          (metadata: any) => { streamMeta = metadata || {}; },
          (err: string) => { console.error('Vision stream error:', err); },
          controller.signal
        );

        const finalAssistantMessage: AIMessage = {
          ...assistantPlaceholder,
          content: streamedResp?.response ?? streamed,
          metadata: { loading: false, ...streamMeta },
          intent: trigger,
        };

        setSessionMessages(prev => {
          const finalMessages = prev.map(m => m.id === assistantMessageId ? finalAssistantMessage : m);
          EnhancedFrontendMemory.saveActiveConversation(finalMessages, convId);
          return finalMessages;
        });
      } else {
        let streamed = '';
        let streamMeta: any = {};
        const streamedResp = await WaktiAIV2Service.sendStreamingMessage(
          messageContent,
          userProfile.id,
          language,
          convId,
          inputType, // 'text' or other non-vision types
          newMessages,
          false, // skipContextLoad
          trigger,
          '', // conversationSummary
          attachedFiles,
          (token: string) => {
            streamed += token;
            setSessionMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: streamed } : m));
          },
          (metadata: any) => { streamMeta = metadata || {}; },
          (err: string) => { console.error('Stream error:', err); },
          controller.signal
        );

        const finalAssistantMessage: AIMessage = {
          ...assistantPlaceholder,
          content: streamedResp?.response ?? streamed,
          metadata: { loading: false, ...streamMeta },
          intent: trigger,
        };

        setSessionMessages(prev => {
          const finalMessages = prev.map(m => m.id === assistantMessageId ? finalAssistantMessage : m);
          EnhancedFrontendMemory.saveActiveConversation(finalMessages, convId);
          return finalMessages;
        });
      }

    } catch (error: any) {
      console.error('Error sending message:', error);
      // If we already streamed some content (e.g., fallback provider succeeded), keep it.
      setSessionMessages(prev => {
        const hadStream = !!prev.find(m => m.id === assistantMessageId)?.content;
        const finalMessages = prev.map(m => {
          if (m.id !== assistantMessageId) return m;
          if (hadStream) {
            return { ...m, metadata: { ...(m.metadata || {}), loading: false } };
          }
          return {
            ...m,
            content: 'Sorry, I encountered an error. Please try again.',
            metadata: { loading: false, error: true },
          };
        });
        EnhancedFrontendMemory.saveActiveConversation(finalMessages, convId);
        return finalMessages;
      });
    } finally {
      setIsLoading(false);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [currentConversationId, language, sessionMessages, userProfile]);

  const handleConfirmTask = (taskData: any) => { console.log('Task confirmed:', taskData); setShowTaskConfirmation(false); };
  const handleDeclineTask = () => { console.log('Task declined'); setShowTaskConfirmation(false); };
  const handleConfirmReminder = (reminderData: any) => { console.log('Reminder confirmed:', reminderData); };

  return (
    <div className="wakti-ai-page-container">
      <ChatDrawers
        showConversations={showConversations}
        setShowConversations={setShowConversations}
        conversations={(archivedConversations || []).map(c => ({...c, lastMessage: ''}))}
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        fetchConversations={handleRefreshConversations}
        onSendMessage={handleSendMessage}
        activeTrigger={activeTrigger}
        onTriggerChange={setActiveTrigger}
        onTextGenerated={(text) => setMessage(text)}
        onNewConversation={handleClearChat}
        onClearChat={handleClearChat}
        sessionMessages={sessionMessages}
        isLoading={isLoading}
      />

      {isDesktop && (
        <ConversationSidebar
          isOpen={showConversations}
          onClose={() => setShowConversations(false)}
          conversations={archivedConversations}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          onNewConversation={handleClearChat}
          currentConversationId={currentConversationId}
          onRefreshConversations={handleRefreshConversations}
        />
      )}

      <div
        className="wakti-ai-messages-area"
        ref={scrollAreaRef}
        style={{
          height: `calc(100dvh - var(--app-header-h) - ${inputReservePx}px)`,
          overflowY: 'auto',
          paddingBottom: '6px'
        }}
      >
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
          onTaskConfirmation={handleConfirmTask}
          onReminderConfirmation={handleConfirmReminder}
          onCancelTaskConfirmation={handleDeclineTask}
          conversationId={currentConversationId}
          isNewConversation={isNewConversation}
        />
      </div>

        {portalRoot ? createPortal(
          <div className='chat-input-container solid-bg glass-edge'>
            <ChatInput
              message={message}
              setMessage={setMessage}
              isLoading={canSendMessage ? isLoading : true}
              sessionMessages={sessionMessages}
              onSendMessage={handleSendMessage}
              onClearChat={handleClearChat}
              onOpenPlusDrawer={() => setIsSidebarOpen(true)}
              onOpenConversations={() => setShowConversations(true)}
              activeTrigger={activeTrigger}
              onTriggerChange={setActiveTrigger}
            />
          </div>,
          portalRoot
        ) : (
          <div className='chat-input-container solid-bg glass-edge'>
            <ChatInput
              message={message}
              setMessage={setMessage}
              isLoading={canSendMessage ? isLoading : true}
              sessionMessages={sessionMessages}
              onSendMessage={handleSendMessage}
              onClearChat={handleClearChat}
              onOpenPlusDrawer={() => setIsSidebarOpen(true)}
              onOpenConversations={() => setShowConversations(true)}
              activeTrigger={activeTrigger}
              onTriggerChange={setActiveTrigger}
            />
          </div>
        )}
    </div>
  );
};

export default WaktiAIV2;
