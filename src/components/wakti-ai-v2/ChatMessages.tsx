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
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  // Always-accurate ref mirror to avoid stale state in async guards
  const speakingMessageIdRef = useRef<string | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
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

  // ElevenLabs-backed TTS via Edge Function with stop/toggle and caching
  const handleSpeak = async (text: string, messageId: string) => {
    try {
      // Toggle off if already playing this message
      if (speakingMessageId === messageId) {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        setSpeakingMessageId(null);
        return;
      }

      // Stop any current playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setSpeakingMessageId(messageId);

      // Choose voice ID based on detected text language and user Talk Back settings
      const isArabicText = /[\u0600-\u06FF]/.test(text);
      const { ar, en } = getSelectedVoices();
      const voice_id = (isArabicText || language === 'ar') ? ar : en;
      const cacheKey = `${messageId}::${voice_id}`;

      // Use cached audio if available (in-memory first)
      const cachedUrl = audioCacheRef.current.get(cacheKey);
      if (cachedUrl) {
        // Simulated quick progress for cached audio: 1→4 then 100, then autoplay
        setFetchingIds(prev => new Set(prev).add(messageId));
        setProgressMap(prev => { const n = new Map(prev); n.set(messageId, 1); return n; });
        let step = 1;
        const iv = window.setInterval(() => {
          step = Math.min(4, step + 1);
          setProgressMap(prev => { const n = new Map(prev); n.set(messageId, step); return n; });
          if (step >= 4) {
            window.clearInterval(iv);
            progressIntervalRef.current.delete(messageId);
          }
        }, 120);
        progressIntervalRef.current.set(messageId, iv);

        const audio = new Audio(cachedUrl);
        audioRef.current = audio;
        audio.onended = () => { setSpeakingMessageId(null); setIsPaused(false); };
        audio.onerror = () => { setSpeakingMessageId(null); setIsPaused(false); };
        audio.onplay = () => setIsPaused(false);
        audio.onpause = () => setIsPaused(true);
        setTimeout(async () => {
          setProgressMap(prev => { const n = new Map(prev); n.set(messageId, 100); return n; });
          try {
            await audio.play();
          } finally {
            setFetchingIds(prev => { const n = new Set(prev); n.delete(messageId); return n; });
            const iv2 = progressIntervalRef.current.get(messageId);
            if (iv2) { window.clearInterval(iv2); progressIntervalRef.current.delete(messageId); }
            setProgressMap(prev => { const n = new Map(prev); n.delete(messageId); return n; });
          }
        }, 400);
        return;
      }

      // Check persistent cache in sessionStorage and verify it matches current text length
      const persisted = getPersisted(cacheKey);
      if (persisted && persisted.len >= text.length) {
        const objectUrl = base64ToBlobUrl(persisted.b64);
        audioCacheRef.current.set(cacheKey, objectUrl);
        // Quick simulated progress (1→4, then 100) and autoplay
        setFetchingIds(prev => new Set(prev).add(messageId));
        setProgressMap(prev => { const n = new Map(prev); n.set(messageId, 1); return n; });
        let step = 1;
        const iv = window.setInterval(() => {
          step = Math.min(4, step + 1);
          setProgressMap(prev => { const n = new Map(prev); n.set(messageId, step); return n; });
          if (step >= 4) {
            window.clearInterval(iv);
            progressIntervalRef.current.delete(messageId);
          }
        }, 120);
        progressIntervalRef.current.set(messageId, iv);

        const audio = new Audio(objectUrl);
        audioRef.current = audio;
        audio.onended = () => { setSpeakingMessageId(null); setIsPaused(false); };
        audio.onerror = () => { setSpeakingMessageId(null); setIsPaused(false); };
        audio.onplay = () => setIsPaused(false);
        audio.onpause = () => setIsPaused(true);
        setTimeout(async () => {
          setProgressMap(prev => { const n = new Map(prev); n.set(messageId, 100); return n; });
          try {
            await audio.play();
          } finally {
            setFetchingIds(prev => { const n = new Set(prev); n.delete(messageId); return n; });
            const iv2 = progressIntervalRef.current.get(messageId);
            if (iv2) { window.clearInterval(iv2); progressIntervalRef.current.delete(messageId); }
            setProgressMap(prev => { const n = new Map(prev); n.delete(messageId); return n; });
          }
        }, 400);
        return;
      }

      // Call existing Edge Function voice-tts with auth
      setFetchingIds(prev => new Set(prev).add(messageId));
      setProgressMap(prev => { const n = new Map(prev); n.set(messageId, 1); return n; });
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;

      const resp = await fetch(`${supabaseUrl}/functions/v1/voice-tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ text, voice_id, style: 'neutral' })
      });

      if (!resp.ok) {
        setSpeakingMessageId(null);
        // clear any progress interval if created
        const iv = progressIntervalRef.current.get(messageId);
        if (iv) { window.clearInterval(iv); progressIntervalRef.current.delete(messageId); }
        return;
      }

      // Stream the response to compute progress
      const contentLength = Number(resp.headers.get('content-length') || 0);
      const reader = resp.body?.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      // If content-length is unknown, show a short steady ramp 1→4, then snap to 100% when ready
      if (!contentLength) {
        let step = 1;
        setProgressMap(prev => { const n = new Map(prev); n.set(messageId, step); return n; });
        const iv = window.setInterval(() => {
          step = Math.min(4, step + 1);
          setProgressMap(prev => { const n = new Map(prev); n.set(messageId, step); return n; });
          if (step >= 4) {
            window.clearInterval(iv);
            progressIntervalRef.current.delete(messageId);
          }
        }, 650);
        progressIntervalRef.current.set(messageId, iv);
      }
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.byteLength;
            if (contentLength > 0) {
              const pct = Math.min(100, Math.max(1, Math.round((received / contentLength) * 100)));
              setProgressMap(prev => { const n = new Map(prev); n.set(messageId, pct); return n; });
            } else {
              // Unknown length: let the deterministic 1→4 interval drive the UI; no per-chunk nudge
            }
          }
        }
      }
      const blob = new Blob(chunks, { type: 'audio/mpeg' });
      const objectUrl = URL.createObjectURL(blob);
      audioCacheRef.current.set(cacheKey, objectUrl);
      // Persist small clips (<= 2.5MB) to sessionStorage as base64 for instant replay later
      if (blob.size <= 2.5 * 1024 * 1024) {
        try {
          const arrayBuf2 = await blob.arrayBuffer();
          const b64 = bufferToBase64(arrayBuf2);
          setPersisted(cacheKey, b64, text.length);
        } catch {}
      }

      const audio = new Audio(objectUrl);
      audioRef.current = audio;
      audio.onended = () => { setSpeakingMessageId(null); setIsPaused(false); };
      audio.onerror = () => { setSpeakingMessageId(null); setIsPaused(false); };
      audio.onplay = () => setIsPaused(false);
      audio.onpause = () => setIsPaused(true);
      // Snap to 100% now that audio is ready
      setProgressMap(prev => { const n = new Map(prev); n.set(messageId, 100); return n; });
      // Guard: user may have cancelled during loading; if so, do not auto-play
      if (speakingMessageIdRef.current !== messageId) {
        try { URL.revokeObjectURL(objectUrl); } catch {}
        audioCacheRef.current.delete(cacheKey);
        return;
      }
      // Attempt autoplay; if the first attempt is blocked or not ready, retry once shortly after
      try {
        await audio.play();
      } catch (err) {
        try {
          await new Promise(res => setTimeout(res, 300));
          await audio.play();
        } catch (err2) {
          // If autoplay still fails, keep UI state so the user can press play using the mini controls
          setIsPaused(true);
        }
      }
    } catch (e) {
      setSpeakingMessageId(null);
    } finally {
      setFetchingIds(prev => { const n = new Set(prev); n.delete(messageId); return n; });
      // clear fallback interval if any
      const iv = progressIntervalRef.current.get(messageId);
      if (iv) { window.clearInterval(iv); progressIntervalRef.current.delete(messageId); }
      setProgressMap(prev => { const n = new Map(prev); n.delete(messageId); return n; });
    }
  };

  // Disable auto TTS/prefetch entirely; audio will be fetched only when user clicks the speaker button
  useEffect(() => {
    for (const [, t] of prefetchTimersRef.current) { clearTimeout(t); }
    prefetchTimersRef.current.clear();
  }, [sessionMessages]);

  // Cleanup cached object URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      for (const url of audioCacheRef.current.values()) {
        try { URL.revokeObjectURL(url); } catch {}
      }
      audioCacheRef.current.clear();
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch {}
      }
    };
  }, []);

  // Client warmup on mount (zero-cost)
  useEffect(() => {
    const warmup = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
      try {
        await fetch(`${supabaseUrl}/functions/v1/voice-tts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ mode: 'warmup' })
        });
      } catch { /* ignore warmup errors */ }
    };
    warmup();
  }, []);

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
          <div className="rounded-lg px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 text-gray-900 border relative dark:from-slate-800/70 dark:to-slate-900/70 dark:text-slate-100 dark:border-slate-700">
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
                    : `Hey ${userName}! 👋 I'm Wakti AI your smart assistant. Ask me anything, from tasks and reminders to chats and ideas. What's on your mind today?`, 'welcome'
                  )}
                  className={`p-2 rounded-md transition-colors ${speakingMessageId === 'welcome' ? 'text-green-500 bg-green-500/10 shadow-[0_0_8px_rgba(34,197,94,0.7)]' : 'hover:bg-background/80'}`}
                  title={language === 'ar' ? 'تشغيل الصوت' : 'Play audio'}
                >
                  {fetchingIds.has('welcome') && typeof progressMap.get('welcome') === 'number' ? (
                    <span className="text-[10px] text-muted-foreground mr-1 align-middle">{progressMap.get('welcome')}%</span>
                  ) : null}
                  {speakingMessageId === 'welcome' ? (
                    <Volume2 className="h-4 w-4 animate-pulse" />
                  ) : fetchingIds.has('welcome') ? (
                    <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
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
                  navigator.clipboard.writeText(imageUrl);
                  // Could add a toast here if needed
                }}
                className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-md transition-colors"
                title={language === 'ar' ? 'نسخ رابط الصورة' : 'Copy image URL'}
              >
                <ExternalLink className="h-3 w-3" />
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
      a.play();
    } else {
      a.pause();
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

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-[calc(var(--chat-input-height,80px)+16px)]">
        <div className="max-w-6xl mx-auto w-full px-2">
          {/* Welcome Message */}
          {renderWelcomeMessage()}
          
          {/* Chat Messages with FIXED badge logic and enhanced video display */}
          {sessionMessages.map((message, index) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4 group`}>
                <div className="flex gap-3 max-w-[98%] w-full justify-end min-w-0">
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0">
                      <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                        <Bot className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                  )}
                  
                  <div className={`rounded-lg px-4 py-3 relative w-full min-h-24 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : `bg-gradient-to-r from-blue-50 to-purple-50 text-gray-900 border ${getAssistantBubbleClasses(message)}`
                  }`}>
                    {/* FIXED: Mode Badge with proper logic */}
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="px-2 py-1 text-xs font-medium leading-none whitespace-nowrap align-middle">
                        {getMessageBadge(message, activeTrigger)}
                      </Badge>
                    </div>
                    
                    <div className={`text-sm leading-relaxed break-words ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                      {(() => {
                        const isImageLoading = message.role === 'assistant' && message.intent === 'image' && (message as any)?.metadata?.loading;
                        const isVisionLoading = message.role === 'assistant' && message.intent === 'vision' && (message as any)?.metadata?.loading;
                        if (isImageLoading) {
                          return (
                            <div className="w-full">
                              {/* Skeleton image box with subtle blur */}
                              <div className="relative overflow-hidden rounded-lg border border-border/50 shadow-sm max-w-xs">
                                <div className="brush-skeleton" style={{ width: '100%', height: 256 }} />
                                {/* subtle overlay, no heavy blur to keep it light */}
                                <div className="absolute inset-0 pointer-events-none" />
                                {/* tiny progress bar pinned to bottom */}
                                <div className="absolute bottom-0 left-0 right-0 p-2">
                                  <div className="tiny-progress" />
                                </div>
                              </div>
                              <div className="mt-2 text-xs text-muted-foreground">
                                <span>{language === 'ar' ? 'جارٍ توليد الصورة...' : 'Generating image...'}</span>
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
                        if (message.role === 'assistant' && !message.content) {
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
                                onClick={() => handleSpeak(message.content, message.id)}
                                className="p-2 rounded-md hover:bg-background/80 transition-colors"
                                title={speakingMessageId === message.id 
                                  ? (language === 'ar' ? 'إيقاف الصوت' : 'Stop audio')
                                  : (language === 'ar' ? 'تشغيل الصوت' : 'Play audio')
                                }
                              >
                                {fetchingIds.has(message.id) && typeof progressMap.get(message.id) === 'number' ? (
                                  <span className="text-[10px] text-muted-foreground mr-1 align-middle">{progressMap.get(message.id)}%</span>
                                ) : null}
                                <span className={`inline-flex items-center ${speakingMessageId === message.id ? 'text-green-500' : ''}`}>
                                  {speakingMessageId === message.id ? (
                                    <Volume2 className="h-4 w-4 animate-pulse" />
                                  ) : fetchingIds.has(message.id) ? (
                                    <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                                  ) : (
                                    <Volume2 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                  )}
                                </span>
                                {speakingMessageId === message.id && (
                                  <span className="ml-1 inline-flex items-center gap-1 bg-background/80 backdrop-blur px-1.5 py-0.5 rounded-md border border-border">
                                    <button onClick={onPauseResumeClick} className="p-0.5 hover:text-foreground" title={isPaused ? (language==='ar'?'تشغيل':'Play') : (language==='ar'?'إيقاف مؤقت':'Pause')}>
                                      {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                                    </button>
                                    <button onClick={onRewindClick} className="p-0.5 hover:text-foreground" title={language==='ar'?'إرجاع 5 ثوانٍ':'Rewind 5s'}>
                                      <RotateCcw className="h-3.5 w-3.5" />
                                    </button>
                                  </span>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  
                  {message.role === 'user' && (
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-primary-foreground" />
                      </div>
                    </div>
                  )}
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
