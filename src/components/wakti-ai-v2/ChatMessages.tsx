import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { MessageSquare, Bot, User, Calendar, Clock, CheckCircle, Loader2, Volume2, Copy, VolumeX, ExternalLink, Play, Pause, RotateCcw } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { AIMessage } from '@/services/WaktiAIV2Service';
import { TaskConfirmationCard } from './TaskConfirmationCard';
import { EditableTaskConfirmationCard } from './EditableTaskConfirmationCard';

import { Badge } from '@/components/ui/badge';
import { ImageModal } from './ImageModal';
import { YouTubePreview } from './YouTubePreview';
import { supabase } from '@/integrations/supabase/client';
import { getSelectedVoices } from './TalkBackSettings';
import { useMobileKeyboard } from '@/hooks/useMobileKeyboard';
import { useAudioSession } from '@/hooks/useAudioSession';
import { useIsMobile } from '@/hooks/use-mobile';

interface ChatMessagesProps {
  sessionMessages: AIMessage[];
  isLoading: boolean;
  activeTrigger: string;
  scrollAreaRef: React.RefObject<HTMLDivElement>;
  userProfile: any;
  personalTouch: any;
  showTaskConfirmation: boolean;
  pendingTaskData: any;
  pendingReminderData: any;
  taskConfirmationLoading: boolean;
  onTaskConfirmation: (taskData: any) => void;
  onReminderConfirmation: (reminderData: any) => void;
  onCancelTaskConfirmation: () => void;
  conversationId: string | null;
  isNewConversation: boolean;
  onUpdateMessage?: (messageId: string, content: string) => void;
}

