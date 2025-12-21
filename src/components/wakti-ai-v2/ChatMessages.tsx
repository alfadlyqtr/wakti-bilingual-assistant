import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { MessageSquare, Bot, User, Calendar, Clock, CheckCircle, Loader2, Volume2, Copy, VolumeX, ExternalLink, Play, Pause, RotateCcw, Globe } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { AIMessage } from '@/services/WaktiAIV2Service';
import { TaskConfirmationCard } from './TaskConfirmationCard';
import { EditableTaskConfirmationCard } from './EditableTaskConfirmationCard';

import { Badge } from '@/components/ui/badge';
import { ImageModal } from './ImageModal';
import { YouTubePreview } from './YouTubePreview';
import { StudyModeMessage } from './StudyModeMessage';
import { SearchResultActions } from './SearchResultActions';
import { supabase } from '@/integrations/supabase/client';
import { getSelectedVoices } from './TalkBackSettings';
import { useNavigate } from 'react-router-dom';
// Removed useMobileKeyboard - no longer needed

type SearchSource = { url: string; title: string };

function normalizeGoogleMapsUrl(href: string, language: string): string {
  try {
    const u = new URL(href);
    const isGoogleMaps = /(^|\.)google\.[^/]+$/.test(u.hostname) || u.hostname === 'maps.google.com';
    if (!isGoogleMaps) return href;

    if (language === 'ar') {
      u.searchParams.set('hl', 'ar');
    }
    return u.toString();
  } catch {
    return href;
  }
}

