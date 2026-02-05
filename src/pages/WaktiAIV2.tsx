import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { WaktiAIV2Service, AIMessage } from '@/services/WaktiAIV2Service';
import { SavedConversationsService } from '@/services/SavedConversationsService';
import { EnhancedFrontendMemory, ConversationMetadata } from '@/services/EnhancedFrontendMemory';
import { useToastHelper } from "@/hooks/use-toast-helper";
import { supabase } from '@/integrations/supabase/client';
import { ChatMessages } from '@/components/wakti-ai-v2/ChatMessages';
import { ChatInput, ImageMode, ChatSubmode, ReplyContext } from '@/components/wakti-ai-v2/ChatInput';
import { ChatDrawers } from '@/components/wakti-ai-v2/ChatDrawers';
import { ConversationSidebar } from '@/components/wakti-ai-v2/ConversationSidebar';
import { DrawAfterBGCanvas, DrawAfterBGCanvasRef } from '@/components/wakti-ai/DrawAfterBGCanvas';
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
  const [activeImageMode, setActiveImageMode] = useState<ImageMode>('text2image');
  const [chatSubmode, setChatSubmode] = useState<ChatSubmode>('chat');
  const [replyContext, setReplyContext] = useState<ReplyContext | null>(null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const visionInFlightRef = useRef<boolean>(false);
  const lastTriggerRef = useRef<string>('chat');
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const drawCanvasRef = useRef<DrawAfterBGCanvasRef>(null);
  const imageProgressIntervalRef = useRef<number | null>(null);
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

  // Listen for quick prompt selection from DrawAfterBGCanvas
  useEffect(() => {
    const handleQuickPrompt = (event: CustomEvent) => {
      setMessage(event.detail);
    };

    window.addEventListener('quickPromptSelected', handleQuickPrompt as EventListener);
    return () => {
      window.removeEventListener('quickPromptSelected', handleQuickPrompt as EventListener);
    };
  }, []);

  // Listen for quick action prompts from EnhancedQuickActions component
  useEffect(() => {
    const handleQuickActionPrompt = (event: CustomEvent) => {
      const prompt = event.detail?.prompt;
      if (prompt && typeof prompt === 'string' && !isLoading) {
        // Set the message and trigger send
        setMessage(prompt);
        // Auto-send after a brief delay to allow state update
        setTimeout(() => {
          const submitEvent = new CustomEvent('wakti-auto-submit');
          window.dispatchEvent(submitEvent);
        }, 100);
      }
    };

    window.addEventListener('wakti-quick-prompt', handleQuickActionPrompt as EventListener);
    return () => {
      window.removeEventListener('wakti-quick-prompt', handleQuickActionPrompt as EventListener);
    };
  }, [isLoading]);

  const handleRefreshConversations = useCallback(() => {
    const archived = EnhancedFrontendMemory.loadArchivedConversations();
    setArchivedConversations(Array.isArray(archived) ? archived : []);
  }, []);

  // When the active mode changes, clear loading state but DON'T abort
  // Aborting here causes "signal is aborted without reason" errors
  // because the mode change happens BEFORE handleSendMessage creates the new controller
  useEffect(() => {
    // Only clear loading state, don't abort
    if (activeTrigger !== 'vision') {
      visionInFlightRef.current = false;
    }
  }, [activeTrigger]);

  const prevTriggerRef = useRef<string>(activeTrigger);
  useEffect(() => {
    const prev = prevTriggerRef.current;
    prevTriggerRef.current = activeTrigger;
    if (activeTrigger === 'image' && prev !== 'image') {
      setActiveImageMode('text2image');
    }
  }, [activeTrigger]);

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

  const isCloudConversationId = (id?: string | null) => Boolean(id && !id.startsWith('frontend-conv-'));

  const autoSaveCloudConversation = useCallback(async () => {
    if (!currentConversationId || sessionMessages.length === 0) return;
    if (!isCloudConversationId(currentConversationId)) return;
    try {
      await SavedConversationsService.saveCurrentConversation(sessionMessages, currentConversationId);
    } catch (error) {
      console.warn('Auto-save cloud conversation failed:', error);
    }
  }, [currentConversationId, sessionMessages]);

  const handleSelectConversation = useCallback(async (id: string) => {
    await autoSaveCloudConversation();
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
  }, [autoSaveCloudConversation, currentConversationId, sessionMessages, handleRefreshConversations]);

  const handleClearChat = useCallback(async () => {
    await autoSaveCloudConversation();
    if (currentConversationId && sessionMessages.length > 0) {
      EnhancedFrontendMemory.archiveCurrentConversation(sessionMessages, currentConversationId);
    }
    const newId = EnhancedFrontendMemory.startNewConversation([], null);
    setSessionMessages([]);
    setCurrentConversationId(newId);
    setIsNewConversation(true);
    handleRefreshConversations();
  }, [autoSaveCloudConversation, currentConversationId, sessionMessages, handleRefreshConversations]);

  const handleDeleteConversation = useCallback((id: string) => {
    EnhancedFrontendMemory.deleteArchivedConversation(id);
    if (id === currentConversationId) {
      handleClearChat();
    }
    handleRefreshConversations();
  }, [currentConversationId, handleClearChat, handleRefreshConversations]);


  // Handler for reply button click
  const handleReplyToMessage = useCallback((messageId: string, content: string) => {
    setReplyContext({ messageId, content });
  }, []);

  const handleClearReply = useCallback(() => {
    setReplyContext(null);
  }, []);

  // Stop/abort the current request
  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    // Update the last assistant message to show it was stopped
    setSessionMessages(prev => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg?.role === 'assistant' && (lastMsg as any)?.metadata?.loading) {
        return prev.map((m, i) => i === prev.length - 1 ? {
          ...m,
          content: m.content || (language === 'ar' ? '(تم الإيقاف)' : '(Stopped)'),
          metadata: { ...m.metadata, loading: false, stopped: true }
        } : m);
      }
      return prev;
    });
  }, [language]);

  const handleSendMessage = useCallback(async (
    messageContent: string,
    trigger: string,
    attachedFiles?: any[],
    imageMode?: string,
    imageQuality?: 'fast' | 'best_fast',
    chatSubmodeParam?: ChatSubmode,
    replyContextParam?: ReplyContext
  ) => {
    // Special handling for draw-after-bg mode - trigger generation in canvas
    if (trigger === 'image' && imageMode === 'draw-after-bg') {
      drawCanvasRef.current?.triggerManualGeneration();
      return;
    }

    if (!messageContent.trim() && (!attachedFiles || attachedFiles.length === 0)) {
      showError('Please enter a message or attach a file.');
      return;
    }
    // Prevent double-submit for Vision to avoid aborting a request while body is still uploading
    if (trigger === 'vision') {
      if (visionInFlightRef.current) {
        showError('Please wait for the current vision analysis to finish.');
        return;
      }
      visionInFlightRef.current = true;
    }
    setIsLoading(true);
    
    // Create new AbortController for this request
    // Don't abort previous requests - let them complete naturally
    const controller = new AbortController();
    abortControllerRef.current = controller;
    lastTriggerRef.current = trigger;
    
    let convId = currentConversationId;
    if (!convId) {
      convId = EnhancedFrontendMemory.startNewConversation([], null);
      setCurrentConversationId(convId);
      setIsNewConversation(false);
    }

    const effectiveChatSubmode: ChatSubmode = chatSubmodeParam || chatSubmode;
    const usedStudyThisRequest = effectiveChatSubmode === 'study';

    // Route to Vision path if: explicit vision trigger OR Study mode with images
    const hasImages = attachedFiles && attachedFiles.length > 0 && attachedFiles.some((f: any) => f.type?.startsWith('image/'));
    const isStudyWithImages = trigger === 'chat' && effectiveChatSubmode === 'study' && hasImages;
    const inputType = (trigger === 'vision' || isStudyWithImages) ? 'vision' : 'text';
    // Per-message language override: if user explicitly asks for Arabic translation, force 'ar' for this request
    const wantsArabic = /translate.+to\s+arabic/i.test(messageContent || '') || /إلى العربية/.test(messageContent || '');
    const requestLanguage = wantsArabic ? 'ar' : language;

    // If replying to a message, prepend context for the AI
    let finalMessageContent = messageContent;
    if (replyContextParam) {
      // Get the first line of the reply and truncate if necessary
      const firstLine = replyContextParam.content.split('\n')[0].trim();
      const replyQuote = firstLine.length > 150 
        ? firstLine.substring(0, 150) + '...'
        : firstLine;
      finalMessageContent = `[Replying to: (wakti said) "${replyQuote}"]\n\n${messageContent}`;
    }

    const userMessage: AIMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: finalMessageContent,
      timestamp: new Date(),
      intent: trigger,
      inputType,
      attachedFiles: attachedFiles,
      chatSubmode: effectiveChatSubmode, // Store study/chat mode for bubble styling
      replyTo: replyContextParam?.messageId, // Store reference to replied message
    };
    const newMessages = [...sessionMessages, userMessage];
    setSessionMessages(newMessages);

    const assistantMessageId = `assistant-${Date.now()}`;
    // Detect YouTube-prefixed query to style the loading bubble correctly
    const isYouTubeQuery = (typeof messageContent === 'string') && /^(?:\s*yt:\s*|\s*yt\s+)/i.test(messageContent);
    
    // Track start time for thinking duration calculation
    const startTime = Date.now();
    
    // Map trigger to expected tool calls for ToolUsageIndicator
    const getInitialToolCalls = () => {
      const baseTool = { id: `tool-${Date.now()}`, status: 'running' as const, duration: 0 };
      switch (trigger) {
        case 'search':
          return [
            { ...baseTool, id: `tool-1`, name: 'Web Search', icon: 'globe' },
            { ...baseTool, id: `tool-2`, name: 'AI Analysis', icon: 'brain', status: 'pending' as const }
          ];
        case 'image':
          return [
            { ...baseTool, id: `tool-1`, name: 'Image Generation', icon: 'image' }
          ];
        case 'vision':
          return [
            { ...baseTool, id: `tool-1`, name: 'Vision Analysis', icon: 'eye' },
            { ...baseTool, id: `tool-2`, name: 'AI Processing', icon: 'brain', status: 'pending' as const }
          ];
        default:
          return [
            { ...baseTool, id: `tool-1`, name: 'AI Processing', icon: 'brain' }
          ];
      }
    };
    
    const assistantPlaceholder: AIMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      intent: trigger,
      metadata: {
        loading: true,
        startTime,
        toolsUsed: getInitialToolCalls().length,
        toolCalls: getInitialToolCalls(),
        ...(trigger === 'image' ? { loadingStage: 'generating', progress: 0 } : {}),
        ...(trigger === 'search' && isYouTubeQuery ? { youtubeLoading: true } : {})
      },
    };
    setSessionMessages([...newMessages, assistantPlaceholder]);

    try {
      if (trigger === 'image') {
        // Simulated progress percentage (Option B) to improve UX while waiting for non-streaming image results
        const clearImageProgress = () => {
          if (imageProgressIntervalRef.current) {
            window.clearInterval(imageProgressIntervalRef.current);
            imageProgressIntervalRef.current = null;
          }
        };

        // Clear any previous image progress timer
        clearImageProgress();

        let p = 0;
        const setProgress = (next: number) => {
          const v = Math.max(0, Math.min(100, Math.round(next)));
          setSessionMessages(prev => prev.map(m => m.id === assistantMessageId
            ? { ...m, metadata: { ...(m.metadata || {}), loading: true, loadingStage: 'generating', progress: v } }
            : m
          ));
        };

        setProgress(0);
        imageProgressIntervalRef.current = window.setInterval(() => {
          // Fast to ~15%, then slow to ~92%, then final jump to 100% when done.
          let inc = 0;
          if (p < 15) inc = 3 + Math.random() * 5;
          else if (p < 60) inc = 1 + Math.random() * 2.5;
          else if (p < 85) inc = Math.random() * 1.8;
          else if (p < 92) inc = Math.random() * 0.8;
          p = Math.min(92, p + inc);
          setProgress(p);
        }, 350);

        // Non-streaming image pipeline (text2image / image2image / background-removal)
        const response = await WaktiAIV2Service.sendMessage(
          messageContent,
          userProfile.id,
          requestLanguage,
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

        clearImageProgress();

        const responseAny = response as any;
        const resolvedImageUrl = responseAny?.imageUrl || responseAny?.url || responseAny?.image_url || responseAny?.imageURL;
        const endTime = Date.now();
        const thinkingDuration = Math.round((endTime - startTime) / 1000);
        
        const finalAssistantMessage: AIMessage = {
          ...assistantPlaceholder,
          content: response.response,
          metadata: { 
            loading: false, 
            ...response.metadata,
            thinkingDuration,
            toolsUsed: 1,
            toolCalls: [
              { id: 'img-1', name: 'Image Generation', icon: 'image', status: 'completed', duration: thinkingDuration }
            ]
          },
          intent: trigger,
          ...(resolvedImageUrl ? { imageUrl: resolvedImageUrl } : {})
        };

        setSessionMessages(prev => {
          const finalMessages = prev.map(m => m.id === assistantMessageId ? finalAssistantMessage : m);
          EnhancedFrontendMemory.saveActiveConversation(finalMessages, convId);
          return finalMessages;
        });
      } else if (inputType === 'vision') {
        console.log('🔍 VISION PATH ENTERED:', { inputType, trigger, attachedFilesCount: attachedFiles?.length });
        let streamed = '';
        let streamMeta: any = {};
        let firstToken = false;
        const streamedResp = await WaktiAIV2Service.sendStreamingMessage(
          messageContent,
          userProfile.id,
          requestLanguage,
          convId,
          inputType, // 'vision'
          newMessages,
          false, // skipContextLoad
          trigger,
          '', // conversationSummary
          attachedFiles,
          (token: string) => {
            console.log('🎯 VISION TOKEN RECEIVED:', token.substring(0, 50));
            streamed += token;
            if (!firstToken) {
              firstToken = true;
              console.log('🎯 VISION FIRST TOKEN - clearing loading state');
              setIsLoading(false);
              setSessionMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, metadata: { ...(m.metadata || {}), loading: false } } : m));
            }
            setSessionMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: streamed } : m));
          },
          (metadata: any) => { 
            console.log('🎯 VISION METADATA:', metadata);
            streamMeta = metadata || {}; 
          },
          (err: string) => { 
            console.error('❌ Vision stream error:', err);
            // CRITICAL: Clear loading state on error to prevent "I'm on it..." stuck forever
            setIsLoading(false);
            setSessionMessages(prev => prev.map(m => m.id === assistantMessageId ? { 
              ...m, 
              content: language === 'ar' ? 'عذراً، حدث خطأ في تحليل الصورة. يرجى المحاولة مرة أخرى.' : 'Sorry, an error occurred analyzing the image. Please try again.',
              metadata: { ...(m.metadata || {}), loading: false, error: true }
            } : m));
          },
          controller.signal,
          effectiveChatSubmode // Pass chatSubmode for Study mode support in Vision
        );
        console.log('✅ VISION STREAM COMPLETED:', { responseLength: streamedResp?.response?.length, streamed: streamed.length });

        const visionEndTime = Date.now();
        const visionThinkingDuration = Math.round((visionEndTime - startTime) / 1000);
        
        const finalAssistantMessage: AIMessage = {
          ...assistantPlaceholder,
          content: streamedResp?.response ?? streamed,
          metadata: { 
            loading: false, 
            ...streamMeta,
            thinkingDuration: visionThinkingDuration,
            toolsUsed: 2,
            toolCalls: [
              { id: 'vision-1', name: 'Vision Analysis', icon: 'eye', status: 'completed', duration: Math.round(visionThinkingDuration * 0.6) },
              { id: 'vision-2', name: 'AI Processing', icon: 'brain', status: 'completed', duration: Math.round(visionThinkingDuration * 0.4) }
            ]
          },
          intent: trigger,
        };

        setSessionMessages(prev => {
          const finalMessages = prev.map(m => m.id === assistantMessageId ? finalAssistantMessage : m);
          EnhancedFrontendMemory.saveActiveConversation(finalMessages, convId);
          return finalMessages;
        });
        return; // Done (skip streaming path)
      }
      else {
        let streamed = '';
        let streamMeta: any = {};
        let firstToken = false;
        // If Search mode and message is a YouTube query, use the non-streaming YouTube path
        const ytPrefix = /^(?:\s*yt:\s*|\s*yt\s+)/i.test(messageContent || '');
        if (trigger === 'search' && ytPrefix) {
          const response = await WaktiAIV2Service.sendMessage(
            messageContent,
            userProfile.id,
            requestLanguage,
            convId,
            inputType,
            newMessages,
            false,
            trigger,
            '',
            attachedFiles,
            controller.signal
          );

          const ytEndTime = Date.now();
          const ytThinkingDuration = Math.round((ytEndTime - startTime) / 1000);
          
          const finalAssistantMessage: AIMessage = {
            ...assistantPlaceholder,
            content: (response as any)?.response || '',
            metadata: { 
              loading: false, 
              ...(response as any)?.metadata,
              thinkingDuration: ytThinkingDuration,
              toolsUsed: 2,
              toolCalls: [
                { id: 'yt-1', name: 'YouTube Search', icon: 'video', status: 'completed', duration: Math.round(ytThinkingDuration * 0.6) },
                { id: 'yt-2', name: 'AI Analysis', icon: 'brain', status: 'completed', duration: Math.round(ytThinkingDuration * 0.4) }
              ]
            },
            intent: trigger,
          };

          setSessionMessages(prev => {
            const finalMessages = prev.map(m => m.id === assistantMessageId ? finalAssistantMessage : m);
            EnhancedFrontendMemory.saveActiveConversation(finalMessages, convId);
            return finalMessages;
          });
          return; // Done (skip streaming path)
        }

        const streamedResp = await WaktiAIV2Service.sendStreamingMessage(
          messageContent,
          userProfile.id,
          requestLanguage,
          convId,
          inputType, // 'text' or other non-vision types
          newMessages,
          false, // skipContextLoad
          trigger,
          '', // conversationSummary
          attachedFiles,
          (token: string) => {
            streamed += token;
            if (!firstToken) {
              firstToken = true;
              setIsLoading(false);
              setSessionMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, metadata: { ...(m.metadata || {}), loading: false } } : m));
            }
            setSessionMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: streamed } : m));
          },
          (metadata: any) => { 
            streamMeta = metadata || {};
            // Handle search confirmation request - show Yes/No card
            if (metadata?.searchConfirmation) {
              const conf = metadata.searchConfirmation;
              setSessionMessages(prev => prev.map(m => m.id === assistantMessageId ? {
                ...m,
                content: '',
                metadata: { 
                  ...m.metadata, 
                  loading: false,
                  searchConfirmation: conf
                }
              } : m));
              setIsLoading(false);
            }
          },
          (err: string) => { 
            console.error('Stream error:', err);
            // CRITICAL: Clear loading state on error to prevent "I'm on it..." stuck forever
            setIsLoading(false);
            setSessionMessages(prev => prev.map(m => m.id === assistantMessageId ? { 
              ...m, 
              metadata: { ...(m.metadata || {}), loading: false, error: true }
            } : m));
          },
          controller.signal,
          chatSubmodeParam || 'chat' // Pass chatSubmode for Study mode support
        );

        // If search confirmation was triggered, don't update with final message
        if (streamMeta?.searchConfirmation) {
          return;
        }

        const streamEndTime = Date.now();
        const streamThinkingDuration = Math.round((streamEndTime - startTime) / 1000);
        
        // Determine tool calls based on trigger
        const getCompletedToolCalls = () => {
          switch (trigger) {
            case 'search':
              return [
                { id: 'search-1', name: 'Web Search', icon: 'globe', status: 'completed' as const, duration: Math.round(streamThinkingDuration * 0.5) },
                { id: 'search-2', name: 'AI Analysis', icon: 'brain', status: 'completed' as const, duration: Math.round(streamThinkingDuration * 0.5) }
              ];
            default:
              return [
                { id: 'chat-1', name: 'AI Processing', icon: 'brain', status: 'completed' as const, duration: streamThinkingDuration }
              ];
          }
        };
        
        const finalAssistantMessage: AIMessage = {
          ...assistantPlaceholder,
          content: streamedResp?.response ?? streamed,
          metadata: { 
            loading: false, 
            ...streamMeta,
            thinkingDuration: streamThinkingDuration,
            toolsUsed: getCompletedToolCalls().length,
            toolCalls: getCompletedToolCalls()
          },
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
      const errorEndTime = Date.now();
      // If we already streamed some content (e.g., fallback provider succeeded), keep it.
      setSessionMessages(prev => {
        const hadStream = !!prev.find(m => m.id === assistantMessageId)?.content;
        const placeholderMsg = prev.find(m => m.id === assistantMessageId);
        const errorStartTime = (placeholderMsg?.metadata as any)?.startTime || errorEndTime;
        const thinkingDuration = Math.round((errorEndTime - errorStartTime) / 1000);
        
        const finalMessages = prev.map(m => {
          if (m.id !== assistantMessageId) return m;
          if (hadStream) {
            return { ...m, metadata: { ...(m.metadata || {}), loading: false, thinkingDuration } };
          }
          return {
            ...m,
            content: language === 'ar' ? 'عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.' : 'Sorry, I encountered an error. Please try again.',
            metadata: { 
              loading: false, 
              error: true,
              errorTitle: language === 'ar' ? 'فشل الطلب' : 'Request Failed',
              errorTitleAr: 'فشل الطلب',
              errorMessage: error?.message || (language === 'ar' ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred'),
              errorMessageAr: error?.message || 'حدث خطأ غير متوقع',
              errorSeverity: 'error',
              suggestedAction: language === 'ar' ? 'حاول مرة أخرى أو أعد صياغة سؤالك' : 'Try again or rephrase your question',
              suggestedActionAr: 'حاول مرة أخرى أو أعد صياغة سؤالك',
              thinkingDuration,
              toolsUsed: 1,
              toolCalls: [{ id: 'error-1', name: 'AI Processing', icon: 'brain', status: 'completed', duration: thinkingDuration }]
            },
          };
        });
        EnhancedFrontendMemory.saveActiveConversation(finalMessages, convId);
        return finalMessages;
      });
    } finally {
      if (imageProgressIntervalRef.current) {
        window.clearInterval(imageProgressIntervalRef.current);
        imageProgressIntervalRef.current = null;
      }
      setIsLoading(false);
      
      // Clear safety timeout since request completed
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
      
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }

      // HARD RULE: Study mode must never persist.
      // After ANY request that used Study, always snap back to Chat.
      if (usedStudyThisRequest) {
        setActiveTrigger('chat');
        setChatSubmode('chat');
        console.log('🔄 AUTO-SWITCH: Study used → Chat mode');
      }

      // HARD RULE: Search mode must never persist.
      // After ANY search request completes, always snap back to Chat mode.
      if (trigger === 'search') {
        setActiveTrigger('chat');
        console.log('🔄 AUTO-SWITCH: Search completed → Chat mode');
      }
      
      // Auto-switch back to Chat after certain modes to save backend credits
      // and provide a smoother UX (user usually wants to chat about the result)
      if (trigger === 'vision') {
        visionInFlightRef.current = false;
      }
      // Study mode only persists when user explicitly stays in chat trigger
    }
  }, [currentConversationId, language, sessionMessages, userProfile]);

  // Listen for search confirmation Yes/No card responses
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ confirmed: boolean; originalMessage: string }>;
      const { confirmed, originalMessage } = ce.detail || {};
      if (!originalMessage) return;
      
      // Remove the search confirmation message
      setSessionMessages(prev => prev.filter(m => !(m.role === 'assistant' && (m as any)?.metadata?.searchConfirmation)));
      
      if (confirmed) {
        // User said Yes - trigger search mode with original message
        setActiveTrigger('search');
        setTimeout(() => {
          handleSendMessage(originalMessage, 'search', [], undefined, undefined, 'chat');
        }, 100);
      } else {
        // User said No - continue with chat mode (force chat, skip intent gate)
        setTimeout(() => {
          handleSendMessage(originalMessage, 'chat', [], undefined, undefined, 'chat');
        }, 100);
      }
    };
    window.addEventListener('wakti-search-confirm', handler as EventListener);
    return () => window.removeEventListener('wakti-search-confirm', handler as EventListener);
  }, [handleSendMessage]);

  const handleConfirmTask = (taskData: any) => { console.log('Task confirmed:', taskData); setShowTaskConfirmation(false); };
  const handleDeclineTask = () => { console.log('Task declined'); setShowTaskConfirmation(false); };
  const handleConfirmReminder = (reminderData: any) => { console.log('Reminder confirmed:', reminderData); };

  // Handle Talk mode messages - add with "Talk" badge
  const handleAddTalkMessage = useCallback((role: 'user' | 'assistant', text: string) => {
    // Use timestamp + random suffix to ensure unique IDs even for rapid additions
    const uniqueId = `${role}-talk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newMessage: AIMessage = {
      id: uniqueId,
      role,
      content: text,
      timestamp: new Date(),
      intent: 'talk', // Special intent for Talk messages
      metadata: { isTalkMessage: true }, // Flag for Talk badge
    };
    setSessionMessages(prev => {
      const updated = [...prev, newMessage];
      EnhancedFrontendMemory.saveActiveConversation(updated, currentConversationId);
      return updated;
    });
  }, [currentConversationId]);

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
        {activeTrigger === 'image' && activeImageMode === 'draw-after-bg' ? (
          <DrawAfterBGCanvas ref={drawCanvasRef} prompt={message} />
        ) : (
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
            onReplyToMessage={handleReplyToMessage}
          />
        )}
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
              onImageModeChange={setActiveImageMode}
              chatSubmode={chatSubmode}
              onChatSubmodeChange={setChatSubmode}
              onAddTalkMessage={handleAddTalkMessage}
              replyContext={replyContext}
              onClearReply={handleClearReply}
              onStop={handleStop}
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
              onImageModeChange={setActiveImageMode}
              chatSubmode={chatSubmode}
              onChatSubmodeChange={setChatSubmode}
              onAddTalkMessage={handleAddTalkMessage}
              replyContext={replyContext}
              onClearReply={handleClearReply}
              onStop={handleStop}
            />
          </div>
        )}
    </div>
  );
};

export default WaktiAIV2;