export function ChatMessages({
  sessionMessages,
  isLoading,
  activeTrigger,
  scrollAreaRef,
  userProfile,
  personalTouch,
  showTaskConfirmation,
  pendingTaskData,
  pendingReminderData,
  taskConfirmationLoading,
  onTaskConfirmation,
  onReminderConfirmation,
  onCancelTaskConfirmation,
  conversationId,
  isNewConversation,
  onUpdateMessage
}: ChatMessagesProps) {
  const { language } = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isKeyboardVisible } = useMobileKeyboard();
  const [inputHeight, setInputHeight] = useState<number>(80);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  // Always-accurate ref mirror to avoid stale state in async guards
  const speakingMessageIdRef = useRef<string | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  // Transient visual state to keep the green glow briefly after audio ends
  const [fadeOutId, setFadeOutId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ url: string; prompt?: string } | null>(null);
  // ElevenLabs audio playback state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef<Map<string, string>>(new Map()); // messageId -> object URL
  const PERSIST_CACHE_PREFIX = 'wakti_tts_cache_'; // sessionStorage key prefix
  const [prefetchingIds, setPrefetchingIds] = useState<Set<string>>(new Set());
  const [fetchingIds, setFetchingIds] = useState<Set<string>>(new Set()); // active network fetches for playback
  const prefetchTimersRef = useRef<Map<string, number>>(new Map()); // messageId -> timeout id
  const autoPlayedIdsRef = useRef<Set<string>>(new Set()); // messages we've auto-played
  // Progress percentage per message while fetching audio
  const [progressMap, setProgressMap] = useState<Map<string, number>>(new Map());
  // Smooth progress intervals for unknown content-length streams
  const progressIntervalRef = useRef<Map<string, number>>(new Map()); // messageId -> interval id
  // Talk Back Auto Play and iOS unlock helpers
  const autoPlayRef = useRef<boolean>(false);
  const audioUnlockedRef = useRef<boolean>(false);
  const preemptRef = useRef<boolean>(false);
  const activeSourceRef = useRef<'youtube' | 'tts' | 'voice-recording' | 'other' | null>(null);
  const [preemptPromptId, setPreemptPromptId] = useState<string | null>(null);

  // Audio session management for TTS
  const { register, unregister, requestPlayback, stopSession, unlockAudio, currentSession } = useAudioSession();
  const { isMobile } = useIsMobile();
  // Use actual mobile detection instead of forcing desktop behavior for TTS/session gating

  // Keep ref synchronized with state to avoid stale closures during async work
  useEffect(() => {
    speakingMessageIdRef.current = speakingMessageId;
  }, [speakingMessageId]);

  const bufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  // Sanitize content for TTS so it does not read symbols like ":", "*", or markdown like "##"
  const sanitizeForTTS = (raw: string) => {
    try {
      let t = raw || '';
      // Strip markdown links [text](url) -> text
      t = t.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
      // Remove code fences/backticks
      t = t.replace(/`{1,3}[^`]*`{1,3}/g, ' ');
      t = t.replace(/`/g, ' ');
      // Remove markdown headings and emphasis markers (#, *, _, >)
      t = t.replace(/^\s*#{1,6}\s*/gm, '');
      t = t.replace(/[\*\_\>#`~]+/g, ' ');
      // Remove list bullets like "- ", "* ", "• " at line starts
      t = t.replace(/^\s*[-*•]\s+/gm, '');
      // Remove excessive separators like ::: or ---
      t = t.replace(/[:]{1,}/g, ' ');
      t = t.replace(/-{3,}/g, ' ');
      // Collapse whitespace
      t = t.replace(/\s{2,}/g, ' ').trim();
      return t;
    } catch {
      return raw;
    }
  };

  // Session manager now arbitrates audio; no event-based coupling needed here.

  // Trigger a short fade-out glow after audio ends
  const triggerFadeOut = (id: string) => {
    try { setFadeOutId(id); } catch {}
    window.setTimeout(() => {
      setFadeOutId((curr) => (curr === id ? null : curr));
    }, 450);
  };

  // Persisted cache helpers: store base64 with text length to detect truncation
  type PersistedAudio = { b64: string; len: number };
  const getPersisted = (id: string): PersistedAudio | null => {
    const raw = sessionStorage.getItem(PERSIST_CACHE_PREFIX + id);
    if (!raw) return null;
    try {
      // New format: JSON
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.b64 === 'string' && typeof parsed.len === 'number') return parsed;
      // Fallback legacy: raw is base64 only (assume unknown length)
      return { b64: raw, len: 0 };
    } catch {
      // Legacy base64
      return { b64: raw, len: 0 };
    }
  };
  const setPersisted = (id: string, b64: string, len: number) => {
    try { sessionStorage.setItem(PERSIST_CACHE_PREFIX + id, JSON.stringify({ b64, len })); } catch {}
  };

  const base64ToBlobUrl = (base64: string) => {
    const byteChars = atob(base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'audio/mpeg' });
    return URL.createObjectURL(blob);
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sessionMessages, showTaskConfirmation]);

  // Auto-scroll to the latest message when the mobile keyboard opens (native chat feel)
  useEffect(() => {
    if (!isKeyboardVisible) return;
    const doScroll = () => {
      try {
        // Prefer scrolling the outer scroll area if provided
        if (scrollAreaRef?.current) {
          scrollAreaRef.current.scrollTo({
            top: scrollAreaRef.current.scrollHeight,
            behavior: 'smooth',
          });
        }
        // Ensure the absolute last anchor is in view
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      } catch {}
    };
    // Slight delay to allow layout to settle after viewport shrink
    const t = window.setTimeout(doScroll, 60);
    return () => window.clearTimeout(t);
  }, [isKeyboardVisible, scrollAreaRef]);

  // Keep scrolled to bottom when input height changes (maintain consistent gap)
  useEffect(() => {
    const handler = (e?: Event) => {
      // Update local CSS variable source of truth for reliability
      try {
        const ce = e as CustomEvent<{ height: number }>;
        if (ce?.detail?.height && Number.isFinite(ce.detail.height)) {
          setInputHeight(ce.detail.height);
        } else {
          const container = scrollAreaRef?.current?.closest('.wakti-ai-container') as HTMLElement | null;
          const root: HTMLElement = container ?? document.documentElement;
          const v = getComputedStyle(root).getPropertyValue('--chat-input-height');
          const n = parseInt(v || '0', 10);
          if (Number.isFinite(n) && n > 0) setInputHeight(n);
        }
      } catch {}
      // Always pin to bottom so the visual gap remains exact after resize
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
      }
    };
    window.addEventListener('wakti-chat-input-resized', handler as EventListener);
    return () => window.removeEventListener('wakti-chat-input-resized', handler as EventListener);
  }, [scrollAreaRef]);

  // Initialize input height from the nearest chat container after mount
  useEffect(() => {
    try {
      const container = scrollAreaRef?.current?.closest('.wakti-ai-container') as HTMLElement | null;
      const root: HTMLElement = container ?? document.documentElement;
      const v = getComputedStyle(root).getPropertyValue('--chat-input-height');
      const n = parseInt(v || '0', 10);
      if (Number.isFinite(n) && n > 0) setInputHeight(n);
    } catch {}
  }, [scrollAreaRef?.current]);

  // Cleanup all progress intervals on unmount
  useEffect(() => {
    return () => {
      for (const [, iv] of progressIntervalRef.current) {
        window.clearInterval(iv);
      }
      progressIntervalRef.current.clear();
    };
  }, []);

  // Disable auto prefetch on stream-finished events (fetch only on user click)
  useEffect(() => {
    const onStreamFinished = () => {};
    window.addEventListener('wakti-ai-stream-finished', onStreamFinished as EventListener);
    return () => window.removeEventListener('wakti-ai-stream-finished', onStreamFinished as EventListener);
  }, []);

  // Listen for voice changes to invalidate caches
  useEffect(() => {
    const handler = () => {
      // Clear in-memory cache when voice is changed to avoid stale audio
      for (const url of audioCacheRef.current.values()) {
        try { URL.revokeObjectURL(url); } catch {}
      }
      audioCacheRef.current.clear();
    };
    window.addEventListener('wakti-tts-voice-changed', handler as EventListener);
    return () => window.removeEventListener('wakti-tts-voice-changed', handler as EventListener);
  }, []);

  // Google Cloud TTS via Edge Function (no ElevenLabs, no browser SpeechSynthesis)
  const handleSpeak = async (text: string, messageId: string, userInitiated = false, forcePreempt = false) => {
    try {
      console.log('[TTS] handleSpeak click', { id: messageId, len: text?.length || 0 });
      const cleanText = sanitizeForTTS(text);
      const sessionId = `tts-${messageId}`;
      
      // Toggle off if already playing this message
      if (speakingMessageId === messageId) {
        console.log('[TTS] toggling OFF current message', messageId);
        if (audioRef.current) {
          try { audioRef.current.pause(); } catch {}
          try { audioRef.current.currentTime = 0; } catch {}
        }
        setSpeakingMessageId(null);
        setIsPaused(false);
        setPreemptPromptId(null);
        if (!isMobile) {
          await stopSession(sessionId);
          await unregister(sessionId);
        }
        return;
      }

      // Preempt policy: on user-initiated taps, always elevate TTS priority to take over YouTube
      let priority = 1; // default
      const youtubeActive = (activeSourceRef.current === 'youtube') || (currentSession?.source === 'youtube');
      if (userInitiated || forcePreempt || youtubeActive) {
        priority = 3; // take control from YouTube reliably
      }

      // Unlock audio context on iOS
      await unlockAudio();

      // Stop any current playback
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch {}
        try { audioRef.current.currentTime = 0; } catch {}
        try { window.dispatchEvent(new Event('wakti-tts-stopped')); } catch {}
      }
      setSpeakingMessageId(messageId);
      setIsPaused(false);
      // Start showing spinner immediately for better feedback
      setFetchingIds(prev => { const n = new Set(prev); n.add(messageId); return n; });

      // Check persisted cache next
      const persisted = getPersisted(messageId);
      if (persisted?.b64) {
        console.log('[TTS] using persisted cache', { id: messageId });
        const url = base64ToBlobUrl(persisted.b64);
        const a = new Audio();
        try { a.muted = false; a.volume = 1; } catch {}
        audioRef.current = a;
        if (!isMobile) {
          register(sessionId, 'tts', a, priority);
          const granted = await requestPlayback(sessionId);
          if (granted) { try { window.dispatchEvent(new Event('wakti-tts-playing')); } catch {} }
          if (!granted) {
            console.log('[TTS] Playback denied (higher-priority source is active). Enable Preempt in Talk Back to allow pausing YouTube.');
            try { URL.revokeObjectURL(url); } catch {}
            setSpeakingMessageId(null);
            setIsPaused(false);
            await unregister(sessionId);
            return;
          }
        }
        // set src only after granted to avoid blob 404s
        a.src = url;
        a.onended = () => { 
          setSpeakingMessageId(null); 
          setIsPaused(false); 
          triggerFadeOut(messageId); 
          if (!isMobile) { stopSession(sessionId); unregister(sessionId); }
          try { URL.revokeObjectURL(url); } catch {} 
        };
        a.onerror = () => { 
          setSpeakingMessageId(null); 
          setIsPaused(false); 
          triggerFadeOut(messageId); 
          if (!isMobile) { stopSession(sessionId); unregister(sessionId); }
          try { URL.revokeObjectURL(url); } catch {} 
        };
        a.onplay = () => { setIsPaused(false); };
        a.onpause = () => {
          setIsPaused(true);
          if (!isMobile) {
            // Safety: release session if paused so other audio (e.g., YouTube) can play
            try { stopSession(sessionId); unregister(sessionId); } catch {}
          }
        };
        try { await a.play(); } catch (e) {
          console.error('[TTS] play() failed from persisted', e);
          // Cleanup: release session and reset UI so other audio (e.g., YouTube) can request playback
          if (!isMobile) {
            try { stopSession(sessionId); unregister(sessionId); } catch {}
          }
          try { URL.revokeObjectURL(url); } catch {}
          setSpeakingMessageId(null);
          setIsPaused(false);
        }
        // Clear spinner if we used cache
        setFetchingIds(prev => { const n = new Set(prev); n.delete(messageId); return n; });
        return;
      }

      console.log('[TTS] fetching from edge function');

      // Determine voice_id from TalkBack settings
      const isArabicText = /[\u0600-\u06FF]/.test(cleanText);
      const { ar, en } = getSelectedVoices();
      const voice_id = (isArabicText || language === 'ar') ? ar : en;

      // Auth + endpoint
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;

      // Guard: if URL missing, fail fast with clear UI and logs
      if (!supabaseUrl || typeof supabaseUrl !== 'string') {
        console.error('[TTS] Missing VITE_SUPABASE_URL env. Cannot call voice-tts function.');
        setSpeakingMessageId(null);
        setIsPaused(false);
        // Clear spinner
        setFetchingIds(prev => { const n = new Set(prev); n.delete(messageId); return n; });
        return;
      }

      const resp = await fetch(`${supabaseUrl}/functions/v1/voice-tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
        },
        mode: 'cors',
        body: JSON.stringify({ text: cleanText, voice_id, style: 'neutral' })
      });

      if (!resp.ok) {
        setSpeakingMessageId(null);
        setIsPaused(false);
        setFetchingIds(prev => { const n = new Set(prev); n.delete(messageId); return n; });
        try { console.error('[TTS] voice-tts failed', resp.status, await resp.text()); } catch {}
        return;
      }

      // Stream response for progress if possible
      const contentLength = Number(resp.headers.get('Content-Length') || 0);
      const reader = resp.body?.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;

      if (reader) {
        if (contentLength > 0) {
          // Update real percentage while reading
          setProgressMap(prev => { const n = new Map(prev); n.set(messageId, 0); return n; });
        } else {
          // Unknown size: simulate smooth progress 0→90% until complete
          const iv = window.setInterval(() => {
            setProgressMap(prev => {
              const n = new Map(prev);
              const curr = n.get(messageId) ?? 0;
              const next = Math.min(90, (curr || 0) + 2);
              n.set(messageId, next);
              return n;
            });
          }, 200);
          progressIntervalRef.current.set(messageId, iv);
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.length;
            if (contentLength > 0) {
              const pct = Math.max(1, Math.min(99, Math.floor((received / contentLength) * 100)));
              setProgressMap(prev => { const n = new Map(prev); n.set(messageId, pct); return n; });
            }
          }
        }
      }

      const full = chunks.length ? new Blob(chunks, { type: 'audio/mpeg' }) : await resp.blob();
      const buf = await full.arrayBuffer();
      const b64 = bufferToBase64(buf);
      setPersisted(messageId, b64, cleanText.length);
      const objectUrl = URL.createObjectURL(full);

      const audio = new Audio();
      try { audio.muted = false; audio.volume = 1; } catch {}
      audioRef.current = audio;
      if (!isMobile) {
        register(sessionId, 'tts', audio, priority);
        const granted2 = await requestPlayback(sessionId);
        if (!granted2) {
          console.log('[TTS] Playback denied (higher-priority source is active). Enable Preempt in Talk Back to allow pausing YouTube.');
          try { URL.revokeObjectURL(objectUrl); } catch {}
          setSpeakingMessageId(null);
          setIsPaused(false);
          await unregister(sessionId);
          return;
        }
      }
      // set src only after granted to avoid blob 404s
      audio.src = objectUrl;
      audio.onended = () => { 
        setSpeakingMessageId(null); 
        setIsPaused(false); 
        triggerFadeOut(messageId); 
        if (!isMobile) { stopSession(sessionId); unregister(sessionId); }
        try { URL.revokeObjectURL(objectUrl); } catch {} 
      };
      audio.onerror = () => { 
        setSpeakingMessageId(null); 
        setIsPaused(false); 
        triggerFadeOut(messageId); 
        if (!isMobile) { stopSession(sessionId); unregister(sessionId); }
        try { URL.revokeObjectURL(objectUrl); } catch {} 
      };
      audio.onplay = () => { setIsPaused(false); };
      audio.onpause = () => {
        setIsPaused(true);
        if (!isMobile) {
          // Safety: release session if paused so other audio (e.g., YouTube) can play
          try { stopSession(sessionId); unregister(sessionId); } catch {}
        }
      };
      console.log('[TTS] playing audio');
      try { await audio.play(); } catch (e) {
        console.error('[TTS] play() failed after fetch', e);
        // Cleanup: release session and reset UI so other audio (e.g., YouTube) can request playback
        if (!isMobile) {
          try { stopSession(sessionId); unregister(sessionId); } catch {}
        }
        try { URL.revokeObjectURL(objectUrl); } catch {}
        setSpeakingMessageId(null);
        setIsPaused(false);
      }
    } catch (err) {
      console.error('[TTS] Unexpected error while fetching/playing audio', err);
      setSpeakingMessageId(null);
      setIsPaused(false);
    } finally {
      setFetchingIds(prev => { const n = new Set(prev); n.delete(messageId); return n; });
      const iv = progressIntervalRef.current.get(messageId);
      if (iv) { window.clearInterval(iv); progressIntervalRef.current.delete(messageId); }
      setProgressMap(prev => { const n = new Map(prev); n.delete(messageId); return n; });
    }
  };

  // Manage prefetch timers (kept disabled)
  useEffect(() => {
    for (const [, t] of prefetchTimersRef.current) { clearTimeout(t); }
    prefetchTimersRef.current.clear();
  }, []);

  // Initialize Talk Back Auto Play state and listen for changes
  useEffect(() => {
    try {
      autoPlayRef.current = (localStorage.getItem('wakti_tts_autoplay') === '1');
    } catch {}
    const onAuto = (e: Event) => {
      const ce = e as CustomEvent<{ value: boolean }>;
      if (typeof ce?.detail?.value === 'boolean') autoPlayRef.current = ce.detail.value;
    };
    window.addEventListener('wakti-tts-autoplay-changed', onAuto as EventListener);
    return () => window.removeEventListener('wakti-tts-autoplay-changed', onAuto as EventListener);
  }, []);

  // Listen for preempt setting changes (Option C)
  useEffect(() => {
    try { preemptRef.current = (localStorage.getItem('wakti_tts_preempt') === '1'); } catch {}
    const onPreempt = (e: Event) => {
      const ce = e as CustomEvent<{ value: boolean }>;
      if (typeof ce?.detail?.value === 'boolean') preemptRef.current = ce.detail.value;
    };
    window.addEventListener('wakti-tts-preempt-changed', onPreempt as EventListener);
    return () => window.removeEventListener('wakti-tts-preempt-changed', onPreempt as EventListener);
  }, []);

  // Best-effort iOS audio unlock on first user interaction, persisted per session
  useEffect(() => {
    try {
      if (sessionStorage.getItem('wakti_tts_unlocked') === '1') {
        audioUnlockedRef.current = true;
      }
    } catch {}

    const unlock = async () => {
      if (audioUnlockedRef.current) return;
      try {
        const a = new Audio();
        // A very short silent data URI (tiny)
        a.src = 'data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
        await a.play().catch(() => {});
        a.pause();
        audioUnlockedRef.current = true;
        try { sessionStorage.setItem('wakti_tts_unlocked', '1'); } catch {}
        try { window.dispatchEvent(new Event('wakti-tts-unlocked')); } catch {}
      } catch {
        // Ignore; autoplay will gracefully fail on iOS until the user taps the speaker once
      }
      window.removeEventListener('touchend', unlock);
      window.removeEventListener('click', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true } as any);
    window.addEventListener('touchstart', unlock, { once: true, passive: true } as any);
    window.addEventListener('touchend', unlock, { once: true, passive: true } as any);
    window.addEventListener('click', unlock, { once: true } as any);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('touchend', unlock);
      window.removeEventListener('click', unlock);
    };
  }, []);

  // Attempt to auto-play the newest assistant reply when messages change
  useEffect(() => {
    try {
      if (!autoPlayRef.current) return;
      const last = sessionMessages[sessionMessages.length - 1];
      if (!last || last.role !== 'assistant') return;
      if (autoPlayedIdsRef.current.has(last.id)) return;
      // Avoid overlapping
      if (speakingMessageIdRef.current) return;

      // If audio is not yet unlocked (iOS), wait for unlock event once
      if (!audioUnlockedRef.current) {
        const onUnlock = () => {
          try {
            if (!autoPlayRef.current) return;
            const _last = sessionMessages[sessionMessages.length - 1];
            if (!_last || _last.role !== 'assistant') return;
            if (autoPlayedIdsRef.current.has(_last.id)) return;
            autoPlayedIdsRef.current.add(_last.id);
            const txt = _last.content || '';
            handleSpeak(txt, _last.id);
          } catch {}
        };
        window.addEventListener('wakti-tts-unlocked', onUnlock as EventListener, { once: true } as any);
        return;
      }

      // Mark to avoid repeats
      autoPlayedIdsRef.current.add(last.id);
      const text = last.content || '';
      // Debounce slightly to let DOM settle
      setTimeout(() => { handleSpeak(text, last.id); }, 150);
    } catch {}
  }, [sessionMessages]);

  // Remove ElevenLabs warmup; Google TTS via edge needs none
  useEffect(() => {}, []);

  // FIXED: Show welcome message for new conversations
  const renderWelcomeMessage = () => {
    if (!isNewConversation || sessionMessages.length > 0) return null;

    const userName = personalTouch?.nickname || userProfile?.display_name || (language === 'ar' ? 'صديقي' : 'friend');
    
    return (
      <div className="flex justify-start mb-6 group">
        <div className="flex gap-3 max-w-[80%]">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="rounded-lg px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 text-gray-900 border-2 relative dark:from-slate-800/70 dark:to-slate-900/70 dark:text-slate-100 dark:border-slate-700">
            {/* Mode Badge */}
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="px-2 py-1 text-xs font-medium leading-none whitespace-nowrap align-middle">
                💬 Welcome
              </Badge>
            </div>
            
            <div className="text-sm leading-relaxed">
              {language === 'ar' 
                 ? `مرحباً ${userName}! 👋 أنا وقتي AI، هنا لمساعدتك في كل ما تحتاجه.`
                : `Hey ${userName}! 👋 I'm Wakti AI your smart assistant. Ask me anything, from tasks and reminders to chats and ideas. What's on your mind today?`
              }
            </div>
            
            {/* Mini Buttons - Always Visible */}
            <div className="flex items-center justify-between mt-2">
              <div className="flex gap-1">
                {/* Copy Button */}
                <button
                  onClick={() => navigator.clipboard.writeText(language === 'ar' 
                     ? `مرحباً ${userName}! 👋 أنا وقتي AI، هنا لمساعدتك في كل ما تحتاجه.`
                     : `Hey ${userName}! 👋 I'm Wakti AI your smart assistant. Ask me anything, from tasks and reminders to chats and ideas. What's on your mind today?`
                  )}
                  className="p-2 rounded-md hover:bg-background/80 transition-colors"
                  title={language === 'ar' ? 'نسخ النص' : 'Copy text'}
                >
                  <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
                
                {/* TTS Button - No preloading, only on click */}
                <button
                  onClick={() => handleSpeak(language === 'ar' 
                    ? `مرحباً ${userName}! 👋 أنا وقتي AI، هنا لمساعدتك في كل ما تحتاجه.`
                    : `Hey ${userName}! 👋 I'm Wakti AI your smart assistant. Ask me anything, from tasks and reminders to chats and ideas. What's on your mind today?`, 'welcome', true
                  )}
                  className={`p-2 rounded-md transition-colors ${speakingMessageId === 'welcome' || fadeOutId === 'welcome' ? 'text-green-500 bg-green-500/10 shadow-[0_0_8px_rgba(34,197,94,0.7)]' : 'hover:bg-background/80'}`}
                  title={language === 'ar' ? 'تشغيل الصوت' : 'Play audio'}
                >
                  {fetchingIds.has('welcome') && typeof progressMap.get('welcome') === 'number' ? (
                    <span className="text-[10px] text-muted-foreground mr-1 align-middle">{progressMap.get('welcome')}%</span>
                  ) : null}
                  {speakingMessageId === 'welcome' ? (
                    <Volume2 className="h-4 w-4 animate-pulse" />
                  ) : fetchingIds.has('welcome') ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">{progressMap.get('welcome')}%</span>
                      <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                    </div>
                  ) : (
                    <Volume2 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  )}
                </button>
              </div>
              {speakingMessageId === 'welcome' && (
                <div className="ml-1 inline-flex items-center gap-1 bg-background/80 backdrop-blur px-1.5 py-0.5 rounded-md border border-border text-foreground/80 dark:bg-white/5 dark:border-white/10 dark:text-white/80">
                  <button onClick={onPauseResumeClick} className="p-0.5 hover:text-foreground" title={isPaused ? (language==='ar'?'تشغيل':'Play') : (language==='ar'?'إيقاف مؤقت':'Pause')}>
                    {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={onRewindClick} className="p-0.5 hover:text-foreground" title={language==='ar'?'إرجاع 5 ثوانٍ':'Rewind 5s'}>
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {preemptPromptId === 'welcome' && (
                <div className="inline-flex items-center gap-1 px-1 py-0 rounded-md border border-border/40 bg-background/60 text-[11px]">
                  <span className="text-foreground/80">{language === 'ar' ? 'إيقاف يوتيوب وتشغيل؟' : 'Pause YouTube and play?'}</span>
                  <button
                    onClick={() => {
                      setPreemptPromptId(null);
                      handleSpeak(
                        language === 'ar'
                          ? `مرحباً ${userName}! 👋 أنا وقتي AI، هنا لمساعدتك في كل ما تحتاجه.`
                          : `Hey ${userName}! 👋 I'm Wakti AI your smart assistant. Ask me anything, from tasks and reminders to chats and ideas. What's on your mind today?`,
                        'welcome',
                        true,
                        true
                      );
                    }}
                    className="inline-flex items-center justify-center h-5 w-5 rounded bg-amber-500/20 text-amber-700 hover:bg-amber-500/30"
                    aria-label={language === 'ar' ? 'تشغيل' : 'Play'}
                    title={language === 'ar' ? 'تشغيل' : 'Play'}
                  >
                    <Play className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setPreemptPromptId(null)}
                    className="px-1 py-0 rounded hover:bg-background/80 text-foreground/70"
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // FIXED: Determine badge based on message content and activeTrigger
  const getMessageBadge = (message: AIMessage, currentActiveTrigger: string) => {
    // Prefer saved intent for user messages to keep badge stable
    if (message.role === 'user') {
      if (message.intent) {
        switch (message.intent) {
          case 'search': {
            // If content indicates YouTube submode (prefixed by ChatInput)
            if (message.content?.trim().toLowerCase().startsWith('yt:')) return 'YouTube';
            return '🔍 Search';
          }
          case 'image': return '🎨 Image';
          case 'vision': return '👁️ Vision';
          case 'parse_task': return '🎯 Task';
          default: return '💬 Chat';
        }
      }

      // Fallback to content keyword detection or currentActiveTrigger
      const content = message.content.toLowerCase();
      if (content.includes('generate image') || content.includes('create image') || content.includes('make image') || content.includes('draw') || content.includes('paint')) {
        return '🎨 Image';
      }
      if (content.includes('search for') || content.includes('find information') || content.includes('look up') || content.includes('what is')) {
        return '🔍 Search';
      }
      if (message.attachedFiles && message.attachedFiles.length > 0) {
        return '👁️ Vision';
      }
      if (message.inputType === 'voice') {
        return '🎤 Voice';
      }
      if (currentActiveTrigger === 'image') return '🎨 Image';
      if (currentActiveTrigger === 'search') {
        if (message.content?.trim().toLowerCase().startsWith('yt:')) return 'YouTube';
        return '🔍 Search';
      }
      if (currentActiveTrigger === 'vision') return '👁️ Vision';
      return '💬 Chat';
    }

    // For assistant messages, use the saved intent or detect from content
    if (message.intent === 'vision') return '👁️ Vision';
    if (message.intent === 'search') {
      const yt = (message as any)?.metadata?.youtube;
      const ytErr = (message as any)?.metadata?.youtubeError;
      if (yt || ytErr) return 'YouTube';
      return '🔍 Search';
    }
    if (message.intent === 'image') return '🎨 Image';
    if (message.intent === 'parse_task') return '🎯 Task';

    const content = message.content.toLowerCase();
    if (content.includes('image generated') || content.includes('here is the image') || message.imageUrl) {
      return '🎨 Image';
    }
    if (content.includes('search results') || content.includes('found the following')) {
      const yt = (message as any)?.metadata?.youtube;
      const ytErr = (message as any)?.metadata?.youtubeError;
      return (yt || ytErr) ? 'YouTube' : '🔍 Search';
    }
    if (content.includes('analyzing the image') || content.includes('i can see')) {
      return '👁️ Vision';
    }

    return '💬 Chat';
  };

  // ENHANCED: Function to render message content with proper video display
  const renderMessageContent = (message: AIMessage) => {
    const content = message.content;
    const yt = (message as any)?.metadata?.youtube;
    const ytErr = (message as any)?.metadata?.youtubeError as string | undefined;

    // YouTube search result preview
    if (message.role === 'assistant' && yt && yt.videoId) {
      return (
        <YouTubePreview
          videoId={yt.videoId}
          title={yt.title}
          description={yt.description}
          thumbnail={yt.thumbnail}
        />
      );
    }

    // YouTube error states
    if (message.role === 'assistant' && ytErr) {
      const ar = language === 'ar';
      let text = '';
      switch (ytErr) {
        case 'quota':
          text = ar ? '💤 تم استهلاك حصة واجهة برمجة تطبيقات يوتيوب لهذا اليوم. حاول لاحقًا.' : '💤 YouTube API quota is exhausted for today. Please try again later.';
          break;
        case 'no_results':
          text = ar ? '🔎 لا توجد نتائج فيديو مطابقة لبحثك.' : '🔎 No YouTube results matched your query.';
          break;
        case 'network':
          text = ar ? '🌐 تعذر الوصول إلى بحث يوتيوب حالياً.' : '🌐 Unable to reach YouTube search right now.';
          break;
        case 'invalid':
        default:
          text = ar ? '⚠️ لم يتم العثور على نتائج صالحة.' : '⚠️ No valid results found.';
          break;
      }
      return <div className="text-sm text-muted-foreground">{text}</div>;
    }
    
    // FIXED: Check for generated images (Runware URLs) with modal functionality
    if (message.imageUrl || content.includes('https://im.runware.ai/')) {
      const imageUrl = message.imageUrl || content.match(/https:\/\/im\.runware\.ai\/[^\s\)]+/)?.[0];
      
      if (imageUrl) {
        // Extract prompt from content if available
        const promptMatch = content.match(/prompt:\s*(.+?)(?:\n|$)/i);
        const prompt = promptMatch ? promptMatch[1].trim() : undefined;
        
        return (
          <div className="space-y-3">
            {/* Show text content if any (excluding the URL) */}
            {content && !content.includes(imageUrl) && (
              <div className="whitespace-pre-wrap break-words">
                {content.replace(imageUrl, '').trim()}
              </div>
            )}
            
            {/* Display the actual image with click handler for modal */}
            <div className="relative">
              <img
                src={imageUrl}
                alt="Generated image"
                className="max-w-full h-auto rounded-lg border border-border/50 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setSelectedImage({ url: imageUrl, prompt })}
                onError={(e) => {
                  console.error('Image failed to load:', imageUrl);
                  e.currentTarget.style.display = 'none';
                }}
              />
              
              {/* Copy URL button overlay */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  (async () => {
                    try {
                      if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(imageUrl);
                      } else {
                        const ta = document.createElement('textarea');
                        ta.value = imageUrl;
                        ta.style.position = 'fixed';
                        ta.style.opacity = '0';
                        document.body.appendChild(ta);
                        ta.focus();
                        ta.select();
                        try { document.execCommand('copy'); } catch {}
                        document.body.removeChild(ta);
                      }
                    } catch (err) {
                      console.error('Copy image URL failed:', err);
                    }
                  })();
                }}
                className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-md transition-colors"
                title={language === 'ar' ? 'نسخ رابط الصورة' : 'Copy image URL'}
              >
                <ExternalLink className="h-3 w-3" />
              </button>
              
              {/* Save button overlay (small, below copy) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  (async () => {
                    try {
                      const resp = await fetch(imageUrl, { mode: 'cors' });
                      const blob = await resp.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'wakti-image.jpg';
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      setTimeout(() => URL.revokeObjectURL(url), 1200);
                    } catch (err) {
                      console.error('Save image failed:', err);
                    }
                  })();
                }}
                className="absolute top-10 right-2 px-2 py-1 bg-black/40 hover:bg-black/60 text-white rounded-md text-[10px] leading-none transition-colors"
                title={language === 'ar' ? 'حفظ الصورة' : 'Save image'}
              >
                {language === 'ar' ? 'حفظ' : 'Save'}
              </button>
            </div>
          </div>
        );
      }
    }
    // Render assistant content using ReactMarkdown (tables, code, images)
    if (message.role === 'assistant') {
      return (
        <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-pre:my-3 prose-table:my-3">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
              table: ({ node, ...props }) => (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm" {...props} />
                </div>
              ),
              th: ({ node, ...props }) => (
                <th className="border border-border px-2 py-1 bg-muted/40 text-left" {...props} />
              ),
              td: ({ node, ...props }) => (
                <td className="border border-border px-2 py-1 align-top" {...props} />
              ),
              code: (rawProps) => {
                const { className, children, ...props } = (rawProps as any);
                const isInline = !String(children).includes('\n');
                if (isInline) {
                  return <code className="px-1 py-[1px] rounded bg-muted/60" {...props}>{children}</code>;
                }
                return (
                  <pre className="bg-muted/40 p-3 rounded-md overflow-x-auto text-[13px]">
                    <code className={className} {...props}>{children}</code>
                  </pre>
                );
              },
              img: ({ node, ...props }) => (
                // Responsive images
                <img className="max-w-full h-auto rounded-md border" {...props} />
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      );
    }

    // Regular text for user messages
    return (
      <div className="whitespace-pre-wrap break-words">{content}</div>
    );
  };

  const getAssistantBubbleClasses = (message: AIMessage) => {
    switch (message.intent) {
      case 'search': {
        const yt = (message as any)?.metadata?.youtube;
        const ytErr = (message as any)?.metadata?.youtubeError;
        return (yt || ytErr) ? 'border-red-400' : 'border-green-400';
      }
      case 'image':
        return 'border-orange-400';
      case 'vision':
        return 'border-blue-300'; // keep vision as default
      case 'parse_task':
        return 'border-blue-300';
      default:
        return 'border-blue-300';
    }
  };

  // Mini-controls handlers
  const togglePauseResume = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      try { a.play(); setIsPaused(false); } catch {}
    } else {
      try { a.pause(); setIsPaused(true); } catch {}
    }
  };

  const rewind = (sec = 5) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, a.currentTime - sec);
  };

  // Click handlers that won't bubble to the parent button
  const onPauseResumeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    togglePauseResume();
  };
  const onRewindClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    rewind(5);
  };

  // Track active audio source via global session change events (more reliable than snapshot)
  useEffect(() => {
    const onChange = (e: Event) => {
      const ce = e as CustomEvent<{ activeSource: 'youtube'|'tts'|'voice-recording'|'other'|null }>; 
      activeSourceRef.current = (ce?.detail?.activeSource ?? null) as any;
    };
    window.addEventListener('wakti-audio-session-changed', onChange as EventListener);
    return () => window.removeEventListener('wakti-audio-session-changed', onChange as EventListener);
  }, []);

  return (
    <>
      <div className="px-4 pt-4 pb-0 space-y-4" style={{ ['--chat-input-height' as any]: `${inputHeight}px` }}>
        <div className="max-w-6xl mx-auto w-full px-2 space-y-4">
          {/* Welcome Message */}
          {renderWelcomeMessage()}
          
          {/* Chat Messages with FIXED badge logic and enhanced video display */}
          {sessionMessages.map((message, index) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} group`}>
                <div className="flex w-full min-w-0">
                  
                  <div className={`rounded-lg px-4 py-3 relative w-full min-h-24 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : `bg-gradient-to-r from-blue-50 to-purple-50 text-gray-900 border-2 ${getAssistantBubbleClasses(message)}`
                  }`}>
                    {/* FIXED: Mode Badge with proper logic */}
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="px-2 py-1 text-xs font-medium leading-none whitespace-nowrap align-middle">
                        {getMessageBadge(message, activeTrigger)}
                      </Badge>
                    </div>
                    
                    <div className={`text-sm leading-relaxed break-words ${message.role === 'user' ? (language === 'ar' ? 'text-right' : 'text-left') : 'text-left'}`}>
                      {(() => {
                        const isImageLoading = message.role === 'assistant' && message.intent === 'image' && (message as any)?.metadata?.loading;
                        const isVisionLoading = message.role === 'assistant' && message.intent === 'vision' && (message as any)?.metadata?.loading;
                        const stage = (message as any)?.metadata?.loadingStage as 'uploading'|'generating'|'saving'|undefined;
                        const hasImageUrl = !!(message as any)?.imageUrl;
                        if (isImageLoading) {
                          // Stage-specific rendering: uploading -> generating (skeleton), saving -> preview with blur+wipe
                          const label = stage === 'uploading'
                            ? (language === 'ar' ? 'جاري رفع الصورة...' : 'Uploading image...')
                            : stage === 'saving'
                              ? (language === 'ar' ? 'جارٍ حفظ الصورة...' : 'Saving image...')
                              : (language === 'ar' ? 'جارٍ توليد الصورة...' : 'Generating image...');

                          if (stage === 'saving' && hasImageUrl) {
                            return (
                              <div className="w-full">
                                <div className="relative overflow-hidden rounded-lg border border-border/50 shadow-sm max-w-xs">
                                  <img
                                    src={(message as any).imageUrl}
                                    alt="Generated image"
                                    className="max-w-full h-auto rounded-lg img-blur-reveal"
                                  />
                                  <div className="reveal-wipe" />
                                </div>
                                <div className="mt-2 text-xs text-muted-foreground">
                                  <span>{label}</span>
                                </div>
                              </div>
                            );
                          }

                          // Default skeleton for uploading/generating
                          return (
                            <div className="w-full">
                              {/* Skeleton image box with subtle blur */}
                              <div className="relative overflow-hidden rounded-lg border border-border/50 shadow-sm max-w-xs">
                                <div className="brush-skeleton" style={{ width: '100%', height: 256 }} />
                                <div className="absolute inset-0 pointer-events-none" />
                                <div className="absolute bottom-0 left-0 right-0 p-2">
                                  <div className="tiny-progress" />
                                </div>
                              </div>
                              <div className="mt-2 text-xs text-muted-foreground">
                                <span>{label}</span>
                              </div>
                            </div>
                          );
                        }
                        if (isVisionLoading) {
                          return (
                            <div className="w-full">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <span>{language === 'ar' ? 'جاري تحليل الصورة...' : 'Wakti Vision is analyzing...'}</span>
                                <span className="inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                  <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                  <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </span>
                              </div>
                            </div>
                          );
                        }
                        // Show thinking bubbles only when no content, no imageUrl, and not loading
                        if (message.role === 'assistant' && !message.content && !hasImageUrl && !(message as any)?.metadata?.loading) {
                          return (
                            <div className="flex items-center gap-2">
                              <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0s', animationDuration: '1.4s' }} />
                                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s', animationDuration: '1.4s' }} />
                                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s', animationDuration: '1.4s' }} />
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {activeTrigger === 'vision' ? 'Analyzing image...' : 'Thinking...'}
                              </span>
                            </div>
                          );
                        }
                        return renderMessageContent(message);
                      })()}
                    </div>
                    
                    
                    {/* Image Preview in Chat Messages */}
                    {message.attachedFiles && message.attachedFiles.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {message.attachedFiles.map((file, fileIndex) => (
                          <div key={fileIndex} className="relative">
                            <img
                              src={
                                file.url?.startsWith('data:')
                                  ? file.url
                                  : (file.url
                                      ? `data:${file.type || 'image/png'};base64,${file.url}`
                                      : (file.data?.startsWith?.('data:')
                                          ? file.data
                                          : (file.data
                                              ? `data:${file.type || 'image/png'};base64,${file.data}`
                                              : '')))
                              }
                               alt={file.name}
                               className="max-w-xs max-h-48 object-contain rounded-lg border border-border/50 cursor-pointer hover:opacity-90 transition-opacity"
                               onClick={() => setSelectedImage({ 
                                 url: file.url?.startsWith('data:') ? file.url : 
                                      file.url ? `data:${file.type || 'image/png'};base64,${file.url}` :
                                      file.data?.startsWith?.('data:') ? file.data :
                                      file.data ? `data:${file.type || 'image/png'};base64,${file.data}` : '',
                                 prompt: file.name 
                               })}
                             />
                            <div className="text-xs text-muted-foreground mt-1">
                              {file.imageType?.name || 'General'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Mini Buttons Bar - Hidden for YouTube assistant previews */}
                    {(() => {
                      const isAssistantYouTube = message.role === 'assistant' && ((message as any)?.metadata?.youtube || (message as any)?.metadata?.youtubeError);
                      if (isAssistantYouTube) return null;
                      return (
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex gap-1">
                            {/* Copy Button */}
                            <button
                              onClick={() => navigator.clipboard.writeText(message.content)}
                              className="p-2 rounded-md hover:bg-background/80 transition-colors"
                              title={language === 'ar' ? 'نسخ النص' : 'Copy text'}
                            >
                              <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                            </button>
                            
                            {/* TTS Button with Stop Functionality (assistant only) */}
                            {message.role === 'assistant' && (
                              <button
                                onTouchStart={() => handleSpeak(message.content, message.id, true)}
                                onClick={() => handleSpeak(message.content, message.id, true)}
                                style={{ touchAction: 'manipulation' }}
                                className={`p-2 rounded-md transition-colors ${speakingMessageId === message.id || fadeOutId === message.id ? 'text-green-500 bg-green-500/10 shadow-[0_0_8px_rgba(34,197,94,0.7)]' : 'hover:bg-background/80'}`}
                                title={speakingMessageId === message.id 
                                  ? (language === 'ar' ? 'إيقاف الصوت' : 'Stop audio')
                                  : (language === 'ar' ? 'تشغيل الصوت' : 'Play audio')
                                }
                              >
                                {fetchingIds.has(message.id) && typeof progressMap.get(message.id) === 'number' ? (
                                  <span className="text-[10px] text-muted-foreground mr-1 align-middle">{progressMap.get(message.id)}%</span>
                                ) : null}
                                {speakingMessageId === message.id ? (
                                  <Volume2 className="h-4 w-4 animate-pulse" />
                                ) : fetchingIds.has(message.id) ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-muted-foreground">{progressMap.get(message.id)}%</span>
                                    <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                                  </div>
                                ) : (
                                  <Volume2 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                )}
                              </button>
                            )}
                            
                            {/* Separate TTS Mini Controls - No nesting to fix mobile issues */}
                            {message.role === 'assistant' && speakingMessageId === message.id && (
                              <div className="inline-flex items-center gap-1 bg-background/80 backdrop-blur px-1.5 py-0.5 rounded-md border border-border ml-1">
                                <button 
                                  onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); togglePauseResume(); }}
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePauseResume(); }}
                                  style={{ touchAction: 'manipulation' }}
                                  className="p-0.5 hover:text-foreground" 
                                  title={isPaused ? (language==='ar'?'تشغيل':'Play') : (language==='ar'?'إيقاف مؤقت':'Pause')}
                                >
                                  {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                                </button>
                                <button 
                                  onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); rewind(5); }}
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); rewind(5); }}
                                  style={{ touchAction: 'manipulation' }}
                                  className="p-0.5 hover:text-foreground" 
                                  title={language==='ar'?'إرجاع 5 ثوانٍ':'Rewind 5s'}
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                          {message.role === 'assistant' && preemptPromptId === message.id && (
                            <div className="inline-flex items-center gap-1 px-1 py-0 rounded-md border border-border/40 bg-background/60 text-[11px]">
                              <span className="text-foreground/80">{language === 'ar' ? 'إيقاف يوتيوب وتشغيل؟' : 'Pause YouTube and play?'}</span>
                              <button
                                onClick={() => { setPreemptPromptId(null); handleSpeak(message.content, message.id, true, true); }}
                                className="inline-flex items-center justify-center h-5 w-5 rounded bg-amber-500/20 text-amber-700 hover:bg-amber-500/30"
                                aria-label={language === 'ar' ? 'تشغيل' : 'Play'}
                                title={language === 'ar' ? 'تشغيل' : 'Play'}
                              >
                                <Play className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setPreemptPromptId(null)}
                                className="px-1 py-0 rounded hover:bg-background/80 text-foreground/70"
                              >
                                {language === 'ar' ? 'إلغاء' : 'Cancel'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
           ))}
          
          
          {/* ENHANCED TASK CONFIRMATION DISPLAY WITH DEBUG LOGGING */}
          {showTaskConfirmation && (pendingTaskData || pendingReminderData) && (
            <div className="flex justify-center mb-8 mt-6">
              <TaskConfirmationCard
                type={pendingTaskData ? 'task' : 'reminder'}
                data={pendingTaskData || pendingReminderData}
                onConfirm={() => {
                  console.log('🎯 TASK CONFIRMATION: User confirmed', pendingTaskData || pendingReminderData);
                  if (pendingTaskData) {
                    onTaskConfirmation(pendingTaskData);
                  } else {
                    onReminderConfirmation(pendingReminderData);
                  }
                }}
                onCancel={() => {
                  console.log('❌ TASK CONFIRMATION: User cancelled');
                  onCancelTaskConfirmation();
                }}
                isLoading={taskConfirmationLoading}
              />
            </div>
          )}
          
          {/* End anchor for auto-scroll */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <ImageModal
          isOpen={!!selectedImage}
          onClose={() => setSelectedImage(null)}
          imageUrl={selectedImage.url}
          prompt={selectedImage.prompt}
        />
      )}
    </>
  );
}