function SearchMessageCard({
  message,
  language,
}: {
  message: AIMessage;
  language: string;
}) {
  const content = message.content || '';
  const geminiSearchMeta = (message as any)?.metadata?.geminiSearch;
  const sources: SearchSource[] = Array.isArray(geminiSearchMeta?.sources) ? geminiSearchMeta.sources : [];
  const query = (message as any)?.metadata?.searchQuery || '';

  return (
    <div className="w-full space-y-4">
      <div 
        className="search-result-content prose prose-sm sm:prose-base max-w-none dark:prose-invert" 
        dir="auto"
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            h2: ({ children }) => (
              <h2 className="text-base sm:text-lg font-bold mt-6 mb-2 text-foreground border-b border-border/40 pb-2">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-sm sm:text-base font-semibold mt-4 mb-2 text-foreground">
                {children}
              </h3>
            ),
            p: ({ children }) => (
              <p className="text-sm leading-relaxed text-muted-foreground mb-3">
                {children}
              </p>
            ),
            ul: ({ children }) => (
              <ul className="space-y-1.5 my-3 list-none pl-0">
                {children}
              </ul>
            ),
            li: ({ children }) => (
              <li className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>{children}</span>
              </li>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-foreground">{children}</strong>
            ),
            a: ({ href, children }) => {
              const normalizedHref = href ? normalizeGoogleMapsUrl(href, language) : href;
              const isGoogleMaps = normalizedHref && (
                normalizedHref.includes('google.com/maps') || 
                normalizedHref.includes('maps.google.com') || 
                normalizedHref.includes('goo.gl/maps')
              );
              
              if (isGoogleMaps) {
                return (
                  <a
                    href={normalizedHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium hover:underline"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                    <span>{children || (language === 'ar' ? 'خرائط جوجل' : 'Google Maps')}</span>
                  </a>
                );
              }
              
              return (
                <a
                  href={normalizedHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {children}
                </a>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>

      {sources.length > 0 && (
        <details className="rounded-xl border border-border/40 bg-muted/10 dark:bg-white/5 p-3">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            {language === 'ar' ? `المصادر (${sources.length})` : `Sources (${sources.length})`}
          </summary>
          <ul className="mt-3 space-y-2">
            {sources.slice(0, 10).map((s, idx) => (
              <li key={idx} className="flex items-start gap-2 min-w-0">
                <span className="text-muted-foreground text-xs mt-1">•</span>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-xs break-words"
                >
                  {s.title || s.url}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

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
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // No longer need keyboard detection in ChatMessages
  const [inputHeight, setInputHeight] = useState<number>(80);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const speakingMessageIdRef = useRef<string | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  // Transient visual state to keep the green glow briefly after audio ends
  const [fadeOutId, setFadeOutId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ url: string; prompt?: string } | null>(null);
  // Web Audio API for reliable cross-browser playback (Gemini TTS returns WAV)
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null); // Fallback for HTML5 audio
  const audioCacheRef = useRef<Map<string, string>>(new Map()); // cacheKey -> object URL
  const PERSIST_CACHE_PREFIX = 'wakti_tts_cache_'; // sessionStorage key prefix
  const [fetchingIds, setFetchingIds] = useState<Set<string>>(new Set()); // active network fetches for playback
  const [progressMap, setProgressMap] = useState<Map<string, number>>(new Map());
  const progressIntervalRef = useRef<Map<string, number>>(new Map());
  const audioUnlockedRef = useRef<boolean>(false);
  const [preemptPromptId, setPreemptPromptId] = useState<string | null>(null); // Keep for UI, though preempt logic is removed

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

  const logPlayFailure = (where: string, err: any, a: HTMLAudioElement) => {
    try {
      const mediaErr = (a as any)?.error;
      console.error('[TTS] play() failed', {
        where,
        name: err?.name,
        message: err?.message,
        code: mediaErr?.code,
        readyState: a?.readyState,
        networkState: a?.networkState,
        paused: a?.paused,
        ended: a?.ended,
        muted: a?.muted,
      });
    } catch {}
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
      // Remove markdown tables entirely (lines with pipes or header separators)
      t = t
        .split(/\n+/)
        .filter(line => {
          const trimmed = line.trim();
          if (/^\|.*\|$/.test(trimmed)) return false; // full table row
          if (/^[:\-\|\s]{3,}$/.test(trimmed)) return false; // header separator
          if (trimmed.includes('|')) return false; // any remaining pipe-heavy line
          return true;
        })
        .join('\n');
      // Remove list bullets like "- ", "* ", "• " at line starts
      t = t.replace(/^\s*[-*•]\s+/gm, '');
      // Remove excessive separators like ::: or ---
      t = t.replace(/[:]{1,}/g, ' ');
      t = t.replace(/-{3,}/g, ' ');
      // Replace any stray pipes with commas (safety)
      t = t.replace(/\|+/g, ', ');
      // Aggressively keep only letters/numbers/basic punctuation (including Arabic range)
      t = t.replace(/[^\p{L}\p{N}\s\.,!\?;:%\-\u0600-\u06FF]/gu, ' ');
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

  // Create the single, persistent audio element on mount
  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'auto';
      try { (audio as any).playsInline = true; } catch {}
      audioRef.current = audio;
    }
    // Cleanup on unmount
    return () => {
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch {}
        audioRef.current.src = '';
      }
    };
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sessionMessages, showTaskConfirmation]);

  // Keep scrolled to bottom when input height changes (maintain consistent gap)
  useEffect(() => {
    const handler = (e?: Event) => {
      // Update local CSS variable source of truth for reliability
      try {
        const ce = e as CustomEvent<{ height: number }>;
        if (ce?.detail?.height && Number.isFinite(ce.detail.height)) {
          setInputHeight(ce.detail.height);
        } else {
          // Use fixed height instead of CSS variable
          setInputHeight(80);
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
    // Use fixed height instead of CSS variable to avoid global pollution
    setInputHeight(80);
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

  // Cache-clearing logic removed as caching is now disabled for debugging.

  // Rewritten to use a single, persistent audio element for reliability on mobile.
  // Stop any currently playing audio (Web Audio API or HTML5)
  const stopCurrentAudio = () => {
    // Stop Web Audio API source
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
        audioSourceRef.current.disconnect();
      } catch {}
      audioSourceRef.current = null;
    }
    // Stop HTML5 audio fallback
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  // Initialize or get AudioContext (lazy init for mobile unlock)
  const getAudioContext = (): AudioContext => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  const handleSpeak = async (text: string, messageId: string) => {
    // If this message is already playing, toggle pause/stop
    if (speakingMessageId === messageId) {
      // Web Audio API doesn't support pause, so we stop instead
      stopCurrentAudio();
      setSpeakingMessageId(null);
      setIsPaused(false);
      return;
    }

    // Stop any other message that is currently playing
    stopCurrentAudio();

    let cleanText = sanitizeForTTS(text);
    if (!cleanText || cleanText.length < 3) {
      try {
        // Fallback: keep content but neutralize tables/pipes and markdown
        let alt = text || '';
        alt = alt.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
        alt = alt.replace(/`{1,3}[^`]*`{1,3}/g, ' ');
        alt = alt.replace(/`/g, ' ');
        alt = alt
          .split(/\n+/)
          .filter(line => !/^[:\-\|\s]{3,}$/.test(line.trim()))
          .join(' ');
        alt = alt.replace(/\|+/g, ', ').replace(/\s{2,}/g, ' ').trim();
        cleanText = alt.slice(0, 1000);
      } catch {}
    }
    if (!cleanText || cleanText.length < 3) {
      console.warn('[TTS] Skipping: no readable text after sanitization');
      return;
    }

    // --- Mobile Unlock (AudioContext) ---
    // Resume AudioContext on first user gesture
    if (!audioUnlockedRef.current) {
      try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        audioUnlockedRef.current = true;
        console.log('[TTS] AudioContext unlocked.');
      } catch (err) {
        console.warn('[TTS] AudioContext unlock failed, continuing...', err);
      }
    }

    // --- Playback with Web Audio API ---
    const playWithWebAudio = async (arrayBuffer: ArrayBuffer, contentType: string) => {
      try {
        const ctx = getAudioContext();
        
        // Resume if suspended (mobile browsers)
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        // Decode the audio data
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0)); // slice to avoid detached buffer
        
        // Create and configure source node
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        
        // Store reference for stopping
        audioSourceRef.current = source;
        
        // Set up event handlers
        source.onended = () => {
          setSpeakingMessageId(null);
          setIsPaused(false);
          triggerFadeOut(messageId);
          audioSourceRef.current = null;
        };

        // Start playback
        source.start(0);
        setSpeakingMessageId(messageId);
        setIsPaused(false);
        
        console.debug('[TTS] Web Audio playback started', {
          duration: audioBuffer.duration,
          sampleRate: audioBuffer.sampleRate,
          channels: audioBuffer.numberOfChannels,
          contentType,
        });
        
        return true;
      } catch (err) {
        console.warn('[TTS] Web Audio decode failed, will try HTML5 fallback:', err);
        return false;
      }
    };

    // --- HTML5 Audio Fallback ---
    const playWithHTML5 = async (blob: Blob, contentType: string) => {
      const el = audioRef.current;
      if (!el) {
        console.error('[TTS] No HTML5 audio element available');
        return;
      }

      setSpeakingMessageId(messageId);
      setIsPaused(false);

      try {
        el.muted = false;
        el.volume = 1.0;
        el.preload = 'auto';
      } catch {}

      // iOS prefers data URLs
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || ((navigator.platform === 'MacIntel') && (navigator.maxTouchPoints > 1));
      let audioUrl: string;
      
      if (isIOS) {
        try {
          const buf = await blob.arrayBuffer();
          const b64 = bufferToBase64(buf);
          audioUrl = `data:${contentType || 'audio/wav'};base64,${b64}`;
        } catch {
          audioUrl = URL.createObjectURL(blob);
        }
      } else {
        audioUrl = URL.createObjectURL(blob);
      }

      el.src = audioUrl;
      try { el.load(); } catch {}

      el.onended = () => {
        setSpeakingMessageId(null);
        setIsPaused(false);
        triggerFadeOut(messageId);
      };
      el.onerror = (e) => {
        console.error('[TTS] HTML5 Audio playback error:', e);
        setSpeakingMessageId(null);
        setIsPaused(false);
      };

      try {
        await el.play();
        console.debug('[TTS] HTML5 Audio playback started');
      } catch (err) {
        console.error('[TTS] HTML5 play() rejected:', err);
        setSpeakingMessageId(null);
        setIsPaused(false);
      }
    };

    // --- Fetch and Play ---
    setFetchingIds(prev => {
      const next = new Set(prev);
      next.add(messageId);
      return next;
    });

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;

      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL is not defined.');
      }

      // Detect language for voice selection
      const isArabicText = /[\u0600-\u06FF]/.test(cleanText);
      const { ar, en } = getSelectedVoices();
      const voice_id = (isArabicText || language === 'ar') ? ar : en;
      
      // Determine gender from voice_id for Gemini TTS
      const gender = voice_id.toLowerCase().includes('zephyr') || 
                     voice_id.toLowerCase().includes('vindemiatrix') ||
                     voice_id.toLowerCase().includes('female') ? 'female' : 'male';

      const response = await fetch(`${supabaseUrl}/functions/v1/voice-tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'audio/wav, audio/mpeg, audio/*',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ text: cleanText, voice_id, gender }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`TTS service failed: ${response.status} ${errorText}`);
      }

      const contentType = response.headers.get('content-type') || 'audio/wav';
      const ttsProvider = response.headers.get('x-tts-provider') || 'unknown';
      const ttsVoice = response.headers.get('x-tts-voice') || 'unknown';
      
      console.debug('[TTS] Response received', { contentType, ttsProvider, ttsVoice });

      const arrayBuffer = await response.arrayBuffer();
      
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        console.error('[TTS] Empty audio received. Aborting playback.');
        setSpeakingMessageId(null);
        return;
      }

      console.debug('[TTS] Audio data received', { size: arrayBuffer.byteLength, contentType });

      // Try Web Audio API first (handles WAV from Gemini TTS)
      const webAudioSuccess = await playWithWebAudio(arrayBuffer, contentType);
      
      if (!webAudioSuccess) {
        // Fallback to HTML5 Audio
        const blob = new Blob([arrayBuffer], { type: contentType });
        await playWithHTML5(blob, contentType);
      }

    } catch (err) {
      console.error('[TTS] Failed to fetch or play audio:', err);
      setSpeakingMessageId(null);
    } finally {
      setFetchingIds(prev => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  };

  // All old auto-play, pre-emption, and complex unlock logic is removed.
  // A single, persistent audio element is now used, matching the reliable pattern from AIInsights.

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
                : `Hey ${userName}! 👋 I’m Wakti AI, your smart assistant. Ask me anything from quick questions and planning ideas to deeper conversations. What’s on your mind today?`
              }
            </div>
            
            {/* Mini Buttons - Always Visible */}
            <div className="flex items-center justify-between mt-2">
              <div className="flex gap-1">
                {/* Copy Button */}
                <button
                  onClick={() => navigator.clipboard.writeText(language === 'ar' 
                     ? `مرحباً ${userName}! 👋 أنا وقتي AI، هنا لمساعدتك في كل ما تحتاجه.`
                     : `Hey ${userName}! 👋 I’m Wakti AI, your smart assistant. Ask me anything from quick questions and planning ideas to deeper conversations. What’s on your mind today?`
                  )}
                  className="p-2 rounded-md hover:bg-background/80 transition-colors"
                  title={language === 'ar' ? 'نسخ النص' : 'Copy text'}
                >
                  <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
                
                {/* TTS Button - No preloading, only on click */}
                <button
                  onPointerUp={() => handleSpeak(language === 'ar' 
                    ? `مرحباً ${userName}! 👋 أنا وقتي AI، هنا لمساعدتك في كل ما تحتاجه.`
                    : `Hey ${userName}! 👋 I’m Wakti AI, your smart assistant. Ask me anything from quick questions and planning ideas to deeper conversations. What’s on your mind today?`, 'welcome'
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
                  <button
                    onPointerUp={(e) => { e.preventDefault(); e.stopPropagation(); togglePauseResume(); }}
                    className="p-0.5 hover:text-foreground"
                    title={isPaused ? (language==='ar'?'تشغيل':'Play') : (language==='ar'?'إيقاف مؤقت':'Pause')}
                  >
                    {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onPointerUp={(e) => { e.preventDefault(); e.stopPropagation(); rewind(5); }}
                    className="p-0.5 hover:text-foreground"
                    title={language==='ar'?'إرجاع 5 ثوانٍ':'Rewind 5s'}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {preemptPromptId === 'welcome' && (
                <div className="inline-flex items-center gap-1 px-1 py-0 rounded-md border border-border/40 bg-background/60 text-[11px]">
                  <span className="text-foreground/80">{language === 'ar' ? 'إيقاف يوتيوب وتشغيل؟' : 'Pause YouTube and play?'}</span>
                  <button
                    onPointerUp={() => {
                      setPreemptPromptId(null);
                      handleSpeak(
                        language === 'ar'
                          ? `مرحباً ${userName}! 👋 أنا وقتي AI، هنا لمساعدتك في كل ما تحتاجه.`
                          : `Hey ${userName}! 👋 I’m Wakti AI, your smart assistant. Ask me anything from quick questions and planning ideas to deeper conversations. What’s on your mind today?`,
                        'welcome'
                      );
                    }}
                    className="inline-flex items-center justify-center h-5 w-5 rounded bg-amber-500/20 text-amber-700 hover:bg-amber-500/30"
                    aria-label={language === 'ar' ? 'تشغيل' : 'Play'}
                    title={language === 'ar' ? 'تشغيل' : 'Play'}
                  >
                    <Play className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onPointerUp={() => setPreemptPromptId(null)}
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
      // Check intent FIRST - if user explicitly switched modes, respect that
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
          case 'talk': return '🎙️ Talk'; // Talk mode messages
          case 'chat': {
            // Only show Study badge when intent is 'chat' AND chatSubmode is 'study'
            if ((message as any)?.chatSubmode === 'study') return '📚 Study';
            return '💬 Chat';
          }
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
    // Check for Study mode first (either via studyMode flag or Wolfram metadata)
    const studyModeFlag = (message as any)?.metadata?.studyMode;
    const wolframMeta = (message as any)?.metadata?.wolfram;
    if (studyModeFlag || wolframMeta?.mode === 'study') return '📚 Study';
    
    if (message.intent === 'vision') return '👁️ Vision';
    if (message.intent === 'search') {
      const yt = (message as any)?.metadata?.youtube;
      const ytErr = (message as any)?.metadata?.youtubeError;
      const ytLoading = (message as any)?.metadata?.youtubeLoading;
      if (yt || ytErr || ytLoading) return 'YouTube';
      return '🔍 Search';
    }
    if (message.intent === 'image') return '🎨 Image';
    if (message.intent === 'talk') return '🎙️ Talk'; // Talk mode assistant messages
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
    const searchMeta = (message as any)?.metadata?.search;
    const geminiSearchMeta = (message as any)?.metadata?.geminiSearch;

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
            
            {/* Display the actual image with blur-to-sharp reveal */}
            <div className="relative w-full md:max-w-[720px] lg:max-w-[900px]">
              <img
                src={imageUrl}
                alt="Generated image"
                className="w-full h-auto max-h-[70vh] object-contain rounded-lg border border-border/50 cursor-pointer hover:opacity-90 transition-opacity transition-[filter] duration-300 image-reveal-start"
                onLoad={(e) => { try { e.currentTarget.classList.remove('image-reveal-start'); e.currentTarget.classList.add('image-reveal-done'); e.currentTarget.style.filter = 'none'; } catch {} }}
                onClick={() => setSelectedImage({ url: imageUrl, prompt })}
                onError={(e) => {
                  console.error('Image failed to load:', imageUrl);
                  e.currentTarget.style.display = 'none';
                }}
                style={{ filter: 'blur(8px) saturate(0.95) brightness(1.02)' }}
              />
              {/* Grain overlay fades out on load */}
              <div
                className="pointer-events-none absolute inset-0 transition-opacity duration-300"
                style={{
                  backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.05) 0, rgba(0,0,0,0.05) 1px, transparent 1px, transparent 3px)',
                  opacity: 0.35
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
      // Search: render the dedicated mobile-first Search UI
      if (message.intent === 'search') {
        return <SearchMessageCard message={message} language={language} />;
      }

      // Vision JSON renderer (Option B): render structured results if present
      const vjson = (message as any)?.metadata?.visionJson || (message as any)?.metadata?.json;
      const isVision = message.intent === 'vision';
      const ar = language === 'ar';
      const normalized = (vjson && typeof vjson.normalized === 'object') ? vjson.normalized : null as any;
      const normPairs: Array<{ key: string, value: string }> = [];
      if (normalized?.id) {
        const id = normalized.id;
        const fields = [
          ['Name', id.name],
          ['Nationality', id.nationality],
          ['Document No.', id.document_no],
          ['Issuer', id.issuer],
          ['Issue Date', id.issue_date],
          ['Expiry Date', id.expiry_date],
        ];
        fields.forEach(([k, v]) => { if (v) normPairs.push({ key: k as string, value: String(v) }); });
      }
      if (normalized?.invoice) {
        const inv = normalized.invoice;
        const fields = [
          ['Vendor', inv.vendor],
          ['Address', inv.address],
          ['Date', inv.date],
          ['Currency', inv.currency],
          ['Subtotal', inv.subtotal],
          ['Tax', inv.tax],
          ['Total', inv.total],
        ];
        fields.forEach(([k, v]) => { if (v !== undefined && v !== null && String(v) !== '') normPairs.push({ key: k as string, value: String(v) }); });
      }
      if (normalized?.ticket) {
        const t = normalized.ticket;
        const fields = [
          ['Passenger', t.passenger],
          ['Number', t.number],
          ['Origin', t.origin],
          ['Destination', t.destination],
          ['Gate/Seat', t.gate_seat],
          ['Departure', t.departure_time],
          ['Arrival', t.arrival_time],
        ];
        fields.forEach(([k, v]) => { if (v) normPairs.push({ key: k as string, value: String(v) }); });
      }
      const keyValues = Array.isArray(vjson?.key_values) ? vjson.key_values : [];
      const kvsToShow = [...normPairs, ...keyValues];
      const hasKeyValues = kvsToShow.length > 0;
      const table0 = Array.isArray(vjson?.tables) && vjson.tables.length > 0 ? vjson.tables[0] : null as any;
      const ocrLines = Array.isArray(vjson?.ocr?.lines) ? vjson.ocr.lines : [];
      const showTable = !!table0 || (isVision && ocrLines.length > 0);

      const renderKeyValues = () => {
        if (!hasKeyValues) return null;
        return (
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {kvsToShow.slice(0, 60).map((kv: any, idx: number) => (
              <div key={idx} className="rounded-md border border-border/60 bg-white/70 dark:bg-black/20 px-2 py-1 text-xs">
                <div className="text-muted-foreground">{kv.key}</div>
                <div className="font-medium break-words">{kv.value}</div>
              </div>
            ))}
          </div>
        );
      };

      const renderTable = () => {
        let headers: string[] = [];
        let rows: string[][] = [];
        if (table0 && Array.isArray(table0.headers) && Array.isArray(table0.rows)) {
          headers = table0.headers as string[];
          rows = table0.rows as string[][];
        } else if (ocrLines && ocrLines.length > 0) {
          headers = ar ? ['السطر', 'النص'] : ['Line', 'Text'];
          rows = ocrLines.map((t: string, i: number) => [String(i + 1), t]);
        }
        if (headers.length === 0) return null;
        return (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className="border border-border px-2 py-1 bg-muted/40 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 300).map((r: string[], ri: number) => (
                  <tr key={ri}>
                    {r.map((c: string, ci: number) => (
                      <td key={ci} className="border border-border px-2 py-1 align-top whitespace-pre-wrap break-words">{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      };

      const renderOCRText = () => {
        const txt = (vjson?.ocr?.text || '') as string;
        if (!txt) return null;
        return (
          <details className="mt-2">
            <summary className="text-xs cursor-pointer text-muted-foreground">{ar ? 'النص المستخرج (فتح/إغلاق)' : 'Extracted text (toggle)'}
            </summary>
            <div className="mt-1 text-sm whitespace-pre-wrap break-words">{txt}</div>
          </details>
        );
      };

      const renderVisionStructured = () => {
        if (!isVision || !vjson) return null;
        const doCopyJSON = async () => {
          try { await navigator.clipboard.writeText(JSON.stringify(vjson, null, 2)); } catch {}
        };
        const doExportCSV = () => {
          let headers: string[] = [];
          let rows: string[][] = [];
          if (table0 && Array.isArray(table0.headers) && Array.isArray(table0.rows)) {
            headers = table0.headers as string[];
            rows = table0.rows as string[][];
          } else if (ocrLines && ocrLines.length > 0) {
            headers = ar ? ['السطر','النص'] : ['Line','Text'];
            rows = ocrLines.map((t: string, i: number) => [String(i + 1), t]);
          }
          if (headers.length === 0) return;
          const csv = [headers.join(',')].concat(rows.map(r => r.map(c => '"' + String(c).replace(/"/g,'""') + '"').join(','))).join('\n');
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = 'wakti-vision.csv'; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 1200);
        };
        return (
          <div className="mb-3">
            <div className="flex gap-2 mb-2">
              <button onClick={doCopyJSON} className="px-2 py-1 text-xs rounded-md border border-border hover:bg-muted/50">{ar ? 'نسخ JSON' : 'Copy JSON'}</button>
              <button onClick={doExportCSV} className="px-2 py-1 text-xs rounded-md border border-border hover:bg-muted/50">{ar ? 'تصدير CSV' : 'Export CSV'}</button>
            </div>
            {Array.isArray(vjson?.insights) && vjson.insights.length > 0 && (
              <div className="mb-2">
                <div className="text-xs font-semibold text-muted-foreground">{ar ? 'أهم الملاحظات' : 'Insights'}</div>
                <ul className="list-disc pl-5 text-sm">
                  {vjson.insights.slice(0, 8).map((s: string, i: number) => (
                    <li key={i} className="break-words">{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {Array.isArray(vjson?.validations) && vjson.validations.length > 0 && (
              <div className="mb-2">
                <div className="text-xs font-semibold text-muted-foreground">{ar ? 'التحقق والتنبيهات' : 'Validations'}</div>
                <div className="mt-1 space-y-1">
                  {vjson.validations.slice(0, 12).map((v: any, i: number) => (
                    <div key={i} className="text-xs">
                      <span className={`inline-block px-1 rounded mr-2 ${v.severity === 'error' ? 'bg-red-100 text-red-700' : v.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>{v.severity || 'info'}</span>
                      <span className="text-muted-foreground">{v.field ? `${v.field}: ` : ''}</span>
                      <span className="font-medium">{v.issue}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {hasKeyValues && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground">{ar ? 'الحقول الرئيسية' : 'Key Fields'}</div>
                {renderKeyValues()}
              </div>
            )}
            {showTable && (
              <div className="mt-2">
                <div className="text-xs font-semibold text-muted-foreground">{ar ? 'النص على شكل جدول' : 'Extracted Text (Table)'}</div>
                {renderTable()}
              </div>
            )}
            {renderOCRText()}
            {Array.isArray(vjson?.follow_ups) && vjson.follow_ups.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {vjson.follow_ups.slice(0, 6).map((q: string, i: number) => (
                  <button
                    key={i}
                    className="text-xs px-2 py-1 rounded-md border border-border hover:bg-muted/50 dark:hover:bg-white/10"
                    title={q}
                    onClick={() => {
                      try { window.dispatchEvent(new CustomEvent('wakti-chat-send', { detail: { text: q, intent: 'vision' } })); } catch {}
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      };

      // Check for Wolfram|Alpha metadata AND Study mode flag
      const wolframMeta = (message as any)?.metadata?.wolfram;
      const studyModeFlag = (message as any)?.metadata?.studyMode;
      const isStudyMode = studyModeFlag || wolframMeta?.mode === 'study';
      
      // For Study mode without Wolfram, extract the first sentence as the "answer"
      const extractStudyAnswer = (text: string): string => {
        if (!text) return '';
        // Try to find "Answer:" prefix first
        const answerMatch = text.match(/\*?\*?Answer:?\*?\*?\s*([^\n]+)/i);
        if (answerMatch) return answerMatch[1].trim();
        // Otherwise take first sentence (up to period, question mark, or newline)
        const firstSentence = text.split(/[.!?\n]/)[0];
        return firstSentence?.trim() || text.slice(0, 150);
      };

      return (
        <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-pre:my-3 prose-table:my-3">
          {/* Render Study Mode structured answer - from Wolfram OR extracted from response */}
          {isStudyMode && (wolframMeta?.answer || content) && (
            <StudyModeMessage
              answer={wolframMeta?.answer || extractStudyAnswer(content)}
              steps={wolframMeta?.steps}
              inputInterpretation={wolframMeta?.interpretation}
              language={language}
            />
          )}
          {/* Render Facts Booster badge if present (subtle indicator for chat mode) */}
          {wolframMeta && wolframMeta.answer && !isStudyMode && (
            <div className="mb-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-700/30 text-[10px] text-blue-600 dark:text-blue-400">
              <Globe className="h-3 w-3" />
              <span>{language === 'ar' ? 'حقيقة موثقة' : 'Verified fact'}</span>
            </div>
          )}
          {renderVisionStructured()}
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
              a: ({ node, href, children, ...props }) => {
                // Style Google Maps links with icon and color
                const normalizedHref = href ? normalizeGoogleMapsUrl(href, language) : href;
                const isGoogleMaps = normalizedHref && (normalizedHref.includes('google.com/maps') || normalizedHref.includes('maps.google.com') || normalizedHref.includes('goo.gl/maps'));
                // Style phone links
                const isPhone = normalizedHref && normalizedHref.startsWith('tel:');
                // Style email links
                const isEmail = normalizedHref && normalizedHref.startsWith('mailto:');
                
                if (isGoogleMaps) {
                  return (
                    <a
                      href={normalizedHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      dir="auto"
                      className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium hover:underline"
                      {...props}
                    >
                      <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                      </svg>
                      <span>{children || (language === 'ar' ? '🌍 موقع خرائط جوجل' : 'Google Maps Location')}</span>
                    </a>
                  );
                }
                
                if (isPhone) {
                  const phoneNumber = (normalizedHref || '').replace('tel:', '');
                  return (
                    <a
                      href={normalizedHref}
                      className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 font-medium hover:underline"
                      {...props}
                    >
                      <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                      </svg>
                      <span>{children || phoneNumber}</span>
                    </a>
                  );
                }
                
                if (isEmail) {
                  const emailAddress = (normalizedHref || '').replace('mailto:', '');
                  return (
                    <a
                      href={normalizedHref}
                      className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-medium hover:underline"
                      {...props}
                    >
                      <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                      </svg>
                      <span>{children || emailAddress}</span>
                    </a>
                  );
                }
                
                // Default link styling
                return (
                  <a
                    href={normalizedHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                    {...props}
                  >
                    {children}
                  </a>
                );
              },
            }}
          >
            {content}
          </ReactMarkdown>
          {(() => {
            const chip = (message as any)?.metadata?.helpGuideChip as { label?: string; route?: string } | undefined;
            if (!chip?.label || !chip?.route) return null;
            return (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate(chip.route as string)}
                  className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-medium rounded-full bg-gradient-to-r from-primary/90 to-primary text-primary-foreground shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-150"
                >
                  {chip.label}
                </button>
              </div>
            );
          })()}
          {message.intent === 'search' && Array.isArray(searchMeta?.followUps) && searchMeta.followUps.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {searchMeta.followUps.slice(0, 6).map((q: string, i: number) => (
                <button
                  key={i}
                  className="text-xs px-2 py-1 rounded-md border border-border hover:bg-muted/50 dark:hover:bg-white/10"
                  title={q}
                  onClick={() => {
                    try {
                      window.dispatchEvent(new CustomEvent('wakti-chat-send', { detail: { text: q, intent: 'search' } }));
                    } catch {}
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          {/* Gemini Search Sources (collapsible) */}
          {message.intent === 'search' && geminiSearchMeta?.sources && geminiSearchMeta.sources.length > 0 && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                {language === 'ar' ? `المصادر (${geminiSearchMeta.sources.length})` : `Sources (${geminiSearchMeta.sources.length})`}
              </summary>
              <ul className="mt-2 space-y-1 pl-2 border-l-2 border-border/50">
                {geminiSearchMeta.sources.slice(0, 10).map((src: { url: string; title: string }, idx: number) => (
                  <li key={idx} className="truncate">
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                      title={src.url}
                    >
                      {src.title || src.url}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      );
    }

    // Regular text for user messages
    return (
      <div className="whitespace-pre-wrap break-words">{content}</div>
    );
  };

  const getAssistantBubbleClasses = (message: AIMessage) => {
    // Check for Study mode first (via metadata flag or Wolfram mode)
    const studyModeFlag = (message as any)?.metadata?.studyMode;
    const wolframMeta = (message as any)?.metadata?.wolfram;
    if (studyModeFlag || wolframMeta?.mode === 'study') {
      return 'border-purple-400'; // Purple border for Study mode
    }
    
    switch (message.intent) {
      case 'search': {
        const yt = (message as any)?.metadata?.youtube;
        const ytErr = (message as any)?.metadata?.youtubeError;
        const ytLoading = (message as any)?.metadata?.youtubeLoading;
        return (yt || ytErr || ytLoading) ? 'border-red-400' : 'border-green-400';
      }
      case 'image':
        return 'border-orange-400';
      case 'vision':
        return 'border-cyan-400'; // Cyan/teal for Vision mode
      case 'talk':
        return 'border-pink-400'; // Pink border for Talk mode
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

  // Session manager removed: no global session change tracking needed

  return (
    <>
      <div className="px-2 sm:px-3 md:px-4 pt-4 pb-0 space-y-4 chat-messages-wrapper">
        <style>{`
          @keyframes waktiBrushMove { from { transform: translateX(-24px) rotate(8deg); } to { transform: translateX(calc(100% + 24px)) rotate(-8deg); } }
          .brush-anim { position: relative; width: 100%; height: 100%; background: repeating-linear-gradient(90deg, rgba(148,163,184,0.15) 0 10px, transparent 10px 20px); }
          .brush-icon { position: absolute; top: 50%; left: 0; transform: translateY(-50%); animation: waktiBrushMove 1.6s linear infinite; opacity: 0.95; font-size: 22px; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.35)); }
          @keyframes waktiBrushWiggle { 0% { transform: translateX(0) rotate(0deg); } 50% { transform: translateX(6px) rotate(12deg); } 100% { transform: translateX(0) rotate(0deg); } }
          .brush-inline { display: inline-block; animation: waktiBrushWiggle 900ms ease-in-out infinite; }
        `}</style>
        <div className="w-full px-0 space-y-4">
          {/* Welcome Message */}
          {renderWelcomeMessage()}
          
          {/* Chat Messages with FIXED badge logic and enhanced video display */}
          {sessionMessages.map((message, index) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} group`}>
                <div className="flex w-full min-w-0">
                  
                  <div className={`rounded-lg px-4 py-3 relative w-full min-h-24 ${
                    message.role === 'user'
                      ? ((message as any)?.metadata?.wolfram?.mode === 'study' || (message as any)?.chatSubmode === 'study'
                          ? 'bg-purple-500 text-white'
                          : 'bg-primary text-primary-foreground')
                      : `bg-gradient-to-r from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-900 text-gray-900 dark:text-gray-100 border-2 ${getAssistantBubbleClasses(message)}`
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
                            // Blur-to-sharp with grain reveal (300ms), no artificial delay
                            return (
                              <div className="w-full">
                                <div className="relative overflow-hidden rounded-lg border border-border/50 shadow-sm max-w-xs">
                                  <img
                                    src={(message as any).imageUrl}
                                    alt="Generated image"
                                    className="max-w-full h-auto rounded-lg transition-[filter] duration-300 image-reveal-start"
                                    onLoad={(e) => {
                                      try {
                                        e.currentTarget.classList.remove('image-reveal-start');
                                        e.currentTarget.classList.add('image-reveal-done');
                                      } catch {}
                                    }}
                                    style={{ filter: 'blur(8px) saturate(0.95) brightness(1.02)' }}
                                  />
                                  {/* Grain overlay fades out on load */}
                                  <div
                                    className="pointer-events-none absolute inset-0 transition-opacity duration-300"
                                    style={{
                                      backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.05) 0, rgba(0,0,0,0.05) 1px, transparent 1px, transparent 3px)',
                                      opacity: 0.35
                                    }}
                                  />
                                </div>
                                <div className="mt-2 text-xs text-muted-foreground">
                                  <span className="brush-inline mr-1" aria-hidden>🖌️</span>
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
                                <div className="absolute inset-0 brush-anim">
                                  <div className="brush-icon">🖌️</div>
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
                                <img
                                  src="/assets/wakti-eye-soft.svg"
                                  alt={language === 'ar' ? 'عين وقتي تومض' : 'Wakti eye blinking'}
                                  className="h-5 w-auto"
                                  loading="eager"
                                  decoding="sync"
                                  aria-hidden="true"
                                />
                              </div>
                            </div>
                          );
                        }
                        // Show search indicators while waiting for first tokens
                        const isSearchLoadingBase = message.role === 'assistant'
                          && message.intent === 'search'
                          && (message as any)?.metadata?.loading
                          && !message.content;
                        const isYouTubeLoading = isSearchLoadingBase && (message as any)?.metadata?.youtubeLoading;
                        if (isSearchLoadingBase && isYouTubeLoading) {
                          return (
                            <div className="w-full">
                              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                                <Play className="h-4 w-4 animate-spin" />
                                <span>{language === 'ar' ? 'وقتي يبحث في يوتيوب...' : 'Wakti AI is searching YouTube...'}</span>
                              </div>
                            </div>
                          );
                        }
                        if (isSearchLoadingBase) {
                          return (
                            <div className="w-full">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Globe className="h-4 w-4 animate-spin" />
                                <span>{language === 'ar' ? 'وقتي يبحث في الويب...' : 'Wakti AI is searching the web...'}</span>
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
                                onPointerUp={() => handleSpeak(message.content, message.id)}
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
                                  onPointerUp={(e) => { e.preventDefault(); e.stopPropagation(); togglePauseResume(); }}
                                  style={{ touchAction: 'manipulation' }}
                                  className="p-0.5 hover:text-foreground" 
                                  title={isPaused ? (language==='ar'?'تشغيل':'Play') : (language==='ar'?'إيقاف مؤقت':'Pause')}
                                >
                                  {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                                </button>
                                <button 
                                  onPointerUp={(e) => { e.preventDefault(); e.stopPropagation(); rewind(5); }}
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
                                onPointerUp={() => { setPreemptPromptId(null); handleSpeak(message.content, message.id); }}
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

      {/* Persistent hidden audio for mobile reliability */}
      <audio ref={audioRef} preload="auto" playsInline style={{ display: 'none' }} />

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
