import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { WaktiAIV2Service, AIMessage } from '@/services/WaktiAIV2Service';
import { SavedConversationsService } from '@/services/SavedConversationsService';
import { EnhancedFrontendMemory, ConversationMetadata } from '@/services/EnhancedFrontendMemory';
import { useToastHelper } from "@/hooks/use-toast-helper";
import { supabase } from '@/integrations/supabase/client';
import { ChatMessages } from '@/components/wakti-ai-v2/ChatMessages';
import { StreamingBubbleHandle } from '@/components/wakti-ai-v2/StreamingBubble';
import { ChatInput, ChatSubmode, ReplyContext } from '@/components/wakti-ai-v2/ChatInput';
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
  const [chatSubmode, setChatSubmode] = useState<ChatSubmode>('chat');
  const [replyContext, setReplyContext] = useState<ReplyContext | null>(null);
  const [chatTrialLimitReached, setChatTrialLimitReached] = useState(false);
  // Streaming isolation: active stream ID tracked in state (one set per message, not per token).
  // Token content goes directly to DOM via streamingBubbleRef — zero React re-renders per token.
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const streamingBubbleRef = useRef<StreamingBubbleHandle>(null);
  const streamedContentRef = useRef<string>(''); // closure-safe accumulator for final flush

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const visionInFlightRef = useRef<boolean>(false);
  const lastTriggerRef = useRef<string>('chat');
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { language } = useTheme();
  const { showError } = useToastHelper();
  const { isDesktop } = useIsDesktop();

  const canSendMessage = useMemo(() => !isLoading && !chatTrialLimitReached && userProfile?.id, [isLoading, chatTrialLimitReached, userProfile?.id]);

  const loadUserProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserProfile(user);
    if (!user?.id) return;
    // Mount-time backend check: has this user already exhausted their ai_chat trial?
    // Prevents the refresh loophole where chatTrialLimitReached resets to false on reload.
    try {
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('trial_usage, is_subscribed, payment_method, next_billing_date')
        .eq('id', user.id)
        .single();
      if (profile) {
        const isPaid = profile.is_subscribed === true;
        const hasPaymentMethod = profile.payment_method != null && profile.payment_method.trim().length > 0;
        const isGift = hasPaymentMethod && (!profile.next_billing_date || new Date(profile.next_billing_date) > new Date());
        if (!isPaid && !isGift) {
          const usage = (profile.trial_usage as Record<string, number>) ?? {};
          const aiChatUsed = typeof usage['ai_chat'] === 'number' ? usage['ai_chat'] : 0;
          if (aiChatUsed >= 15) {
            setChatTrialLimitReached(true);
          }
        }
      }
    } catch {
      // non-critical — if check fails, backend will block on next send
    }
  };

  const loadPersonalTouch = () => {
    try {
      const stored = localStorage.getItem('wakti_personal_touch');
      setPersonalTouch(stored ? JSON.parse(stored) : null);
    } catch {
      setPersonalTouch(null);
    }
  };

  // Lock chat input when ai_chat trial limit is reached
  useEffect(() => {
    const handleTrialLimit = (e: Event) => {
      const feature = (e as CustomEvent)?.detail?.feature;
      if (!feature || feature === 'ai_chat') {
        setChatTrialLimitReached(true);
      }
    };
    window.addEventListener('wakti-trial-limit-reached', handleTrialLimit);
    return () => window.removeEventListener('wakti-trial-limit-reached', handleTrialLimit);
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

    // Route to Vision path if: explicit vision trigger (NOT Study mode - Study uses brain-stream with OCR→Wolfram)
    const hasImages = attachedFiles && attachedFiles.length > 0 && attachedFiles.some((f: any) => f.type?.startsWith('image/'));
    // Study mode with images: stays as 'text' inputType but passes images to brain-stream for OCR→Wolfram pipeline
    // Regular vision trigger: uses 'vision' inputType for general image analysis
    const inputType = (trigger === 'vision' && effectiveChatSubmode !== 'study') ? 'vision' : 'text';
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
        case 'vision':
          return [
            { ...baseTool, id: `tool-1`, name: 'Vision Analysis', icon: 'scan' },
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
        ...(trigger === 'search' && isYouTubeQuery ? { youtubeLoading: true } : {})
      },
    };
    setSessionMessages([...newMessages, assistantPlaceholder]);

    try {
      if (inputType === 'vision') {
        console.log('🔍 VISION PATH ENTERED:', { inputType, trigger, attachedFilesCount: attachedFiles?.length });
        let streamed = '';
        let streamMeta: any = {};
        let firstToken = false;
        let rafPending = false;
        const fetchStartTime = Date.now();

        // Activate streaming isolation: mount StreamingBubble, reset its DOM content
        streamedContentRef.current = '';
        streamingBubbleRef.current?.reset();
        setStreamingMessageId(assistantMessageId);

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
            streamed += token;
            streamedContentRef.current = streamed;
            if (!firstToken) {
              firstToken = true;
              const firstTokenMs = Date.now() - fetchStartTime;
              console.log(`🎯 VISION FIRST TOKEN [${firstTokenMs}ms from fetch]`);
              setIsLoading(false);
              // One-time metadata update: clear loading flag on the placeholder bubble
              setSessionMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, metadata: { ...(m.metadata || {}), loading: false } } : m));
            }
            // ZERO React re-renders: write accumulated text directly to DOM via ref
            // Invisibility cloak: strip any reminder JSON before it hits the screen
            const displayContent = streamed.split('{"action"')[0].trim();
            if (!rafPending) {
              rafPending = true;
              requestAnimationFrame(() => {
                rafPending = false;
                streamingBubbleRef.current?.setContent(displayContent);
              });
            }
          },
          (metadata: any) => { 
            console.log('🎯 VISION METADATA:', metadata);
            streamMeta = metadata || {}; 
          },
          (err: string) => { 
            console.error('❌ Vision stream error:', err);
            // CRITICAL: Clear streaming overlay + loading state on error
            setStreamingMessageId(null);
            streamingBubbleRef.current?.reset();
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
        const cleanedStreamed = streamed.split('{"action"')[0].trim();
        const finalAssistantMessage: AIMessage = {
          ...assistantPlaceholder,
          content: streamedResp?.response ?? cleanedStreamed,
          metadata: { 
            loading: false, 
            ...streamMeta,
            thinkingDuration: visionThinkingDuration,
            toolsUsed: 2,
            toolCalls: [
              { id: 'vision-1', name: 'Vision Analysis', icon: 'scan', status: 'completed', duration: Math.round(visionThinkingDuration * 0.6) },
              { id: 'vision-2', name: 'AI Processing', icon: 'brain', status: 'completed', duration: Math.round(visionThinkingDuration * 0.4) }
            ]
          },
          intent: trigger,
        };

        // Flush final content into sessionMessages (one-time, not per-token)
        // Then clear streaming overlay — ChatMessages will switch to rendering message.content
        setStreamingMessageId(null);
        streamingBubbleRef.current?.reset();
        setSessionMessages(prev => {
          const finalMessages = prev.map(m => m.id === assistantMessageId ? finalAssistantMessage : m);
          setTimeout(() => EnhancedFrontendMemory.saveActiveConversation(finalMessages, convId), 0);
          return finalMessages;
        });
        return; // Done (skip streaming path)
      }
      else {
        let streamed = '';
        let streamMeta: any = {};
        let firstToken = false;
        let rafPending = false;
        const fetchStartTime = Date.now();
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
            setTimeout(() => EnhancedFrontendMemory.saveActiveConversation(finalMessages, convId), 0);
            return finalMessages;
          });
          return; // Done (skip streaming path)
        }

        // Activate streaming isolation: mount StreamingBubble, reset its DOM content
        streamedContentRef.current = '';
        streamingBubbleRef.current?.reset();
        setStreamingMessageId(assistantMessageId);

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
            streamedContentRef.current = streamed;
            if (!firstToken) {
              firstToken = true;
              const firstTokenMs = Date.now() - fetchStartTime;
              console.log(`🎯 CLIENT: First token [${firstTokenMs}ms from fetch] trigger=${trigger}`);
              setIsLoading(false);
              // One-time metadata update: clear loading flag on the placeholder bubble
              setSessionMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, metadata: { ...(m.metadata || {}), loading: false } } : m));
            }
            // ZERO React re-renders: write accumulated text directly to DOM via ref
            // Invisibility cloak: strip any reminder JSON before it hits the screen
            const displayContent = streamed.split('{"action"')[0].trim();
            if (!rafPending) {
              rafPending = true;
              requestAnimationFrame(() => {
                rafPending = false;
                streamingBubbleRef.current?.setContent(displayContent);
              });
            }
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
            setIsLoading(false);
            // Trial limit: remove placeholder silently — overlay handles the UX
            if (err === 'TRIAL_LIMIT_REACHED') {
              setSessionMessages(prev => prev.filter(m => m.id !== assistantMessageId));
              return;
            }
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
        
        const cleanedStreamed = streamed.split('{"action"')[0].trim();
        const finalAssistantMessage: AIMessage = {
          ...assistantPlaceholder,
          content: streamedResp?.response ?? cleanedStreamed,
          metadata: { 
            loading: false, 
            ...streamMeta,
            thinkingDuration: streamThinkingDuration,
            toolsUsed: getCompletedToolCalls().length,
            toolCalls: getCompletedToolCalls()
          },
          intent: trigger,
        };

        // Flush final content into sessionMessages (one-time, not per-token)
        // Then clear streaming overlay — ChatMessages will switch to rendering message.content
        setStreamingMessageId(null);
        streamingBubbleRef.current?.reset();
        setSessionMessages(prev => {
          const finalMessages = prev.map(m => m.id === assistantMessageId ? finalAssistantMessage : m);
          setTimeout(() => EnhancedFrontendMemory.saveActiveConversation(finalMessages, convId), 0);
          return finalMessages;
        });
      }

    } catch (error: any) {
      console.error('Error sending message:', error);
      // Trial limit: remove placeholder silently — overlay handles the UX
      if (error?.message === 'TRIAL_LIMIT_REACHED' || String(error?.message).includes('TRIAL_LIMIT')) {
        setSessionMessages(prev => prev.filter(m => m.id !== assistantMessageId));
        setIsLoading(false);
        setStreamingMessageId(null);
        streamingBubbleRef.current?.reset();
        return;
      }
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
        setTimeout(() => EnhancedFrontendMemory.saveActiveConversation(finalMessages, convId), 0);
        return finalMessages;
      });
    } finally {
      // Always clear streaming overlay on completion or error
      setStreamingMessageId(null);
      streamingBubbleRef.current?.reset();
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
        setActiveTrigger('chat');
        console.log('🔄 AUTO-SWITCH: Vision completed → Chat mode');
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
      setTimeout(() => EnhancedFrontendMemory.saveActiveConversation(updated, currentConversationId), 0);
      return updated;
    });
  }, [currentConversationId]);

  return (
    <div className="wakti-ai-page-container" style={{ position: 'relative' }}>

      {/* Trial limit overlay — shades the page, centered subscribe card */}
      {chatTrialLimitReached && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(0,0,0,0.88)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #0c0f14 0%, hsl(235,25%,10%) 50%, hsl(250,20%,12%) 100%)',
            border: '1.5px solid rgba(130,100,255,0.35)',
            borderRadius: '1.5rem',
            padding: '40px 32px',
            maxWidth: '420px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 24px 80px rgba(0,0,0,0.9), 0 0 60px rgba(130,100,255,0.15)',
          }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '16px', lineHeight: 1 }}>🚀</div>
            <h2 style={{
              margin: '0 0 12px',
              fontSize: '1.5rem',
              fontWeight: 800,
              color: '#f2f2f2',
              letterSpacing: '-0.02em',
            }}>
              {language === 'ar' ? 'انتهت رسائلك المجانية' : 'Free Messages Used Up'}
            </h2>
            <p style={{
              margin: '0 0 28px',
              fontSize: '1rem',
              color: 'rgba(242,242,242,0.7)',
              lineHeight: 1.6,
            }}>
              {language === 'ar'
                ? 'استخدمت ١٥ رسالة مجانية (Chat، Study، بحث الويب، ويوتيوب مجتمعة). اشترك للحصول على وصول غير محدود!'
                : "You've used all 15 free messages — Chat, Study, Web Search & YouTube combined. Subscribe for unlimited access!"}
            </p>
            <a
              href="https://apps.apple.com/us/app/wakti-ai/id6755150700"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                background: 'linear-gradient(135deg, hsl(210,100%,65%) 0%, hsl(260,80%,65%) 50%, hsl(280,70%,65%) 100%)',
                color: '#fff',
                fontWeight: 800,
                fontSize: '1.1rem',
                borderRadius: '1rem',
                padding: '16px 24px',
                textDecoration: 'none',
                marginBottom: '14px',
                boxShadow: '0 4px 24px hsla(260,80%,65%,0.45)',
                letterSpacing: '-0.01em',
              }}
            >
              {language === 'ar' ? '⚡ اشترك الآن' : '⚡ Subscribe Now'}
            </a>
            <button
              onClick={() => window.history.back()}
              style={{
                display: 'block',
                width: '100%',
                background: 'transparent',
                border: '1.5px solid rgba(242,242,242,0.18)',
                borderRadius: '1rem',
                color: 'rgba(242,242,242,0.7)',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '13px 24px',
                transition: 'border-color 0.2s, color 0.2s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(242,242,242,0.45)'; (e.currentTarget as HTMLButtonElement).style.color = '#f2f2f2'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(242,242,242,0.18)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(242,242,242,0.7)'; }}
            >
              {language === 'ar' ? '← رجوع' : 'Go back →'}
            </button>
          </div>
        </div>
      )}
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
          height: `calc(100dvh - var(--app-header-h))`,
          overflowY: 'auto',
          paddingBottom: `${inputReservePx + 12}px`
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
            onReplyToMessage={handleReplyToMessage}
            streamingMessageId={streamingMessageId}
            streamingBubbleRef={streamingBubbleRef}
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
