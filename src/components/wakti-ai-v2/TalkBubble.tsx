import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Mic, Search, MessageCircle } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useUserProfile } from '@/hooks/useUserProfile';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_VOICES, getSelectedVoices } from './TalkBackSettings';
import { getNativeLocation } from '@/integrations/natively/locationBridge';

interface TalkBubbleProps {
  isOpen: boolean;
  onClose: () => void;
  onUserMessage: (text: string) => void;
  onAssistantMessage: (text: string, audioUrl?: string) => void;
}

const MAX_RECORD_SECONDS = 10; // 10 second limit
const NOISE_STRIKE_WINDOW_MS = 12000;
const NOISE_STRIKES_TO_GUARD = 3;
const NOISE_GUARD_MAX_MS = 45000;
const OPENAI_REALTIME_CALLS_URL = 'https://api.openai.com/v1/realtime/calls';
const OPENAI_REALTIME_CONNECT_TIMEOUT_MS = 18000;
const TALK_READY_FALLBACK_MS = 700;
const TALK_TURN_DETECTION_EAGERNESS = 'medium';
const TALK_DEFAULT_TRANSCRIPTION_MODEL: 'gpt-4o-transcribe' | 'gpt-realtime-whisper' = 'gpt-realtime-whisper';

type TalkLocation = {
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
};

type TalkTurn = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

/**
 * Clean transcript for better Tavily search results.
 * Removes common filler/command phrases while preserving the actual query.
 * Falls back to original if cleaned result is too short.
 */
function cleanSearchQuery(transcript: string): string {
  if (!transcript || transcript.trim().length === 0) {
    return transcript;
  }

  let cleaned = transcript.trim();

  // English filler phrases to remove (case-insensitive)
  const enPhrases = [
    /^(hey\s+)?wakti[,\s]*/i,
    /^(ok\s+)?google[,\s]*/i,
    /^(hey\s+)?siri[,\s]*/i,
    /\bcan you\b/gi,
    /\bcould you\b/gi,
    /\bplease\b/gi,
    /\bkindly\b/gi,
    /\bsearch\s+(for|the\s+web\s+for|online\s+for)\b/gi,
    /\bsearch\b/gi,
    /\blook\s+up\b/gi,
    /\bfind\s+(me|out)\b/gi,
    /\btell\s+me\s+about\b/gi,
    /\bwhat\s+is\b/gi,
    /\bwhat\s+are\b/gi,
    /\bi\s+want\s+to\s+know\b/gi,
    /\bi\s+need\s+to\s+know\b/gi,
  ];

  // Arabic filler phrases to remove
  const arPhrases = [
    /^(يا\s+)?واكتي[،,\s]*/,
    /\bممكن\b/g,
    /\bلو\s+سمحت\b/g,
    /\bمن\s+فضلك\b/g,
    /\bابحث\s+(عن|لي)\b/g,
    /\bابحث\b/g,
    /\bدور\s+(على|لي)\b/g,
    /\bدور\b/g,
    /\bأبي\b/g,
    /\bأبغى\b/g,
    /\bأريد\b/g,
    /\bقل\s+لي\b/g,
    /\bوش\s+هو\b/g,
    /\bما\s+هو\b/g,
    /\bشو\s+هو\b/g,
  ];

  // Apply all phrase removals
  [...enPhrases, ...arPhrases].forEach(pattern => {
    cleaned = cleaned.replace(pattern, ' ');
  });

  // Clean up extra spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Fallback: if cleaned is too short (< 3 chars), use original
  if (cleaned.length < 3) {
    console.log('[Talk] cleanSearchQuery: too short after cleanup, using original');
    return transcript.trim();
  }

  console.log('[Talk] cleanSearchQuery:', transcript, '→', cleaned);
  return cleaned;
}

function getOpenAIVoiceForGender(gender: 'male' | 'female'): 'cedar' | 'marin' {
  return gender === 'female' ? 'marin' : 'cedar';
}

function compactSingleLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function summarizeRealtimeConnectFailure(status: number, rawText: string): string {
  const compact = compactSingleLine(rawText);
  if (status === 504 || /gateway time-out|gateway timeout/i.test(compact)) {
    return 'OpenAI voice service timed out';
  }
  if (status === 429) {
    return 'OpenAI voice service is rate limited';
  }
  if (status >= 500) {
    return `OpenAI voice service returned ${status}`;
  }
  if (!compact) {
    return `OpenAI voice request failed (${status})`;
  }
  return compact.length > 220 ? `${compact.slice(0, 220)}…` : compact;
}

function extractErrorDetail(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const data = payload as { details?: unknown; error?: unknown; message?: unknown };
  if (typeof data.details === 'string' && data.details.trim()) {
    return data.details.trim();
  }
  if (typeof data.error === 'string' && data.error.trim()) {
    return data.error.trim();
  }
  if (typeof data.message === 'string' && data.message.trim()) {
    return data.message.trim();
  }
  return '';
}

async function readRealtimeErrorDetail(response: Response): Promise<string> {
  const rawText = await response.text();
  const trimmed = rawText.trim();

  if (trimmed) {
    try {
      const payload = JSON.parse(trimmed);
      const payloadDetail = extractErrorDetail(payload);
      if (payloadDetail) {
        return summarizeRealtimeConnectFailure(response.status, payloadDetail);
      }
    } catch {
      return summarizeRealtimeConnectFailure(response.status, trimmed);
    }

    return summarizeRealtimeConnectFailure(response.status, trimmed);
  }

  return summarizeRealtimeConnectFailure(response.status, '');
}

export function TalkBubble({ isOpen, onClose, onUserMessage, onAssistantMessage }: TalkBubbleProps) {
  const { language, theme } = useTheme();
  const { profile: _tbCachedProfile } = useUserProfile();
  const t = useCallback((en: string, ar: string) => (language === 'ar' ? ar : en), [language]);
  const tLang = useCallback((lang: 'ar' | 'en', en: string, ar: string) => (lang === 'ar' ? ar : en), []);
  const [isHolding, setIsHolding] = useState(false);
  const [countdown, setCountdown] = useState(MAX_RECORD_SECONDS);
  const [isConversationActive, setIsConversationActive] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [status, setStatus] = useState<'connecting' | 'ready' | 'listening' | 'processing' | 'speaking'>('ready');
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isConnectionReady, setIsConnectionReady] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('male');
  const [aiTranscript, setAiTranscript] = useState<string>('');
  const [conversationHistory, setConversationHistory] = useState<TalkTurn[]>([]);
  const [talkSummary, setTalkSummary] = useState<string>('');
  const [debugHint, setDebugHint] = useState<string>('');
  const [searchMode, setSearchMode] = useState(false); // One-turn search mode (auto-resets after use)
  const [isSearching, setIsSearching] = useState(false); // Currently fetching search results
  const [isNoiseGuardActive, setIsNoiseGuardActive] = useState(false);
  const [personalTouch, setPersonalTouch] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<TalkLocation | null>(null);

  // Use refs for values needed in callbacks to avoid stale closures
  const userNameRef = useRef<string>('');
  const voiceGenderRef = useRef<'male' | 'female'>('male');
  const userLocationRef = useRef<TalkLocation | null>(null);
  const conversationHistoryRef = useRef<TalkTurn[]>([]);
  const talkSummaryRef = useRef<string>('');
  const searchModeRef = useRef(false); // Ref for search mode to avoid stale closures
  const pendingTranscriptRef = useRef<string>(''); // Store transcript while waiting for search
  const detectedLanguageRef = useRef<'ar' | 'en'>(language === 'ar' ? 'ar' : 'en');
  const assistantTranscriptBufferRef = useRef('');
  const assistantMessageSyncedRef = useRef(false);
  const assistantResponseActiveRef = useRef(false);
  const lastAssistantTranscriptRef = useRef('');
  const lastAssistantFinishedAtRef = useRef(0);
  const liveTranscriptRef = useRef('');
  const aiTranscriptRef = useRef('');
  const assistantPlaybackLockUntilRef = useRef(0);
  const syncedTurnIdsRef = useRef<Set<string>>(new Set());
  const turnCounterRef = useRef(0);
  const pendingAutoStartAfterConnectRef = useRef(false);
  const startRecordingRef = useRef<(() => void) | null>(null);
  const transcriptionModelRef = useRef<'gpt-4o-transcribe' | 'gpt-realtime-whisper'>(TALK_DEFAULT_TRANSCRIPTION_MODEL);
  const processedUserTranscriptItemIdsRef = useRef<Set<string>>(new Set());
  const noiseGuardActiveRef = useRef(false);
  const noiseStrikeCountRef = useRef(0);
  const noiseStrikeWindowStartRef = useRef(0);
  const noiseGuardActivatedAtRef = useRef(0);
  const connectionInitInFlightRef = useRef(false);
  const connectionInitIdRef = useRef(0);
  const initialSessionConfiguredRef = useRef(false);
  const sessionReadyFallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const assistantAwaitingOutputAudioDoneRef = useRef(false);
  const outboundEventCounterRef = useRef(0);
  const outboundEventMetaRef = useRef<Map<string, { type: string; at: number; label: string }>>(new Map());

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const rearmTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const responseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const assistantTurnRecoveryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const holdStartRef = useRef<number>(0);
  const isStoppingRef = useRef(false); // Guard against multiple stopRecording calls
  const isHoldingRef = useRef(false); // Track holding state for audio processor callback
  const isConversationActiveRef = useRef(false);
  const personalTouchRef = useRef<any>(null);
  // Helpful Memory is loaded read-only when the Talk bubble opens. It is NOT
  // captured/forgotten in Talk (by design) — forget/capture happens in Chat.
  const helpfulMemoryBlockRef = useRef<string>('');
  const audioActuallyEndedAtRef = useRef(0);

  const onUserMessageRef = useRef(onUserMessage);
  const onAssistantMessageRef = useRef(onAssistantMessage);
  // Always holds the latest handleRealtimeEvent to avoid stale closure in dc.onmessage
  const handleRealtimeEventRef = useRef<(msg: any) => void>(() => {});

  useEffect(() => {
    onUserMessageRef.current = onUserMessage;
    onAssistantMessageRef.current = onAssistantMessage;
  }, [onUserMessage, onAssistantMessage]);

  const cancelPendingConnection = useCallback(() => {
    pendingAutoStartAfterConnectRef.current = false;
    connectionInitIdRef.current += 1;
    connectionInitInFlightRef.current = false;
    initialSessionConfiguredRef.current = false;

    if (sessionReadyFallbackTimeoutRef.current) {
      clearTimeout(sessionReadyFallbackTimeoutRef.current);
      sessionReadyFallbackTimeoutRef.current = null;
    }

    if (dcRef.current) {
      try { dcRef.current.close(); } catch {}
      dcRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch {}
      pcRef.current = null;
    }

    setIsConnectionReady(false);
    setStatus('ready');
    setError(null);
    setDebugHint(t('Connection canceled. Tap once to try again.', 'تم إلغاء الاتصال. اضغط مرة للمحاولة من جديد.'));
  }, [t]);

  useEffect(() => {
    isConversationActiveRef.current = isConversationActive;
  }, [isConversationActive]);

  useEffect(() => {
    liveTranscriptRef.current = liveTranscript;
  }, [liveTranscript]);

  useEffect(() => {
    aiTranscriptRef.current = aiTranscript;
  }, [aiTranscript]);

  const syncVoiceFromDrawer = useCallback((reason: 'language-sync' | 'drawer-change') => {
    try {
      const appLang: 'ar' | 'en' = language === 'ar' ? 'ar' : 'en';
      const { ar, en } = getSelectedVoices();
      const selectedVoice = appLang === 'ar' ? ar : en;
      const femaleVoice = appLang === 'ar' ? DEFAULT_VOICES.ar.female : DEFAULT_VOICES.en.female;
      const gender: 'male' | 'female' = selectedVoice === femaleVoice ? 'female' : 'male';

      setVoiceGender(gender);
      voiceGenderRef.current = gender;

      console.log('[Talk] Voice synced from drawer', {
        reason,
        appLang,
        selectedVoice,
        gender,
        openaiVoice: getOpenAIVoiceForGender(gender),
      });

      return gender;
    } catch (error) {
      console.warn('[Talk] Failed to sync voice from drawer:', error);
      return voiceGenderRef.current;
    }
  }, [language]);

  useEffect(() => {
    detectedLanguageRef.current = language === 'ar' ? 'ar' : 'en';
    syncVoiceFromDrawer('language-sync');
  }, [language, syncVoiceFromDrawer]);

  const setMicTracksEnabled = useCallback((enabled: boolean) => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }, []);

  const sendRealtimeClientEvent = useCallback((payload: Record<string, any>, label = ''): string | null => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== 'open') {
      console.warn('[Talk] Cannot send realtime event: data channel not open', {
        type: payload?.type,
        label,
        readyState: dc?.readyState ?? 'none',
      });
      return null;
    }

    const event = { ...payload };
    if (typeof event.event_id !== 'string' || !event.event_id.trim()) {
      outboundEventCounterRef.current += 1;
      event.event_id = `talk-${Date.now()}-${outboundEventCounterRef.current}`;
    }

    dc.send(JSON.stringify(event));

    const eventId = event.event_id as string;
    outboundEventMetaRef.current.set(eventId, {
      type: typeof event.type === 'string' ? event.type : 'unknown',
      at: Date.now(),
      label,
    });
    while (outboundEventMetaRef.current.size > 120) {
      const oldestKey = outboundEventMetaRef.current.keys().next().value as string | undefined;
      if (!oldestKey) break;
      outboundEventMetaRef.current.delete(oldestKey);
    }

    if (label) {
      console.log('[Talk] Sent realtime event', { label, type: event.type, event_id: eventId });
    }

    return eventId;
  }, []);

  const bumpAssistantPlaybackLock = useCallback((extraMs = 900) => {
    const next = Date.now() + extraMs;
    if (next > assistantPlaybackLockUntilRef.current) {
      assistantPlaybackLockUntilRef.current = next;
    }
  }, []);

  const isAssistantPlaybackLocked = useCallback(() => Date.now() < assistantPlaybackLockUntilRef.current, []);

  const resetNoiseStrikes = useCallback(() => {
    noiseStrikeCountRef.current = 0;
    noiseStrikeWindowStartRef.current = 0;
  }, []);

  const disableNoiseGuard = useCallback((clearHint = false) => {
    noiseGuardActiveRef.current = false;
    noiseGuardActivatedAtRef.current = 0;
    setIsNoiseGuardActive(false);
    resetNoiseStrikes();
    if (clearHint) {
      setDebugHint('');
    }
  }, [resetNoiseStrikes]);

  const enableNoiseGuard = useCallback(() => {
    if (noiseGuardActiveRef.current) {
      return;
    }

    noiseGuardActiveRef.current = true;
    noiseGuardActivatedAtRef.current = Date.now();
    setIsNoiseGuardActive(true);
    setMicTracksEnabled(false);

    if (dcRef.current && dcRef.current.readyState === 'open') {
      try {
        sendRealtimeClientEvent({ type: 'input_audio_buffer.clear' }, 'noise-guard-clear');
      } catch {
        // Ignore transient channel send errors
      }
    }

    setStatus('ready');
    setDebugHint(t(
      'Noisy place detected. Tap once, speak, then I continue normally.',
      'تم رصد ضوضاء عالية. اضغط مرة وتكلم، ثم أكمل بشكل طبيعي.'
    ));
  }, [sendRealtimeClientEvent, setMicTracksEnabled, t]);

  const maybeReleaseNoiseGuard = useCallback(() => {
    if (!noiseGuardActiveRef.current) {
      return;
    }

    if (Date.now() - noiseGuardActivatedAtRef.current > NOISE_GUARD_MAX_MS) {
      disableNoiseGuard(true);
    }
  }, [disableNoiseGuard]);

  const registerNoiseStrike = useCallback((reason: string) => {
    const now = Date.now();
    if (now - noiseStrikeWindowStartRef.current > NOISE_STRIKE_WINDOW_MS) {
      noiseStrikeWindowStartRef.current = now;
      noiseStrikeCountRef.current = 1;
    } else {
      noiseStrikeCountRef.current += 1;
    }

    console.log('[Talk] Noise strike:', reason, `${noiseStrikeCountRef.current}/${NOISE_STRIKES_TO_GUARD}`);

    if (noiseStrikeCountRef.current >= NOISE_STRIKES_TO_GUARD) {
      enableNoiseGuard();
    }
  }, [enableNoiseGuard]);

  const rearmListening = useCallback((delayMs = 0, options?: { forceArm?: boolean }) => {
    if (rearmTimeoutRef.current) {
      clearTimeout(rearmTimeoutRef.current);
      rearmTimeoutRef.current = null;
    }

    const arm = () => {
      if (isAssistantPlaybackLocked()) {
        const waitMs = Math.max(80, assistantPlaybackLockUntilRef.current - Date.now() + 60);
        rearmTimeoutRef.current = setTimeout(() => {
          rearmTimeoutRef.current = null;
          arm();
        }, waitMs);
        return;
      }

      if (!isConversationActiveRef.current || !isConnectionReady || !dcRef.current || dcRef.current.readyState !== 'open') {
        return;
      }

      maybeReleaseNoiseGuard();
      if (noiseGuardActiveRef.current && !options?.forceArm) {
        setMicTracksEnabled(false);
        setStatus('ready');
        setDebugHint(t('Noisy place mode: tap once, then speak.', 'وضع الضوضاء: اضغط مرة ثم تكلم.'));
        return;
      }

      setMicTracksEnabled(true);
      sendRealtimeClientEvent({ type: 'input_audio_buffer.clear' }, 'rearm-clear');
      setError(null);
      if (options?.forceArm) {
        setDebugHint('');
      }
      setStatus('listening');
    };

    if (delayMs > 0) {
      rearmTimeoutRef.current = setTimeout(() => {
        rearmTimeoutRef.current = null;
        arm();
      }, delayMs);
      return;
    }

    arm();
  }, [isAssistantPlaybackLocked, isConnectionReady, maybeReleaseNoiseGuard, sendRealtimeClientEvent, setMicTracksEnabled, t]);

  const normalizeAssistantTranscript = useCallback((text: string) => text.replace(/\s+/g, ' ').trim(), []);

  const createTalkTurn = useCallback((role: 'user' | 'assistant', text: string): TalkTurn => {
    turnCounterRef.current += 1;
    return {
      id: `${role}-talk-turn-${Date.now()}-${turnCounterRef.current}`,
      role,
      text,
    };
  }, []);

  const addConversationTurn = useCallback((role: 'user' | 'assistant', rawText: string, syncToChat = true) => {
    const text = normalizeAssistantTranscript(rawText);
    if (!text) {
      return null;
    }

    const turn = createTalkTurn(role, text);
    const next = [...conversationHistoryRef.current, turn];
    conversationHistoryRef.current = next;
    setConversationHistory(next);

    if (syncToChat && !syncedTurnIdsRef.current.has(turn.id)) {
      syncedTurnIdsRef.current.add(turn.id);
      if (role === 'user') {
        onUserMessageRef.current(turn.text);
      } else {
        onAssistantMessageRef.current(turn.text);
      }
    }

    return turn;
  }, [createTalkTurn, normalizeAssistantTranscript]);

  const flushConversationToChat = useCallback((includeDraftTurns = false) => {
    if (includeDraftTurns) {
      const userDraft = normalizeAssistantTranscript(liveTranscriptRef.current);
      if (userDraft) {
        const hasUserDraft = conversationHistoryRef.current.some(
          turn => turn.role === 'user' && normalizeAssistantTranscript(turn.text) === userDraft,
        );
        if (!hasUserDraft) {
          addConversationTurn('user', userDraft, true);
        }
      }

      const assistantDraft = normalizeAssistantTranscript(assistantTranscriptBufferRef.current || aiTranscriptRef.current);
      if (assistantDraft && !assistantMessageSyncedRef.current) {
        const hasAssistantDraft = conversationHistoryRef.current.some(
          turn => turn.role === 'assistant' && normalizeAssistantTranscript(turn.text) === assistantDraft,
        );
        if (!hasAssistantDraft) {
          addConversationTurn('assistant', assistantDraft, true);
        }
      }
    }

    conversationHistoryRef.current.forEach(turn => {
      if (syncedTurnIdsRef.current.has(turn.id)) {
        return;
      }
      syncedTurnIdsRef.current.add(turn.id);
      if (turn.role === 'user') {
        onUserMessageRef.current(turn.text);
      } else {
        onAssistantMessageRef.current(turn.text);
      }
    });
  }, [addConversationTurn, normalizeAssistantTranscript]);

  const normalizeForEchoCheck = useCallback((text: string) => {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  const isLikelyAssistantEcho = useCallback((userTranscript: string) => {
    const now = Date.now();
    const audioEnded = audioActuallyEndedAtRef.current;

    // audioActuallyEndedAtRef is set ~900ms after finishAssistantTurn
    // (scheduled inside finishAssistantTurn via setTimeout).
    // No marker = no prior completed response, skip echo check.
    if (audioEnded === 0 || now - audioEnded > 2500) return false;

    // Within 2.5s of audio ending: check text similarity
    const assistant = normalizeForEchoCheck(lastAssistantTranscriptRef.current);
    const user = normalizeForEchoCheck(userTranscript);
    if (!assistant || !user || user.length < 4) return false;

    if (assistant === user) return true;
    if ((assistant.includes(user) && user.length >= 8) || (user.includes(assistant) && assistant.length >= 8)) return true;

    const assistantTokens = new Set(assistant.split(' ').filter(token => token.length > 2));
    const userTokens = user.split(' ').filter(token => token.length > 2);
    if (userTokens.length < 3 || assistantTokens.size === 0) return false;

    let overlap = 0;
    userTokens.forEach(token => {
      if (assistantTokens.has(token)) overlap += 1;
    });
    return overlap / userTokens.length >= 0.55;
  }, [normalizeForEchoCheck]);

  const beginAssistantTurn = useCallback(() => {
    assistantResponseActiveRef.current = true;
    assistantAwaitingOutputAudioDoneRef.current = true;
    assistantMessageSyncedRef.current = false;
    assistantTranscriptBufferRef.current = '';
    bumpAssistantPlaybackLock(1200);
    setDebugHint('');
    setAiTranscript('');
  }, [bumpAssistantPlaybackLock]);

  const updateAssistantTranscript = useCallback((chunk: unknown, mode: 'append' | 'replace' = 'append') => {
    if (typeof chunk !== 'string' || chunk.length === 0) {
      return assistantTranscriptBufferRef.current;
    }

    const nextRaw = mode === 'replace'
      ? chunk
      : `${assistantTranscriptBufferRef.current}${chunk}`;
    const normalized = normalizeAssistantTranscript(nextRaw);

    if (!normalized) {
      return assistantTranscriptBufferRef.current;
    }

    assistantTranscriptBufferRef.current = normalized;
    return normalized;
  }, [normalizeAssistantTranscript]);

  const syncAssistantMessage = useCallback((text: string) => {
    const transcript = normalizeAssistantTranscript(text);
    if (!transcript || assistantMessageSyncedRef.current) {
      return;
    }

    assistantMessageSyncedRef.current = true;
    addConversationTurn('assistant', transcript, true);
    setTalkSummary(prev => {
      const compact = (s: string) => s.replace(/\s+/g, ' ').trim();
      const entry = compact(transcript);
      const base = compact(prev);
      const merged = base ? `${base} | ${entry}` : entry;
      const limited = merged.length > 1200 ? merged.slice(merged.length - 1200) : merged;
      talkSummaryRef.current = limited;
      return limited;
    });
  }, [addConversationTurn, normalizeAssistantTranscript]);

  const extractAssistantTranscriptFromResponse = useCallback((msg: any) => {
    const found: string[] = [];
    const addCandidate = (value: unknown) => {
      if (typeof value !== 'string') {
        return;
      }
      const normalized = normalizeAssistantTranscript(value);
      if (normalized) {
        found.push(normalized);
      }
    };

    addCandidate(msg?.transcript);
    addCandidate(msg?.response?.transcript);
    addCandidate(msg?.response?.text);

    const outputs = Array.isArray(msg?.response?.output) ? msg.response.output : [];
    outputs.forEach((output: any) => {
      addCandidate(output?.transcript);
      addCandidate(output?.text);
      const content = Array.isArray(output?.content) ? output.content : [];
      content.forEach((item: any) => {
        addCandidate(item?.transcript);
        addCandidate(item?.audio_transcript);
        addCandidate(item?.text);
      });
    });

    return found[0] || '';
  }, [normalizeAssistantTranscript]);

  const clearAssistantTurnRecovery = useCallback(() => {
    if (assistantTurnRecoveryTimeoutRef.current) {
      clearTimeout(assistantTurnRecoveryTimeoutRef.current);
      assistantTurnRecoveryTimeoutRef.current = null;
    }
  }, []);

  const scheduleAssistantTurnRecovery = useCallback((delayMs = 2600) => {
    clearAssistantTurnRecovery();
    assistantTurnRecoveryTimeoutRef.current = setTimeout(() => {
      assistantTurnRecoveryTimeoutRef.current = null;
      if (!isConversationActiveRef.current) {
        return;
      }
      console.log('[Talk] Assistant turn recovery fallback -> rearm listening');
      const recoveredTranscript = normalizeAssistantTranscript(assistantTranscriptBufferRef.current);
      if (recoveredTranscript) {
        syncAssistantMessage(recoveredTranscript);
      }
      assistantAwaitingOutputAudioDoneRef.current = false;
      assistantResponseActiveRef.current = false;
      bumpAssistantPlaybackLock(1200);
      rearmListening(650);
    }, delayMs);
  }, [bumpAssistantPlaybackLock, clearAssistantTurnRecovery, normalizeAssistantTranscript, rearmListening, syncAssistantMessage]);

  const finishAssistantTurn = useCallback((msg?: any) => {
    if (responseTimeoutRef.current) {
      clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
    }
    clearAssistantTurnRecovery();
    const finalTranscript = normalizeAssistantTranscript(
      extractAssistantTranscriptFromResponse(msg) || assistantTranscriptBufferRef.current,
    );
    if (finalTranscript) {
      assistantTranscriptBufferRef.current = finalTranscript;
      lastAssistantTranscriptRef.current = finalTranscript;
      lastAssistantFinishedAtRef.current = Date.now();
      setAiTranscript(finalTranscript);
      syncAssistantMessage(finalTranscript);
    }
    bumpAssistantPlaybackLock(700);
    // Mark audio as fully played out ~900ms after turn ends (lock 700ms + ~200ms buffer).
    // WebRTC streams don't fire audio.onended between turns, so we use this as the proxy.
    setTimeout(() => { audioActuallyEndedAtRef.current = Date.now(); }, 900);
    assistantAwaitingOutputAudioDoneRef.current = false;
    assistantResponseActiveRef.current = false;
    setError(null);
    if (isConversationActiveRef.current) {
      rearmListening(200);
    } else {
      setStatus('ready');
    }
  }, [bumpAssistantPlaybackLock, clearAssistantTurnRecovery, extractAssistantTranscriptFromResponse, normalizeAssistantTranscript, rearmListening, syncAssistantMessage]);

  // Fetch the user's active helpful memory and format a compact block for the
  // Realtime instructions. Honors the master helpful_memory_enabled toggle.
  // Filters out stale routines tied to a weekday that isn't today.
  const loadHelpfulMemoryForTalk = useCallback(async (): Promise<void> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) { helpfulMemoryBlockRef.current = ''; return; }

      // Fetch settings + memories in parallel.
      const [settingsRes, memoryRes] = await Promise.all([
        supabase
          .from('user_helpful_memory_settings')
          .select('helpful_memory_enabled')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('user_helpful_memory')
          .select('memory_text, layer, confidence, evidence_count, last_confirmed_at')
          .eq('user_id', userId)
          .eq('status', 'active')
          .in('layer', ['always_use', 'routine', 'project'])
          .order('last_confirmed_at', { ascending: false })
          .limit(20)
      ]);

      if (settingsRes.data?.helpful_memory_enabled === false) {
        helpfulMemoryBlockRef.current = '';
        return;
      }
      const rows = Array.isArray(memoryRes.data) ? memoryRes.data : [];
      if (rows.length === 0) { helpfulMemoryBlockRef.current = ''; return; }

      // Routine filter: only keep routines tied to today's weekday.
      const weekdays = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
      const todayName = weekdays[new Date().getDay()];
      const dayWordRe = /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
      const arDayMap: Record<string, string> = {
        'الأحد':'sunday','الاثنين':'monday','الثلاثاء':'tuesday','الأربعاء':'wednesday','الخميس':'thursday','الجمعة':'friday','السبت':'saturday'
      };

      const kept: string[] = [];
      for (const r of rows) {
        const txt = (r?.memory_text || '').toString().trim();
        if (!txt) continue;
        if (r.layer === 'routine') {
          const m = dayWordRe.exec(txt);
          if (m) {
            if (m[1].toLowerCase() !== todayName) continue;
          } else {
            const arMatch = Object.keys(arDayMap).find((k) => txt.includes(k));
            if (arMatch && arDayMap[arMatch] !== todayName) continue;
          }
        }
        kept.push(txt);
        if (kept.length >= 6) break;
      }
      if (kept.length === 0) { helpfulMemoryBlockRef.current = ''; return; }

      // Store ONLY the raw bullets in the ref. The full block (with adaptive
      // posture + hard rules) is built at use-time in buildHelpfulMemoryBlock()
      // so Personal Touch changes are always reflected without needing a reload.
      helpfulMemoryBlockRef.current = kept.map((line) => `- ${line}`).join('\n');
    } catch (e) {
      console.warn('[Talk] loadHelpfulMemoryForTalk failed:', e);
      helpfulMemoryBlockRef.current = '';
    }
  }, []);

  // Compose the final Helpful Memory block at use-time, adapting the posture
  // (how aggressively memory is surfaced) to the user's Personal Touch
  // Tone + Style. Returns empty string if there are no memories to inject.
  const buildHelpfulMemoryBlock = useCallback((): string => {
    const bullets = helpfulMemoryBlockRef.current;
    if (!bullets) return '';

    const pt = (personalTouchRef.current || {}) as Record<string, unknown>;
    const toneRaw = typeof pt.tone === 'string' ? pt.tone.toLowerCase().trim() : '';
    const styleRaw = typeof pt.style === 'string' ? pt.style.toLowerCase().trim() : '';

    // Style → surfacing frequency
    let styleLine = '';
    if (styleRaw.includes('short')) {
      styleLine = 'Style=Short answers → surface memory ONLY when directly asked or absolutely essential. Never preempt.';
    } else if (styleRaw.includes('detail')) {
      styleLine = 'Style=Detailed → you MAY connect relevant memory facts that genuinely enrich the answer, kept natural.';
    } else if (styleRaw.includes('analy')) {
      styleLine = "Style=Analytical → use memory as reasoning context where it applies to the user's question.";
    } else if (styleRaw.includes('convers')) {
      styleLine = 'Style=Conversational → reference memory only when it genuinely improves flow. Light touch.';
    } else {
      styleLine = 'Style=Default → reference memory sparingly and only when it clearly improves the answer.';
    }

    // Tone → phrasing style
    let toneLine = '';
    if (toneRaw.includes('funny') || toneRaw.includes('playful') || toneRaw.includes('humor')) {
      toneLine = 'Tone=Funny → you may reference memory playfully and briefly, never labored.';
    } else if (toneRaw.includes('serious')) {
      toneLine = 'Tone=Serious → professional reference only when topically relevant. No asides.';
    } else if (toneRaw.includes('casual')) {
      toneLine = 'Tone=Casual → natural woven mention when appropriate (e.g., "since you\'re in Alkhor...").';
    } else if (toneRaw.includes('encourag') || toneRaw.includes('supportive')) {
      toneLine = 'Tone=Encouraging → reference goals/routines supportively only when motivating the user.';
    } else if (toneRaw.includes('engag')) {
      toneLine = 'Tone=Engaging → weave memory naturally when it makes the reply more alive.';
    } else {
      toneLine = 'Tone=Neutral → use plain, unembellished phrasing when you do reference memory.';
    }

    return [
      'HELPFUL MEMORY (things you know about the user — reference only when it genuinely helps the current reply):',
      bullets,
      '',
      'YOUR MEMORY POSTURE (based on user preferences):',
      `- ${styleLine}`,
      `- ${toneLine}`,
      '',
      'NATURAL MEMORY USAGE:',
      '- Lean on memory only when it directly helps the current reply. If the reply works fine without it, leave it out.',
      '- For greetings ("hey", "hi", "good morning", "السلام عليكم", "صباح الخير") — just greet back warmly, no memory facts.',
      '- For creative requests (poems, stories, duas, love notes, translations) — focus on the craft, not on memory.',
      '- Don\'t open replies with a memory-derived factoid unless the user actually asked about that fact.',
      '- If asked "what do you remember about me?" / "ماذا تتذكر عني؟", list the items above plainly and mention they can edit memory in the Helpful Memory panel in Chat.',
      '- If the user says they no longer do X / forget X / لم أعد / انسى: acknowledge warmly. In Talk the memory is read-only, so tell them to say the same thing in Chat to remove it permanently. Don\'t claim it has been deleted.',
      '- Don\'t invent a memory that isn\'t listed above.',
      '- Routines tied to a specific day/season ("Every Thursday...", "During Ramadan...") — act on them only when today actually matches AND the user\'s current message is about that routine.'
    ].join('\n');
  }, []);

  // Build Personal Touch enforcement block
  const buildPersonalTouchSection = useCallback(() => {
    const pt = personalTouchRef.current;
    if (!pt || typeof pt !== 'object') return '';

    const userNick = (pt.nickname || '').toString().trim();
    const aiNick = (pt.aiNickname || pt.ai_nickname || '').toString().trim();
    const tone = (pt.tone || 'neutral').toString().trim();
    const style = (pt.style || 'short answers').toString().trim();
    const extra = (pt.instruction || '').toString().trim();

    let section = '\nPERSONAL TOUCH (how to sound like yourself with this user):\n';
    if (userNick) {
      section += `- The user\'s nickname is "${userNick}". Use it NATURALLY, like a friend would — at the start of a fresh topic, when reconnecting, or warmly once in a while. DO NOT open every single reply with it. Repeating a name every turn sounds robotic.\n`;
    }
    if (aiNick) {
      section += `- When referring to yourself, prefer "${aiNick}" over "I" or "Wakti" when it feels natural.\n`;
    }
    section += `- Tone: ${tone} — reflect this in your rhythm and word choice. Don\'t announce the tone, just be it.\n`;
    section += `- Style: ${style} — match this level of depth/brevity.\n`;
    if (extra) section += `- Custom instruction: ${extra}\n`;
    return section;
  }, []);

  // Fetch user's nickname from PersonalTouchManager and location
  useEffect(() => {
    const fetchUserData = async () => {
      // Get nickname from PersonalTouchManager settings (localStorage)
      try {
        const personalTouchRaw = localStorage.getItem('wakti_personal_touch');
        if (personalTouchRaw) {
          const personalTouch = JSON.parse(personalTouchRaw);
          if (personalTouch?.nickname) {
            console.log('[Talk] Fetched nickname from PersonalTouch:', personalTouch.nickname);
            setUserName(personalTouch.nickname);
            userNameRef.current = personalTouch.nickname;
          }
        }
      } catch (e) {
        console.warn('[Talk] Could not fetch nickname from PersonalTouch:', e);
      }

      // Get user location - try Natively SDK first, then fallback to profile
      try {
        // Try Natively SDK for live location (includes city/country from reverse geocoding)
        const nativeLoc = await getNativeLocation({ timeoutMs: 5000 });
        if (nativeLoc && (nativeLoc.latitude || nativeLoc.longitude || nativeLoc.city || nativeLoc.country)) {
          const loc = {
            city: nativeLoc.city,
            country: nativeLoc.country,
            latitude: nativeLoc.latitude,
            longitude: nativeLoc.longitude,
          };
          console.log('[Talk] Got location from Natively SDK:', loc);
          setUserLocation(loc);
          userLocationRef.current = loc;
        } else {
          // Fallback to profile location from cached profile (passed via prop or localStorage)
          if (_tbCachedProfile && (_tbCachedProfile.city || _tbCachedProfile.country)) {
            const loc = { city: _tbCachedProfile.city || undefined, country: _tbCachedProfile.country || undefined };
            console.log('[Talk] Got location from cached profile:', loc);
            setUserLocation(loc);
            userLocationRef.current = loc;
          }
        }
      } catch (e) {
        console.warn('[Talk] Could not fetch user location:', e);
      }
    };
    fetchUserData();
  }, [language]);

  // Load Personal Touch (nickname, aiNickname, tone, style, instruction)
  useEffect(() => {
    const loadPT = () => {
      try {
        const raw = localStorage.getItem('wakti_personal_touch');
        const parsed = raw ? JSON.parse(raw) : null;
        const pt = parsed && typeof parsed === 'object' ? parsed : null;
        personalTouchRef.current = pt;
        setPersonalTouch(pt);
      } catch (e) {
        console.warn('[Talk] Failed to load Personal Touch:', e);
        personalTouchRef.current = null;
        setPersonalTouch(null);
      }
    };

    loadPT();

    // Listen for updates from PersonalTouchManager
    const handler = (e: any) => {
      const pt = e?.detail || null;
      personalTouchRef.current = pt;
      setPersonalTouch(pt);
    };
    window.addEventListener('wakti-personal-touch-updated', handler);
    return () => window.removeEventListener('wakti-personal-touch-updated', handler);
  }, []);

  const cleanup = useCallback(() => {
    connectionInitInFlightRef.current = false;
    connectionInitIdRef.current += 1;
    initialSessionConfiguredRef.current = false;
    assistantAwaitingOutputAudioDoneRef.current = false;
    if (sessionReadyFallbackTimeoutRef.current) {
      clearTimeout(sessionReadyFallbackTimeoutRef.current);
      sessionReadyFallbackTimeoutRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (assistantTurnRecoveryTimeoutRef.current) {
      clearTimeout(assistantTurnRecoveryTimeoutRef.current);
      assistantTurnRecoveryTimeoutRef.current = null;
    }
    if (rearmTimeoutRef.current) {
      clearTimeout(rearmTimeoutRef.current);
      rearmTimeoutRef.current = null;
    }
    if (responseTimeoutRef.current) {
      clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) { /* ignore */ }
      audioContextRef.current = null;
    }
    if (dcRef.current) {
      try { dcRef.current.close(); } catch (e) { /* ignore */ }
      dcRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (e) { /* ignore */ }
      pcRef.current = null;
    }
    setLiveTranscript('');
    setStatus('ready');
    setMicLevel(0);
    setError(null);
    setIsConnectionReady(false);
    setAiTranscript('');
    setConversationHistory([]);
    conversationHistoryRef.current = [];
    setTalkSummary('');
    talkSummaryRef.current = '';
    setDebugHint('');
    setSearchMode(false);
    searchModeRef.current = false;
    setIsSearching(false);
    setIsNoiseGuardActive(false);
    pendingTranscriptRef.current = '';
    liveTranscriptRef.current = '';
    aiTranscriptRef.current = '';
    transcriptionModelRef.current = TALK_DEFAULT_TRANSCRIPTION_MODEL;
    processedUserTranscriptItemIdsRef.current.clear();
    noiseGuardActiveRef.current = false;
    noiseStrikeCountRef.current = 0;
    noiseStrikeWindowStartRef.current = 0;
    noiseGuardActivatedAtRef.current = 0;
    syncedTurnIdsRef.current.clear();
    turnCounterRef.current = 0;
    assistantTranscriptBufferRef.current = '';
    assistantMessageSyncedRef.current = false;
    assistantResponseActiveRef.current = false;
    assistantAwaitingOutputAudioDoneRef.current = false;
    lastAssistantTranscriptRef.current = '';
    lastAssistantFinishedAtRef.current = 0;
    assistantPlaybackLockUntilRef.current = 0;
    audioActuallyEndedAtRef.current = 0;
    outboundEventCounterRef.current = 0;
    outboundEventMetaRef.current.clear();
    setIsConversationActive(false);
    isConversationActiveRef.current = false;
  }, []);

  const toBase64 = useCallback((bytes: Uint8Array) => {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }, []);

  const fromBase64 = useCallback((b64: string) => {
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf;
  }, []);

  const downsampleFloat32ToInt16 = useCallback((input: Float32Array, inputSampleRate: number, targetSampleRate: number) => {
    if (targetSampleRate === inputSampleRate) {
      const out = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      return out;
    }

    const ratio = inputSampleRate / targetSampleRate;
    const outLength = Math.floor(input.length / ratio);
    const out = new Int16Array(outLength);
    let offset = 0;
    for (let i = 0; i < outLength; i++) {
      const nextOffset = Math.floor((i + 1) * ratio);
      let sum = 0;
      let count = 0;
      for (let j = offset; j < nextOffset && j < input.length; j++) {
        sum += input[j];
        count++;
      }
      const avg = count ? sum / count : 0;
      const s = Math.max(-1, Math.min(1, avg));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      offset = nextOffset;
    }
    return out;
  }, []);

  const buildMemoryContext = useCallback((lang: 'ar' | 'en') => {
    const lastTurns = conversationHistoryRef.current.slice(-10);
    const summary = talkSummaryRef.current.trim();

    if (!summary && lastTurns.length === 0) {
      return '';
    }

    const lines = lastTurns.map(t => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.text}`);
    return tLang(
      lang,
      `Conversation memory (important):\nSummary so far: ${summary || '(none)'}\nLast 10 turns:\n${lines.join('\n')}`,
      `ذاكرة المحادثة (مهم):\nملخص حتى الآن: ${summary || '(لا يوجد)'}\nآخر 10 رسائل:\n${lines.join('\n')}`
    );
  }, [tLang]);

  const detectTranscriptLanguage = useCallback((text: string): 'ar' | 'en' | 'unknown' => {
    if (!text) return 'unknown';
    const hasArabic = /[\u0600-\u06FF]/.test(text);
    const hasLatin = /[A-Za-z]/.test(text);
    const hasCJK = /[\u4E00-\u9FFF]/.test(text);
    if (hasArabic && !hasLatin) return 'ar';
    if (hasLatin && !hasArabic) return 'en';
    if (hasArabic && hasLatin) {
      const arCount = (text.match(/[\u0600-\u06FF]/g) || []).length;
      const enCount = (text.match(/[A-Za-z]/g) || []).length;
      return arCount >= enCount ? 'ar' : 'en';
    }
    if (hasCJK) return 'unknown';
    return 'unknown';
  }, []);

  const isReliableTranscript = useCallback((text: string, appLang: 'ar' | 'en'): boolean => {
    if (!text || text.trim().length < 1) return false;
    if (appLang === 'ar') {
      return /[\u0600-\u06FF]/.test(text) && !/[\u4E00-\u9FFF]/.test(text);
    }
    return /[A-Za-z]/.test(text)
      && !/[\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF]/.test(text);
  }, []);

  const rememberProcessedUserTranscriptItem = useCallback((itemId: unknown) => {
    if (typeof itemId !== 'string' || !itemId.trim()) {
      return false;
    }

    const processed = processedUserTranscriptItemIdsRef.current;
    if (processed.has(itemId)) {
      return true;
    }

    processed.add(itemId);
    while (processed.size > 40) {
      const oldest = processed.values().next().value as string | undefined;
      if (!oldest) break;
      processed.delete(oldest);
    }
    return false;
  }, []);

  // Continuous mic level animation
  const startMicLevelAnimation = useCallback(() => {
    const updateLevel = () => {
      if (!analyserRef.current || !isOpen) return;
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setMicLevel(Math.min(1, avg / 128));
      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };
    updateLevel();
  }, [isOpen]);

  // Initialize WebRTC connection when bubble opens
  const initializeConnection = useCallback(async () => {
    if (connectionInitInFlightRef.current) {
      console.log('[Talk] initializeConnection already in flight, skipping duplicate call');
      return;
    }

    connectionInitInFlightRef.current = true;
    const initId = connectionInitIdRef.current + 1;
    connectionInitIdRef.current = initId;
    const isStaleInit = () => initId !== connectionInitIdRef.current;

    setStatus('connecting');
    setError(null);
    setDebugHint('');
    setIsConnectionReady(false);
    initialSessionConfiguredRef.current = false;
    if (sessionReadyFallbackTimeoutRef.current) {
      clearTimeout(sessionReadyFallbackTimeoutRef.current);
      sessionReadyFallbackTimeoutRef.current = null;
    }

    // Clean up old OpenAI connection
    if (dcRef.current) {
      try { dcRef.current.close(); } catch (e) { /* ignore */ }
      dcRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (e) { /* ignore */ }
      pcRef.current = null;
    }

    let connectionStage: 'microphone' | 'offer' | 'auth' | 'edge' | 'openai' | 'answer' = 'microphone';
    let edgeStage = '';
    let edgeDetails = '';
    let openaiDetails = '';

    try {
      // Get fresh microphone stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      connectionStage = 'microphone';
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 48000 },
          sampleSize: { ideal: 16 },
        },
      });
      if (isStaleInit()) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;

      // Setup analyser for mic level visualization
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch (e) { /* ignore */ }
      }
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Create RTCPeerConnection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });
      pcRef.current = pc;

      pc.onconnectionstatechange = () => {
        console.log('[Talk] Peer connection state:', {
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          signalingState: pc.signalingState,
        });
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[Talk] ICE connection state:', pc.iceConnectionState);
      };

      // Add audio track
      stream.getAudioTracks().forEach(track => {
        track.enabled = false;
        pc.addTrack(track, stream);
      });

      // Handle incoming audio from OpenAI
      pc.ontrack = (event) => {
        if (audioRef.current && event.streams[0]) {
          audioRef.current.srcObject = event.streams[0];
          audioRef.current.play().catch(() => { /* ignore autoplay issues */ });
        }
      };

      // Create data channel for events
      const dc = pc.createDataChannel('oai-events', { ordered: true });
      dcRef.current = dc;

      dc.onopen = () => {
        if (isStaleInit() || dcRef.current !== dc) {
          console.log('[Talk] Ignoring stale data-channel open event');
          return;
        }

        console.log('[Talk] Data channel open - sending session config (manual turn detection)');
        
        // Use refs to get current values (avoid stale closures)
        const currentUserName = userNameRef.current;
        const currentVoiceGender = voiceGenderRef.current;
        const currentLocation = userLocationRef.current;
        
        // Natural conversational opener — use name on greeting, then sparingly
        const personalTouch = currentUserName ? (language === 'ar' 
          ? `أنت في محادثة صوتية مستمرة مع ${currentUserName}. استخدم اسمه بشكل طبيعي — في التحية الأولى، أو عند بداية موضوع جديد، أو من وقت لآخر بشكل ودي. لا تذكر اسمه في كل رد فهذا يبدو آلياً.`
          : `You're in an ongoing voice conversation with ${currentUserName}. Use their name naturally — for the first greeting, when a new topic opens, or warmly once in a while. Don't say their name in every single reply, that sounds robotic.`
        ) : '';

        // Build location context for weather/local queries
        const locationContext = currentLocation?.city || currentLocation?.country
          ? (language === 'ar'
            ? `📍 موقع المستخدم: ${currentLocation.city ? currentLocation.city + '، ' : ''}${currentLocation.country || ''}. عند السؤال عن الطقس أو أي شيء محلي، استخدم هذا الموقع.`
            : `📍 User location: ${currentLocation.city ? currentLocation.city + ', ' : ''}${currentLocation.country || ''}. When asked about weather or anything local, use this location.`)
          : '';
        
        const waktiQuickRules = t(
          `WAKTI quick notes (if asked about the app):
1) "What is Wakti": answer warmly and mention Help & Guides has three tabs — Guides, the Wakti Help Assistant, and Support.
2) "Who made Wakti": made by WAKTI AI LLC in Doha, Qatar.
3) "What can Wakti do": briefly mention tasks, events, voice tools, AI chat with search, and content creation — then point them to Help & Guides.

HONESTY WITH LIVE DATA — read this carefully, it is the most important rule:

What you CAN do (this is normal conversation):
- Discuss sports, teams, players, news topics in a general conversational way — opinions, storylines, how a player is doing, team dynamics, historical facts, general knowledge. If the user says "the Oilers lost Game 2 at home", you can react to that naturally ("tough one, McDavid's absence really shifts things"). That's a friend talking.
- Answer questions about how things work (planes, physics, history, math, geography, rules of a sport, what a team is about, what happened in past seasons) confidently from what you know.

What you MUST NOT do (this is lying):
- NEVER produce specific time-sensitive facts you don't actually have: exact dates, exact times, current scores, upcoming schedules, matchups, today's prices, flight times, live stats, exchange rates. These change constantly and you will be wrong. Being wrong here makes the app look broken.
- NEVER say things like "let me check", "let me grab that", "one sec, pulling it up", "as of right now", "the next game is Thursday April 24th at 8 PM" — UNLESS actual web search results are sitting in your context right now. You are NOT connected to the internet by default. You cannot check anything.
- NEVER fabricate a date, time, score, opponent, or venue. Even with a hedge. Even softly. If you don't know, say you don't know.

What to do instead:
- If the user asks WHEN, WHAT TIME, WHAT SCORE, WHO'S PLAYING, HOW MUCH, WHAT'S THE PRICE, or anything that needs today's data — and the search toggle is OFF — say it plainly and naturally: "Honestly, I don't have the live schedule in front of me — tap the green search button above and ask me again, and I'll pull the exact date and time for you." Or in Arabic: "والله ما عندي الجدول الحي الحين — اضغط زر البحث الأخضر فوق واسألني مرة ثانية، وأجيب لك التاريخ والوقت بالضبط."
- If the user EXPLICITLY says "search", "look it up", "check for me" — and the search toggle is OFF — tell them clearly: "The search toggle is off right now — tap the green button above and ask again, and I'll run a real search." NEVER pretend you searched.
- If the search toggle is ON and search results are already in your context — answer directly from those results, no hedges, no "let me check" theater, no "tap the toggle" line (it's already on).
- Weather "right now / today" = live data → same rule. General climate → answer from knowledge using the user's location above.`,
          `ملاحظات سريعة عن وقتي (إذا سُئلت عن التطبيق):
1) "ما هو وقتي": أجب بحرارة واذكر أن "المساعدة والأدلة" فيها ثلاث تبويبات — الأدلة، ومساعد وقتي، والدعم.
2) "من صنع وقتي": تم تطويره بواسطة شركة WAKTI AI LLC في الدوحة، قطر.
3) "ماذا يفعل وقتي": اذكر باختصار المهام، الفعاليات، أدوات الصوت، دردشة الذكاء الاصطناعي مع البحث، وإنشاء المحتوى — ثم وجّه إلى المساعدة والأدلة.

الصدق مع البيانات الحية — اقرأ هذا بعناية، هذه أهم قاعدة:

ما يمكنك فعله (هذا حديث طبيعي):
- نقاش الرياضة والفرق واللاعبين والأخبار بشكل عام ومحادث — آراء، قصص، أداء لاعب، ديناميكية فريق، حقائق تاريخية، معلومات عامة. إذا قال المستخدم "الأويلرز خسروا المباراة الثانية في بيتهم"، تفاعل بشكل طبيعي ("صعبة، غياب ماكدافيد يغيّر الأمور"). هذا كلام صديق.
- أجب عن كيفية عمل الأشياء (الطائرات، الفيزياء، التاريخ، الرياضيات، الجغرافيا، قوانين رياضة، معلومات عامة عن فريق، ما حدث في مواسم سابقة) بثقة من معرفتك.

ما لا يجوز لك فعله (هذا كذب):
- لا تختلق أبداً حقائق محددة لا تعرفها: تواريخ محددة، أوقات محددة، نتائج حالية، جداول قادمة، مواجهات، أسعار اليوم، أوقات رحلات، إحصائيات لحظية، أسعار صرف. هذه تتغير باستمرار وستخطئ فيها. والخطأ هنا يجعل التطبيق يبدو معطوباً.
- لا تقل أبداً أشياء مثل "خلني أتأكد"، "خلني أشوف"، "لحظة، أجيبها"، "حتى هذه اللحظة"، "المباراة القادمة الخميس 24 أبريل الساعة 8 مساءً" — إلا إذا كانت نتائج بحث فعلية أمامك الآن. أنت غير متصل بالإنترنت افتراضياً. لا تستطيع التأكد من أي شيء.
- لا تختلق أبداً تاريخاً أو وقتاً أو نتيجة أو خصماً أو ملعباً. حتى بتحفّظ. حتى بلطف. إذا ما تعرف، قُل إنك ما تعرف.

ما يجب فعله بدلاً من ذلك:
- إذا سأل المستخدم متى، كم الساعة، ما النتيجة، مين يلعب، كم السعر، أو أي شيء يحتاج بيانات اليوم — وزر البحث مُطفأ — قُلها بوضوح وبشكل طبيعي: "والله ما عندي الجدول الحي الحين — اضغط زر البحث الأخضر فوق واسألني مرة ثانية، وأجيب لك التاريخ والوقت بالضبط."
- إذا قال المستخدم صراحة "ابحث"، "دوّر"، "شيّك" — وزر البحث مُطفأ — قُلها بوضوح: "زر البحث مطفأ حالياً — اضغطه ثم اسألني مرة ثانية، وراح أسوي بحث حقيقي." لا تتظاهر أبداً بأنك بحثت.
- إذا كان زر البحث مُفعّلاً ونتائج البحث عندك في السياق — أجب مباشرة منها، بدون تحفّظات، بدون مسرحية "خلني أتأكد"، وبدون جملة "اضغط الزر" (فهو مُفعّل أصلاً).
- الطقس "الآن / اليوم" = بيانات حية → نفس القاعدة. المناخ العام → أجب من معرفتك مستخدماً موقع المستخدم أعلاه.`
        );

        const memoryContext = buildMemoryContext(language === 'ar' ? 'ar' : 'en');
        const personalTouchSection = buildPersonalTouchSection();
        const helpfulMemoryBlock = buildHelpfulMemoryBlock();
        const transcriptionLanguage = language === 'ar' ? 'ar' : 'en';
        const transcriptionConfig: { model: 'gpt-4o-transcribe' | 'gpt-realtime-whisper'; language: 'ar' | 'en'; delay?: 'medium' } = {
          model: transcriptionModelRef.current,
          language: transcriptionLanguage,
        };
        if (transcriptionModelRef.current === 'gpt-realtime-whisper') {
          transcriptionConfig.delay = 'medium';
        }

        const instructions = t(
          `You are WAKTI — a warm, natural voice assistant. You're having a real conversation, not reading from a manual. ${personalTouch}
${locationContext}

LANGUAGE RULE (MANDATORY): Reply in English only. Do not switch to Arabic unless the user explicitly asks to switch language.

VOICE STYLE (this is SPEECH, not text — every rule matters):
- Talk like a smart friend, but keep phrasing clean and clear.
- Natural contractions are fine, but avoid filler/disfluencies like "you know", "like", "um", repeated starts, or rambling lead-ins.
- Keep each reply tight: one clear idea per sentence, then stop when the answer is complete.
- Match the user's energy. Casual when they're casual, focused when they're focused, playful when they're playful.
- Reply length fits the moment — a single line for quick things, a few sentences for explanations. Never a wall of text.
- ABSOLUTELY NO markdown, NO bullet points, NO numbered lists, NO URLs, NO code blocks. This is spoken audio. Express lists naturally: "first... then... and also..."
- Follow up on what the user just said. Reference earlier parts of the conversation naturally. If they pivot topics, follow along without calling it out.
- Don't lecture. Don't pad. Don't repeat the user's question back to them before answering.

${waktiQuickRules}
${personalTouchSection}
${helpfulMemoryBlock ? '\n' + helpfulMemoryBlock + '\n' : ''}
${memoryContext ? memoryContext : ''}`,
          `أنت WAKTI — مساعد صوتي دافئ وطبيعي. أنت في محادثة حقيقية، لا تقرأ من دليل. ${personalTouch}
${locationContext}

🚨 قاعدة اللغة (إلزامية): جميع ردودك بالعربية فقط. لا تستخدم الإنجليزية إلا لأسماء العلم والمصطلحات التقنية التي لا بديل عربي لها.

أسلوب الصوت (هذا كلام منطوق، لا نص — كل قاعدة مهمة):
- تكلّم كصديق ذكي لكن بصياغة واضحة وسلسة.
- الأسلوب الطبيعي مطلوب، لكن بدون حشو أو تردد مثل "يعني" و"زي" و"أمم" أو بدايات مكررة للجملة.
- اجعل الرد مختصراً وواضحاً: فكرة واحدة واضحة في كل جملة، ثم توقف عند اكتمال الجواب.
- جاري طاقة المستخدم. كن عفوياً لما يكون عفوياً، ومركّزاً لما يكون مركّزاً.
- طول الرد حسب الموقف — سطر واحد للأشياء السريعة، وعدة جمل للشرح. لا تصنع جدارًا من الكلام أبداً.
- ممنوع قطعاً استخدام تنسيق ماركداون، أو نقاط، أو قوائم مرقمة، أو روابط، أو أكواد. هذا صوت منطوق. عبّر عن القوائم بشكل طبيعي: "أولاً... ثم... وأيضاً..."
- تابع كلام المستخدم. اربط بما قاله سابقاً بشكل طبيعي. إذا غيّر الموضوع، جاري معه بدون أن تعلّق على التغيير.
- لا تحاضر. لا تحشُ الكلام. ولا تكرر سؤال المستخدم قبل الإجابة.

${waktiQuickRules}
${personalTouchSection}
${helpfulMemoryBlock ? '\n' + helpfulMemoryBlock + '\n' : ''}
${memoryContext ? memoryContext : ''}`
        );
        
        // Select OpenAI Realtime voice based on Talk Back settings
        // Premium quality picks from OpenAI: male=cedar, female=marin
        const openaiVoice = getOpenAIVoiceForGender(currentVoiceGender);
        console.log('[Talk] Instructions:', instructions);
        console.log('[Talk] User name:', currentUserName, '| Voice:', openaiVoice, '(gender:', currentVoiceGender, ')');
        
        // Use manual turn detection (null) - we control when to commit with hold-to-talk
        sendRealtimeClientEvent({
          type: 'session.update',
          session: {
            type: 'realtime',
            instructions,
            audio: {
              input: {
                transcription: transcriptionConfig,
                noise_reduction: { type: 'near_field' },
                turn_detection: {
                  type: 'semantic_vad',
                  eagerness: TALK_TURN_DETECTION_EAGERNESS,
                  create_response: false,
                  interrupt_response: false,
                },
              },
              output: { voice: openaiVoice },
            },
          }
        }, 'initial-session-update');

        // Wait briefly for explicit session.updated ack before first auto-start.
        if (sessionReadyFallbackTimeoutRef.current) {
          clearTimeout(sessionReadyFallbackTimeoutRef.current);
        }
        sessionReadyFallbackTimeoutRef.current = setTimeout(() => {
          sessionReadyFallbackTimeoutRef.current = null;
          if (isStaleInit() || dcRef.current !== dc || initialSessionConfiguredRef.current) {
            return;
          }
          console.warn('[Talk] session.updated not received in time; using connection-ready fallback');
          initialSessionConfiguredRef.current = true;
          setIsConnectionReady(true);
          setStatus('ready');
          startMicLevelAnimation();
          if (pendingAutoStartAfterConnectRef.current) {
            pendingAutoStartAfterConnectRef.current = false;
            setTimeout(() => {
              startRecordingRef.current?.();
            }, 80);
          }
        }, TALK_READY_FALLBACK_MS);
      };

      dc.onmessage = (event) => {
        if (isStaleInit() || dcRef.current !== dc) {
          return;
        }
        try {
          const msg = JSON.parse(event.data);
          handleRealtimeEventRef.current(msg);
        } catch (e) {
          console.warn('Failed to parse realtime event:', e);
        }
      };

      dc.onerror = (err) => {
        if (isStaleInit() || dcRef.current !== dc) {
          return;
        }
        console.error('[Talk] Data channel error:', {
          err,
          dcReadyState: dc.readyState,
          pcConnectionState: pc.connectionState,
          pcIceConnectionState: pc.iceConnectionState,
          pcSignalingState: pc.signalingState,
        });
        setError(language === 'ar' ? 'خطأ في الاتصال' : 'Connection error');
        setStatus('ready');
        setIsConnectionReady(false);
      };

      dc.onclose = () => {
        if (isStaleInit() || dcRef.current !== dc) {
          return;
        }
        console.warn('[Talk] Data channel closed', {
          dcReadyState: dc.readyState,
          pcConnectionState: pc.connectionState,
          pcIceConnectionState: pc.iceConnectionState,
          pcSignalingState: pc.signalingState,
          isConversationActive: isConversationActiveRef.current,
          assistantResponseActive: assistantResponseActiveRef.current,
        });
        initialSessionConfiguredRef.current = false;
        if (sessionReadyFallbackTimeoutRef.current) {
          clearTimeout(sessionReadyFallbackTimeoutRef.current);
          sessionReadyFallbackTimeoutRef.current = null;
        }
        setIsConnectionReady(false);
        // Keep reconnect available from the orb instead of deadlocking on "connecting".
        setStatus('ready');
        setError(language === 'ar' ? 'انقطع الاتصال' : 'Connection lost');
        setDebugHint(t('Connection lost. Tap once to reconnect.', 'انقطع الاتصال. اضغط مرة لإعادة الاتصال.'));
      };

      // Create offer
      connectionStage = 'offer';
      await pc.setLocalDescription();
      if (isStaleInit()) {
        return;
      }

      // Wait for ICE gathering to complete so the offer includes all candidates
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
          return;
        }
        const onStateChange = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', onStateChange);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', onStateChange);
        setTimeout(() => {
          pc.removeEventListener('icegatheringstatechange', onStateChange);
          resolve();
        }, 5000);
      });
      if (isStaleInit()) {
        return;
      }

      const offer = pc.localDescription;

      if (!offer) {
        throw new Error('Failed to create SDP offer');
      }

      // Get session token from backend
      connectionStage = 'auth';
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (isStaleInit()) {
        return;
      }
      if (sessionError || !sessionData?.session?.access_token) {
        throw new Error(sessionError?.message || 'Missing access token');
      }
      const accessToken = sessionData?.session?.access_token;
      const requestedVoice = getOpenAIVoiceForGender(voiceGenderRef.current);

      console.log('[Talk] Calling Edge Function for client secret...');
      connectionStage = 'edge';
      const response = await supabase.functions.invoke('openai-realtime-session', {
        body: { language, voice: requestedVoice, transcription_model: transcriptionModelRef.current },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      if (isStaleInit()) {
        return;
      }

      if (response.error || !response.data?.client_secret) {
        const invokeError = response.error as { message?: string; context?: unknown } | null;
        const errorContext = invokeError?.context as { clone?: () => { json?: () => Promise<any>; text?: () => Promise<string> } } | undefined;

        if (errorContext?.clone) {
          try {
            const clone = errorContext.clone();
            if (clone?.json) {
              const payload = await clone.json();
              if (typeof payload?.stage === 'string') edgeStage = payload.stage;
              if (typeof payload?.details === 'string' && payload.details.trim()) edgeDetails = payload.details.trim();
              else if (typeof payload?.error === 'string' && payload.error.trim()) edgeDetails = payload.error.trim();
            }
          } catch {
            try {
              const clone = errorContext.clone();
              if (clone?.text) {
                const text = await clone.text();
                if (text?.trim()) edgeDetails = text.trim();
              }
            } catch {
              // Ignore parse fallback errors
            }
          }
        }

        if (!edgeStage && typeof response.data?.stage === 'string') {
          edgeStage = response.data.stage;
        }

        if (!edgeDetails) {
          if (typeof response.data?.details === 'string' && response.data.details.trim()) {
            edgeDetails = response.data.details.trim();
          } else if (typeof response.data?.error === 'string' && response.data.error.trim()) {
            edgeDetails = response.data.error.trim();
          } else {
            edgeDetails = invokeError?.message || 'Failed to get voice session token';
          }
        }

        throw new Error(edgeDetails);
      }

      const clientSecret = typeof response.data?.client_secret === 'string' ? response.data.client_secret.trim() : '';
      if (!clientSecret) {
        throw new Error('Failed to get voice session token');
      }

      const activeModel = typeof response.data?.model === 'string' ? response.data.model : '';
      const activeTranscriptionModel = typeof response.data?.transcription_model === 'string' ? response.data.transcription_model : '';
      transcriptionModelRef.current = activeTranscriptionModel === 'gpt-4o-transcribe'
        ? 'gpt-4o-transcribe'
        : activeTranscriptionModel === 'gpt-realtime-whisper'
          ? 'gpt-realtime-whisper'
          : TALK_DEFAULT_TRANSCRIPTION_MODEL;
      const engineLabel = [activeModel, activeTranscriptionModel].filter(Boolean).join(' / ');
      console.log('[Talk] Active engine:', engineLabel || 'unknown');
      console.log('[Talk] Active transcription model:', transcriptionModelRef.current);

      console.log('[Talk] Calling OpenAI directly for SDP answer...');
      connectionStage = 'openai';
      const openAiController = new AbortController();
      const openAiTimeoutId = window.setTimeout(() => openAiController.abort(), OPENAI_REALTIME_CONNECT_TIMEOUT_MS);
      let openAiResponse: Response;
      try {
        openAiResponse = await fetch(OPENAI_REALTIME_CALLS_URL, {
          method: 'POST',
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${clientSecret}`,
            'Content-Type': 'application/sdp',
          },
          signal: openAiController.signal,
        });
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : String(fetchError || 'Unknown fetch error');
        const isTimeout = fetchError instanceof DOMException
          ? fetchError.name === 'AbortError'
          : /abort|timeout|timed out/i.test(message);
        openaiDetails = isTimeout ? 'OpenAI voice service timed out' : 'OpenAI voice service request failed';
        throw new Error(openaiDetails);
      } finally {
        window.clearTimeout(openAiTimeoutId);
      }

      if (!openAiResponse.ok) {
        openaiDetails = await readRealtimeErrorDetail(openAiResponse);
        throw new Error(openaiDetails);
      }

      const sdpAnswer = await openAiResponse.text();
      console.log('[Talk] Got SDP answer, setting remote description...');
      connectionStage = 'answer';
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: sdpAnswer,
      });
      if (isStaleInit()) {
        return;
      }

      // Watchdog: if dc.onopen never fires within 12 s, fail gracefully instead of hanging forever.
      // dc.onopen will clear this timer and replace it with the shorter session-ready fallback.
      // dc.onclose also clears this timer, so no double-error if the channel opens then immediately closes.
      if (sessionReadyFallbackTimeoutRef.current) {
        clearTimeout(sessionReadyFallbackTimeoutRef.current);
      }
      sessionReadyFallbackTimeoutRef.current = setTimeout(() => {
        sessionReadyFallbackTimeoutRef.current = null;
        if (isStaleInit() || dcRef.current !== dc || initialSessionConfiguredRef.current) {
          return;
        }
        console.warn('[Talk] Data channel watchdog fired — dc.onopen never fired; failing gracefully');
        setError(language === 'ar' ? 'فشل الاتصال' : 'Connection failed');
        setDebugHint(t('Connection failed. Tap once to try again.', 'فشل الاتصال. اضغط مرة للمحاولة من جديد.'));
        setStatus('ready');
        setIsConnectionReady(false);
      }, 12000);

      // Connection will be ready when dc.onopen fires

    } catch (err) {
      if (isStaleInit()) {
        return;
      }
      const detail = err instanceof Error ? err.message : String(err || 'Unknown error');
      console.error('[Talk] Failed to initialize connection:', { connectionStage, edgeStage, detail, err });

      let userError = language === 'ar' ? 'فشل الاتصال' : 'Connection failed';
      if (connectionStage === 'microphone') {
        userError = language === 'ar' ? 'فشل الوصول للمايك' : 'Microphone access failed';
      } else if (connectionStage === 'offer') {
        userError = language === 'ar' ? 'فشل إنشاء اتصال الصوت' : 'Audio connection setup failed';
      } else if (connectionStage === 'auth' || edgeStage === 'auth') {
        userError = language === 'ar' ? 'يرجى تسجيل الدخول مرة أخرى' : 'Please sign in again';
      } else if (connectionStage === 'edge') {
        userError = language === 'ar' ? 'تعذر بدء جلسة الصوت' : 'Could not start voice session';
      } else if (connectionStage === 'openai') {
        userError = language === 'ar' ? 'تعذر إكمال بدء جلسة الصوت' : 'Could not finish starting voice session';
      } else if (connectionStage === 'answer') {
        userError = language === 'ar' ? 'فشلت خطوة الاتصال الأخيرة' : 'Final connection step failed';
      }

      const stageCode = edgeStage || connectionStage;
      const compactDetail = compactSingleLine(openaiDetails || edgeDetails || detail || '');
      const isTimeoutFailure = /timeout|timed out|gateway time-out|gateway timeout|\b504\b/i.test(compactDetail);

      if ((connectionStage === 'edge' || connectionStage === 'openai') && isTimeoutFailure) {
        userError = language === 'ar' ? 'خدمة الصوت مشغولة الآن' : 'Voice service is busy right now';
      }

      setError(userError);
      if ((connectionStage === 'edge' || connectionStage === 'openai') && isTimeoutFailure) {
        setDebugHint(t('Voice service is busy right now. Tap once to try again.', 'خدمة الصوت مشغولة الآن. اضغط مرة للمحاولة من جديد.'));
      } else if (connectionStage === 'edge' || connectionStage === 'openai') {
        setDebugHint(t('Could not start the voice session. Tap once to try again.', 'تعذر بدء جلسة الصوت. اضغط مرة للمحاولة من جديد.'));
      } else if (stageCode === 'auth') {
        setDebugHint(t('Please sign in again, then try Talk one more time.', 'يرجى تسجيل الدخول مرة أخرى، ثم جرّب التحدث مرة أخرى.'));
      } else if (connectionStage === 'microphone') {
        setDebugHint(t('Please allow microphone access, then tap again.', 'يرجى السماح بالوصول إلى المايك، ثم اضغط مرة أخرى.'));
      } else {
        setDebugHint(t('Tap once to try again.', 'اضغط مرة للمحاولة من جديد.'));
      }
      setStatus('ready');
      setIsConnectionReady(false);
    } finally {
      if (!isStaleInit()) {
        connectionInitInFlightRef.current = false;
      }
    }
  }, [buildMemoryContext, buildPersonalTouchSection, language, sendRealtimeClientEvent, startMicLevelAnimation, t]);

  useEffect(() => {
    const handleVoiceChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ lang?: 'ar' | 'en'; voiceId?: string }>).detail;
      const appLang: 'ar' | 'en' = language === 'ar' ? 'ar' : 'en';
      if (detail?.lang && detail.lang !== appLang) {
        return;
      }

      const nextGender = syncVoiceFromDrawer('drawer-change');

      if (!isOpen || !isConnectionReady) {
        return;
      }

      if (isConversationActiveRef.current || assistantResponseActiveRef.current) {
        setDebugHint(t(
          'Voice setting saved. It will apply after this turn.',
          'تم حفظ إعداد الصوت. سيُطبَّق بعد انتهاء هذه الجولة.'
        ));
        return;
      }

      console.log('[Talk] Reconnecting to apply updated drawer voice', {
        nextGender,
        openaiVoice: getOpenAIVoiceForGender(nextGender),
      });
      pendingAutoStartAfterConnectRef.current = false;
      void initializeConnection();
    };

    window.addEventListener('wakti-tts-voice-changed', handleVoiceChanged as EventListener);
    return () => window.removeEventListener('wakti-tts-voice-changed', handleVoiceChanged as EventListener);
  }, [initializeConnection, isConnectionReady, isOpen, language, syncVoiceFromDrawer, t]);

  useEffect(() => {
    if (isOpen) {
      setStatus('ready');
      setError(null);
      setDebugHint('');
      setIsConnectionReady(false);
      pendingAutoStartAfterConnectRef.current = false;
      // Kick off helpful-memory fetch in parallel — it's read-only in Talk and
      // non-blocking: if it resolves before session.update, great; if not, the
      // block is simply empty for the first turn and refreshed on later turns.
      void loadHelpfulMemoryForTalk().catch(() => { /* silent — best-effort */ });
    } else {
      pendingAutoStartAfterConnectRef.current = false;
      flushConversationToChat(true);
      helpfulMemoryBlockRef.current = '';
      cleanup();
    }
  }, [isOpen, cleanup, flushConversationToChat, loadHelpfulMemoryForTalk]);

  useEffect(() => () => cleanup(), [cleanup]);

  // Handle realtime events from OpenAI
  const handleRealtimeEvent = useCallback((msg: any) => {
    console.log('[Talk] Realtime event:', msg.type, msg);
    switch (msg.type) {
      case 'session.created':
        console.log('[Talk] Session created');
        break;
      case 'session.updated':
        if (!initialSessionConfiguredRef.current) {
          initialSessionConfiguredRef.current = true;
          if (sessionReadyFallbackTimeoutRef.current) {
            clearTimeout(sessionReadyFallbackTimeoutRef.current);
            sessionReadyFallbackTimeoutRef.current = null;
          }
          console.log('[Talk] Initial session updated - ready for conversation');
          setIsConnectionReady(true);
          setStatus('ready');
          startMicLevelAnimation();
          if (pendingAutoStartAfterConnectRef.current) {
            pendingAutoStartAfterConnectRef.current = false;
            setTimeout(() => {
              startRecordingRef.current?.();
            }, 80);
          }
        } else {
          console.log('[Talk] Session updated');
        }
        break;
      case 'input_audio_buffer.speech_started':
        if (isConversationActiveRef.current && !assistantResponseActiveRef.current && !isAssistantPlaybackLocked()) {
          setStatus('listening');
          setDebugHint('');
        }
        break;
      case 'input_audio_buffer.speech_stopped':
        if (isConversationActiveRef.current && !assistantResponseActiveRef.current && !isAssistantPlaybackLocked()) {
          setStatus('processing');
        }
        break;
      case 'input_audio_buffer.committed':
        // Audio buffer committed
        console.log('[Talk] Audio committed');
        setMicTracksEnabled(false);
        setStatus('processing');
        if (responseTimeoutRef.current) {
          clearTimeout(responseTimeoutRef.current);
        }
        responseTimeoutRef.current = setTimeout(() => {
          responseTimeoutRef.current = null;
          if (!isConversationActiveRef.current) {
            return;
          }
          assistantResponseActiveRef.current = false;
          setError(language === 'ar' ? 'انتهت المهلة' : 'Response timeout');
          rearmListening();
        }, 30000);
        break;
      case 'conversation.item.input_audio_transcription.completed':
      case 'input_audio_transcription.completed': {
        // User's speech transcribed
        const transcript = normalizeAssistantTranscript(msg.transcript || msg.delta || '');
        const transcriptItemId = typeof msg?.item_id === 'string' ? msg.item_id : '';
        
        // Only proceed if user actually said something (not empty/silence)
        if (transcript.length > 0) {
          if (rememberProcessedUserTranscriptItem(transcriptItemId)) {
            console.log('[Talk] Ignoring duplicate transcription item:', msg.type, transcriptItemId, transcript);
            return;
          }

          if (isLikelyAssistantEcho(transcript)) {
            console.warn('[Talk] Ignoring likely speaker echo transcript:', transcript);
            setDebugHint(tLang(language === 'ar' ? 'ar' : 'en', 'I heard playback echo. Listening again…', 'سمعت صدى من الصوت. أستمع مرة أخرى...'));
            if (responseTimeoutRef.current) {
              clearTimeout(responseTimeoutRef.current);
              responseTimeoutRef.current = null;
            }
            assistantResponseActiveRef.current = false;
            if (isConversationActiveRef.current) {
              rearmListening(160);
            }
            return;
          }

          const detectedLangResult = detectTranscriptLanguage(transcript);
          const appLang: 'ar' | 'en' = language === 'ar' ? 'ar' : 'en';
          const detectedLang = appLang;

          if (!isReliableTranscript(transcript, appLang)) {
            console.warn('[Talk] Transcript failed language reliability check (likely hallucinated echo):', transcript);
            if (responseTimeoutRef.current) {
              clearTimeout(responseTimeoutRef.current);
              responseTimeoutRef.current = null;
            }
            assistantResponseActiveRef.current = false;
            if (isConversationActiveRef.current) {
              rearmListening(200);
            }
            return;
          }

          setLiveTranscript(transcript);
          disableNoiseGuard(true);
          resetNoiseStrikes();

          if (detectedLangResult === 'unknown') {
            console.warn('[Talk] Transcript language unknown; locking to app language:', appLang, transcript);
            setDebugHint(tLang(appLang, 'I heard you. I will keep replying in your app language.', 'سمعتك، وسأستمر بالرد بلغة التطبيق.'));
          } else if (detectedLangResult !== appLang) {
            console.warn('[Talk] Transcript language differs from app language; locking response language to app language', {
              appLang,
              detectedLangResult,
              transcript,
            });
            setDebugHint(tLang(appLang, 'Got it. I will keep replying in your app language.', 'تمام. سأستمر بالرد بلغة التطبيق.'));
          } else {
            setDebugHint('');
          }

          detectedLanguageRef.current = appLang;
          setAiTranscript('');
          addConversationTurn('user', transcript, true);

          if (searchModeRef.current) {
            console.log('[Talk] Search mode active - performing web search for:', transcript);
            pendingTranscriptRef.current = transcript;
            const cleanedQuery = cleanSearchQuery(transcript);
            setSearchMode(false);
            searchModeRef.current = false;
            performWebSearch(cleanedQuery, detectedLang).then((searchContext) => {
              console.log('[Talk] Search complete, sending response with context');
              sendResponseCreate(searchContext, transcript, detectedLang);
            });
          } else {
            console.log('[Talk] Talk mode - sending final transcript:', transcript);
            sendResponseCreate(undefined, transcript, detectedLang);
          }
        } else {
          // User didn't say anything - go back to ready without responding
          console.log('[Talk] Empty transcript - user did not speak, skipping response');
          registerNoiseStrike('empty-transcript');
          if (responseTimeoutRef.current) {
            clearTimeout(responseTimeoutRef.current);
            responseTimeoutRef.current = null;
          }
          if (isConversationActiveRef.current) {
            rearmListening(200);
          } else {
            setStatus('ready');
          }
        }
        break;
      }
      case 'response.created':
        console.log('[Talk] Assistant response created');
        assistantResponseActiveRef.current = true;
        assistantAwaitingOutputAudioDoneRef.current = true;
        audioActuallyEndedAtRef.current = 0;
        bumpAssistantPlaybackLock(1800);
        setStatus('processing');
        break;
      case 'response.output_audio_transcript.delta':
      case 'response.audio_transcript.delta':
        // AI speaking - partial transcript (accumulate)
        assistantAwaitingOutputAudioDoneRef.current = true;
        bumpAssistantPlaybackLock(1800);
        setStatus('speaking');
        setMicTracksEnabled(false);
        if (msg.delta) {
          updateAssistantTranscript(msg.delta, 'append');
        }
        break;
      case 'response.output_audio_transcript.done':
      case 'response.audio_transcript.done':
        // AI transcript completed - keep buffering, finalize on output-audio done.
        bumpAssistantPlaybackLock(900);
        if (msg.transcript) {
          updateAssistantTranscript(msg.transcript, 'replace');
        }
        // Safety fallback only (in case done events are delayed/missing).
        scheduleAssistantTurnRecovery(2000);
        break;
      case 'response.output_audio.done':
      case 'response.audio.done':
        console.log('[Talk] Output audio done - finishing assistant turn');
        assistantAwaitingOutputAudioDoneRef.current = false;
        bumpAssistantPlaybackLock(600);
        finishAssistantTurn(msg);
        break;
      case 'response.done':
        if (assistantAwaitingOutputAudioDoneRef.current) {
          console.log('[Talk] Response complete - waiting for output audio to finish');
          setStatus('speaking');
          bumpAssistantPlaybackLock(900);
          scheduleAssistantTurnRecovery(1200);
        } else {
          console.log('[Talk] Response complete - ready for next turn');
          bumpAssistantPlaybackLock(700);
          finishAssistantTurn(msg);
        }
        break;
      case 'error':
        console.error('[Talk] Realtime error:', msg);
        const linkedEventId = typeof msg?.error?.event_id === 'string' ? msg.error.event_id : '';
        if (linkedEventId) {
          const linkedMeta = outboundEventMetaRef.current.get(linkedEventId);
          console.error('[Talk] Realtime error linked outbound event', {
            event_id: linkedEventId,
            linkedType: linkedMeta?.type || 'unknown',
            linkedLabel: linkedMeta?.label || '',
            ageMs: linkedMeta ? Date.now() - linkedMeta.at : null,
          });
        }
        // Handle specific errors gracefully
        if (msg.error?.message?.includes('active response')) {
          console.log('[Talk] Waiting for active response to complete...');
          scheduleAssistantTurnRecovery(3200);
        } else if (msg.error?.message?.includes('buffer too small')) {
          // Not enough audio detected - just go back to ready
          registerNoiseStrike('buffer-too-small');
          clearAssistantTurnRecovery();
          assistantAwaitingOutputAudioDoneRef.current = false;
          assistantResponseActiveRef.current = false;
          console.log('[Talk] Buffer too small - waiting for more speech');
          if (isConversationActiveRef.current) {
            rearmListening(200);
          } else {
            setStatus('ready');
          }
        } else {
          clearAssistantTurnRecovery();
          assistantAwaitingOutputAudioDoneRef.current = false;
          assistantResponseActiveRef.current = false;
          setError(msg.error?.message || 'Realtime error');
          if (isConversationActiveRef.current) {
            rearmListening(600);
          } else {
            setStatus('ready');
          }
        }
        break;
      default:
        break;
    }
  }, [addConversationTurn, bumpAssistantPlaybackLock, clearAssistantTurnRecovery, detectTranscriptLanguage, disableNoiseGuard, finishAssistantTurn, isAssistantPlaybackLocked, isLikelyAssistantEcho, isReliableTranscript, language, normalizeAssistantTranscript, rearmListening, registerNoiseStrike, rememberProcessedUserTranscriptItem, resetNoiseStrikes, scheduleAssistantTurnRecovery, setMicTracksEnabled, tLang, updateAssistantTranscript]);

  // Keep ref in sync so dc.onmessage always dispatches the latest handler
  useEffect(() => {
    handleRealtimeEventRef.current = handleRealtimeEvent;
  }, [handleRealtimeEvent]);

  // Perform web search using live-talk-search Edge Function
  const performWebSearch = useCallback(async (query: string, lang: 'ar' | 'en'): Promise<string> => {
    try {
      console.log('[Talk] Performing web search for:', query);
      setIsSearching(true);
      
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      const location = userLocationRef.current;
      const response = await supabase.functions.invoke('live-talk-search', {
        body: { 
          query, 
          language: lang,
          ...(location?.city ? { city: location.city } : {}),
          ...(location?.country ? { country: location.country } : {}),
          ...(typeof location?.latitude === 'number' ? { latitude: location.latitude } : {}),
          ...(typeof location?.longitude === 'number' ? { longitude: location.longitude } : {}),
        },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      
      if (response.error || !response.data?.success) {
        console.error('[Talk] Search failed:', response.error || response.data?.error);
        return tLang(
          lang,
          'Search failed. Please try again.',
          'فشل البحث. يرجى المحاولة مرة أخرى.'
        );
      }
      
      console.log('[Talk] Search results:', response.data);
      return response.data.context || tLang(lang, 'No results found.', 'لم يتم العثور على نتائج.');
    } catch (err) {
      console.error('[Talk] Search error:', err);
      return tLang(lang, 'Search error occurred.', 'حدث خطأ في البحث.');
    } finally {
      setIsSearching(false);
    }
  }, [tLang]);

  // Send response.create — optionally inject transient search context.
  //
  // Design: the Realtime API natively tracks every user transcription and
  // assistant response in conversation.items, so we do NOT re-inject the base
  // system prompt or conversation history on every turn (that was wasteful and
  // fought the model's own context). We only send `session.update` when there
  // is genuinely new transient info to inject — i.e. fresh web search results.
  // For long sessions we also piggy-back the rolling session summary so older
  // context survives even if native items get truncated.
  const sendResponseCreate = useCallback((searchContext?: string, _userUtterance?: string, detectedLang?: 'ar' | 'en') => {
    if (!isConversationActiveRef.current) {
      console.warn('[Talk] Conversation no longer active, skipping response.create');
      return;
    }

    if (!dcRef.current || dcRef.current.readyState !== 'open') {
      console.warn('[Talk] Data channel not open, cannot send response.create');
      setError((detectedLang || language) === 'ar' ? 'فشل الاتصال' : 'Connection failed');
      setStatus('ready');
      return;
    }

    if (assistantResponseActiveRef.current) {
      console.warn('[Talk] Assistant response already active, skipping duplicate response.create');
      return;
    }

    beginAssistantTurn();
    setStatus('processing');

    try {
      // Only inject a session.update when we have transient info (search results).
      // Plain turns rely entirely on the base instructions sent on session open
      // plus the Realtime API's native conversation.items tracking.
      if (searchContext) {
        const activeLang = detectedLang || detectedLanguageRef.current || (language === 'ar' ? 'ar' : 'en');

        // Rolling session summary — useful in long sessions where older
        // conversation items may fall out of the model's native window.
        const rollingSummary = (talkSummaryRef.current || '').trim();
        const summaryBlock = rollingSummary ? tLang(
          activeLang,
          `\n\nSESSION CONTEXT (rolling summary of this conversation so far, for continuity — do not read it out loud, just use it):\n${rollingSummary}`,
          `\n\nسياق الجلسة (ملخص متدرج للمحادثة حتى الآن للمتابعة — لا تقرأه بصوتٍ عالٍ، فقط استخدمه):\n${rollingSummary}`
        ) : '';

        const searchBlock = tLang(
          activeLang,
          `\n\nFRESH GOOGLE-GROUNDED SEARCH RESULTS (answer from these, not from memory):\n${searchContext}\n\nHow to use these results:\n- Answer the user's question directly and naturally using the facts above.\n- Mention the source briefly when it helps trust (e.g., "according to ESPN..."), but don't read URLs out loud.\n- Spoken style — no lists, no markdown, no link dumps.\n- Do not tell the user to switch modes or use another search flow.`,
          `\n\nنتائج بحث حديثة ومدعومة من Google (أجب منها، لا من الذاكرة):\n${searchContext}\n\nكيف تستخدمها:\n- أجب على سؤال المستخدم مباشرة وبأسلوب طبيعي من هذه الحقائق.\n- اذكر المصدر باختصار عند الحاجة (مثلاً "حسب ESPN..."), لكن لا تقرأ الروابط بصوت عالٍ.\n- أسلوب منطوق — بلا قوائم ولا ماركداون ولا سرد روابط.\n- لا تطلب من المستخدم الانتقال إلى وضع آخر أو استخدام مسار بحث مختلف.`
        );

        // Minimal instructions update — just the transient blocks.
        // Base voice/style/personal touch rules remain from session open.
        const refreshedInstructions = tLang(
          activeLang,
          `(Continuing the same voice conversation — all your original voice-style rules, personal touch, and memory guidance still apply; do not reintroduce yourself.)${summaryBlock}${searchBlock}`,
          `(استمرار لنفس المحادثة الصوتية — جميع قواعد الأسلوب الصوتي الأصلية، ولمستك الشخصية، وإرشادات الذاكرة ما زالت سارية؛ لا تعيد تقديم نفسك.)${summaryBlock}${searchBlock}`
        );

        sendRealtimeClientEvent({
          type: 'session.update',
          session: { type: 'realtime', instructions: refreshedInstructions }
        }, 'search-session-update');
      }

      sendRealtimeClientEvent({ type: 'response.create' }, 'response-create');
    } catch (e) {
      assistantAwaitingOutputAudioDoneRef.current = false;
      assistantResponseActiveRef.current = false;
      assistantMessageSyncedRef.current = false;
      assistantTranscriptBufferRef.current = '';
      console.warn('[Talk] Failed to inject transient context before response:', e);
      setError((detectedLang || language) === 'ar' ? 'فشل الاتصال' : 'Connection failed');
      setStatus('ready');
    }
  }, [beginAssistantTurn, language, sendRealtimeClientEvent, tLang]);

  // Stop recording and send to AI (defined first so startRecording can reference it)
  const stopRecording = useCallback(() => {
    setIsConversationActive(false);
    isConversationActiveRef.current = false;
    disableNoiseGuard(true);
    setIsHolding(false);
    isHoldingRef.current = false;
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (rearmTimeoutRef.current) {
      clearTimeout(rearmTimeoutRef.current);
      rearmTimeoutRef.current = null;
    }
    if (responseTimeoutRef.current) {
      clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
    }
    if (assistantTurnRecoveryTimeoutRef.current) {
      clearTimeout(assistantTurnRecoveryTimeoutRef.current);
      assistantTurnRecoveryTimeoutRef.current = null;
    }
    assistantTranscriptBufferRef.current = '';
    assistantMessageSyncedRef.current = false;
    assistantAwaitingOutputAudioDoneRef.current = false;
    assistantResponseActiveRef.current = false;
    lastAssistantTranscriptRef.current = '';
    lastAssistantFinishedAtRef.current = 0;
    assistantPlaybackLockUntilRef.current = 0;
    processedUserTranscriptItemIdsRef.current.clear();
    setDebugHint('');
    setMicTracksEnabled(false);
    if (dcRef.current && dcRef.current.readyState === 'open') {
      sendRealtimeClientEvent({ type: 'input_audio_buffer.clear' }, 'stop-recording-clear');
    }
    setStatus('ready');
  }, [disableNoiseGuard, sendRealtimeClientEvent, setMicTracksEnabled]);

  // Start recording when user holds
  const startRecording = useCallback(() => {
    if (!isConnectionReady || !dcRef.current || dcRef.current.readyState !== 'open') {
      console.warn('[Talk] Cannot start recording - connection not ready');
      setError(language === 'ar' ? 'الاتصال غير جاهز' : 'Connection not ready');
      return;
    }

    disableNoiseGuard(true);
    setIsConversationActive(true);
    isConversationActiveRef.current = true;
    setError(null);
    setLiveTranscript('');
    pendingTranscriptRef.current = ''; // Clear pending transcript
    assistantTranscriptBufferRef.current = '';
    assistantMessageSyncedRef.current = false;
    assistantAwaitingOutputAudioDoneRef.current = false;
    assistantResponseActiveRef.current = false;
    lastAssistantTranscriptRef.current = '';
    lastAssistantFinishedAtRef.current = 0;
    assistantPlaybackLockUntilRef.current = 0;
    processedUserTranscriptItemIdsRef.current.clear();
    setDebugHint('');
    setAiTranscript(''); // Clear previous AI response
    rearmListening();
  }, [disableNoiseGuard, isConnectionReady, language, rearmListening]);

  useEffect(() => {
    startRecordingRef.current = startRecording;
  }, [startRecording]);

  const handleEndConversation = useCallback(() => {
    pendingAutoStartAfterConnectRef.current = false;
    flushConversationToChat(true);
    stopRecording();
    onClose();
  }, [flushConversationToChat, onClose, stopRecording]);

  const handleTalkButtonPress = useCallback(() => {
    if (status === 'processing' || status === 'speaking') {
      return;
    }

    if (status === 'connecting') {
      cancelPendingConnection();
      return;
    }

    setError(null);

    if (!isConnectionReady) {
      pendingAutoStartAfterConnectRef.current = true;
      initializeConnection();
      return;
    }

    if (isConversationActive && isNoiseGuardActive) {
      rearmListening(0, { forceArm: true });
      return;
    }

    if (!isConversationActive) {
      startRecording();
    }
  }, [cancelPendingConnection, initializeConnection, isConnectionReady, isConversationActive, isNoiseGuardActive, rearmListening, startRecording, status]);

  if (!isOpen) return null;

  const statusText: Record<typeof status, string> = {
    connecting: language === 'ar' ? 'جارٍ الاتصال...' : 'Connecting...',
    ready: isConnectionReady
      ? (
        isConversationActive && isNoiseGuardActive
          ? (language === 'ar' ? 'ضوضاء عالية: اضغط وتكلم' : 'Noisy place: tap and speak')
          : (language === 'ar' ? 'اضغط لبدء المحادثة' : 'Tap to start conversation')
      )
      : (language === 'ar' ? 'اضغط للاتصال' : 'Tap to connect'),
    listening: language === 'ar' ? 'أسمعك...' : 'Listening...',
    processing: language === 'ar' ? 'جارٍ التفكير...' : 'Thinking...',
    speaking: language === 'ar' ? 'Wakti يتحدث...' : 'Wakti speaking...',
  };

  return (
    <div className={`fixed inset-0 z-[9999] flex flex-col backdrop-blur-md ${theme === 'dark' ? 'bg-[#0c0f14]/95' : 'bg-[#fcfefd]/95'}`} style={{ paddingTop: 'calc(env(safe-area-inset-top, 20px) + 120px)', paddingBottom: 'env(safe-area-inset-bottom, 20px)' }}>
      {/* Hidden audio element for playback */}
      <audio ref={audioRef} autoPlay className="hidden" />

      {/* Top bar with toggle and close button - positioned below Natively header */}
      <div className="absolute left-0 right-0 flex items-center justify-center px-4 z-20" style={{ top: 'calc(env(safe-area-inset-top, 20px) + 70px)' }}>
        <div className="flex flex-col items-center gap-2">
          {/* Talk / Search Toggle - center */}
          <div className={`flex items-center gap-1 p-1 rounded-full backdrop-blur-sm ${theme === 'dark' ? 'bg-white/10' : 'bg-black/10'}`}>
            <button
              onClick={() => {
                setSearchMode(false);
                searchModeRef.current = false;
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                !searchMode 
                  ? (theme === 'dark' ? 'bg-white/20 text-white shadow-lg' : 'bg-black/20 text-[#060541] shadow-lg')
                  : (theme === 'dark' ? 'text-white/60 hover:text-white/80' : 'text-[#060541]/60 hover:text-[#060541]/80')
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              {t('Talk', 'محادثة')}
            </button>
            <button
              onClick={() => {
                setSearchMode(true);
                searchModeRef.current = true;
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                searchMode 
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg' 
                  : (theme === 'dark' ? 'text-white/60 hover:text-white/80' : 'text-[#060541]/60 hover:text-[#060541]/80')
              }`}
            >
              <Search className="w-4 h-4" />
              {t('Search', 'بحث')}
            </button>
          </div>

        </div>

        {/* Close button - absolute right */}
        <button
          onClick={handleEndConversation}
          className={`absolute right-4 p-3 rounded-full transition-colors select-none ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20' : 'bg-black/10 hover:bg-black/20'}`}
          aria-label="Close"
        >
          <X className={`w-6 h-6 ${theme === 'dark' ? 'text-white' : 'text-[#060541]'}`} />
        </button>
      </div>

      {/* Main content area - centered */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 select-none overflow-auto">
        {/* Epic liquid orb CSS - Siri-inspired but better */}
        <style>{`
          .voice-orb-wrapper {
            position: relative;
            width: 220px;
            height: 220px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          /* Main orb button */
          .voice-orb {
            position: relative;
            width: 180px;
            height: 180px;
            border-radius: 50%;
            background: linear-gradient(145deg, 
              #00d4ff 0%, 
              #7b2ff7 25%, 
              #f107a3 50%, 
              #ff6b6b 75%, 
              #00d4ff 100%
            );
            background-size: 400% 400%;
            animation: gradientShift 8s ease infinite;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            border: none;
            outline: none;
            box-shadow: inset 0 0 60px rgba(255, 255, 255, 0.1);
            overflow: visible;
            -webkit-tap-highlight-color: transparent;
            touch-action: none;
            user-select: none;
            -webkit-user-select: none;
            transition: box-shadow 0.3s ease-out, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          
          .voice-orb:disabled {
            opacity: 0.4;
            cursor: not-allowed;
            filter: grayscale(0.5);
          }
          
          /* Inner glass sphere effect */
          .orb-glass {
            position: absolute;
            inset: 8px;
            border-radius: 50%;
            background: radial-gradient(
              ellipse 80% 50% at 30% 20%,
              rgba(255, 255, 255, 0.6) 0%,
              rgba(255, 255, 255, 0.1) 40%,
              transparent 70%
            );
            pointer-events: none;
          }
          
          /* Floating plasma blobs - hidden by default, show only when listening */
          .plasma {
            position: absolute;
            border-radius: 50%;
            filter: blur(25px);
            mix-blend-mode: normal;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease-out;
          }
          
          /* Show plasma blobs when listening (holding button) */
          .voice-orb-wrapper.listening .plasma {
            opacity: 0.9;
          }
          
          .plasma-1 {
            width: 130px;
            height: 130px;
            background: radial-gradient(circle, rgba(0, 212, 255, 0.85) 0%, rgba(0, 212, 255, 0.4) 50%, transparent 70%);
            top: -30px;
            left: -30px;
            animation: plasmaFloat1 6s ease-in-out infinite;
          }
          
          .plasma-2 {
            width: 110px;
            height: 110px;
            background: radial-gradient(circle, rgba(241, 7, 163, 0.85) 0%, rgba(241, 7, 163, 0.4) 50%, transparent 70%);
            bottom: -25px;
            right: -25px;
            animation: plasmaFloat2 5s ease-in-out infinite;
          }
          
          .plasma-3 {
            width: 90px;
            height: 90px;
            background: radial-gradient(circle, rgba(123, 47, 247, 0.9) 0%, rgba(123, 47, 247, 0.5) 50%, transparent 70%);
            top: 50%;
            left: -40px;
            animation: plasmaFloat3 7s ease-in-out infinite;
          }
          
          .plasma-4 {
            width: 100px;
            height: 100px;
            background: radial-gradient(circle, rgba(255, 107, 107, 0.8) 0%, rgba(255, 107, 107, 0.4) 50%, transparent 70%);
            bottom: 20%;
            right: -35px;
            animation: plasmaFloat4 4s ease-in-out infinite;
          }
          
          /* Outer ring pulses */
          .ring-pulse {
            position: absolute;
            inset: -30px;
            border-radius: 50%;
            border: 2px solid rgba(123, 47, 247, 0.3);
            animation: ringExpand 2s ease-out infinite;
            pointer-events: none;
            opacity: 0;
            display: none;
            transition: opacity 0.3s ease-out;
          }

          /* Show ring pulses only when active (holding/speaking/processing) */
          .voice-orb-wrapper.listening .ring-pulse,
          .voice-orb-wrapper.speaking .ring-pulse,
          .voice-orb-wrapper.processing .ring-pulse {
            opacity: 1;
            display: block;
          }
          
          .ring-pulse-2 {
            animation-delay: 0.5s;
          }
          
          .ring-pulse-3 {
            animation-delay: 1s;
          }
          
          /* === LISTENING STATE === */
          .voice-orb-wrapper.listening .voice-orb {
            transform: scale(1.15);
            animation: gradientShift 2s ease infinite, orbPulse 0.5s ease-in-out infinite;
            box-shadow: 
              0 0 80px rgba(123, 47, 247, 0.7),
              0 0 160px rgba(241, 7, 163, 0.5),
              0 0 240px rgba(0, 212, 255, 0.3),
              inset 0 0 80px rgba(255, 255, 255, 0.2);
          }

          /* === SPEAKING/PROCESSING STATES === */
          .voice-orb-wrapper.speaking .voice-orb,
          .voice-orb-wrapper.processing .voice-orb {
            box-shadow: 
              0 0 60px rgba(123, 47, 247, 0.5),
              0 0 120px rgba(241, 7, 163, 0.3),
              inset 0 0 60px rgba(255, 255, 255, 0.1);
          }
          
          .voice-orb-wrapper.listening .plasma-1 {
            animation: plasmaActive1 0.8s ease-in-out infinite;
          }
          .voice-orb-wrapper.listening .plasma-2 {
            animation: plasmaActive2 0.6s ease-in-out infinite;
          }
          .voice-orb-wrapper.listening .plasma-3 {
            animation: plasmaActive3 0.7s ease-in-out infinite;
          }
          .voice-orb-wrapper.listening .plasma-4 {
            animation: plasmaActive4 0.5s ease-in-out infinite;
          }
          
          .voice-orb-wrapper.listening .ring-pulse {
            animation: ringExpandFast 0.8s ease-out infinite;
            border-color: rgba(0, 212, 255, 0.5);
          }
          
          /* === SPEAKING STATE === */
          .voice-orb-wrapper.speaking .voice-orb {
            animation: gradientShift 4s ease infinite, speakingBreath 1.5s ease-in-out infinite;
            box-shadow: 
              0 0 100px rgba(241, 7, 163, 0.6),
              0 0 200px rgba(123, 47, 247, 0.4),
              inset 0 0 60px rgba(255, 255, 255, 0.15);
          }
          
          .voice-orb-wrapper.speaking .plasma {
            animation-duration: 2s;
          }
          
          .voice-orb-wrapper.speaking .ring-pulse {
            border-color: rgba(241, 7, 163, 0.4);
            animation: ringExpandSlow 3s ease-out infinite;
          }
          
          /* === PROCESSING STATE === */
          .voice-orb-wrapper.processing .voice-orb {
            animation: gradientShift 3s ease infinite, processingGlow 1s ease-in-out infinite;
            box-shadow: 
              0 0 60px rgba(123, 47, 247, 0.5),
              0 0 120px rgba(241, 7, 163, 0.3),
              inset 0 0 60px rgba(255, 255, 255, 0.1);
          }
          
          /* === KEYFRAMES === */
          @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          
          @keyframes orbPulse {
            0%, 100% { transform: scale(1.15); }
            50% { transform: scale(1.2); }
          }
          
          @keyframes speakingBreath {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.08); }
          }
          
          @keyframes processingGlow {
            0%, 100% { opacity: 0.8; filter: brightness(1); }
            50% { opacity: 1; filter: brightness(1.2); }
          }
          
          @keyframes plasmaFloat1 {
            0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.8; }
            25% { transform: translate(30px, 20px) scale(1.2); opacity: 1; }
            50% { transform: translate(10px, 40px) scale(0.9); opacity: 0.7; }
            75% { transform: translate(-20px, 15px) scale(1.1); opacity: 0.9; }
          }
          
          @keyframes plasmaFloat2 {
            0%, 100% { transform: translate(0, 0) scale(1) rotate(0deg); opacity: 0.8; }
            33% { transform: translate(-25px, -30px) scale(1.3) rotate(120deg); opacity: 1; }
            66% { transform: translate(15px, -20px) scale(0.8) rotate(240deg); opacity: 0.6; }
          }
          
          @keyframes plasmaFloat3 {
            0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.7; }
            50% { transform: translate(40px, -25px) scale(1.4); opacity: 1; }
          }
          
          @keyframes plasmaFloat4 {
            0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.7; }
            50% { transform: translate(-30px, 20px) scale(1.2); opacity: 0.9; }
          }
          
          @keyframes plasmaActive1 {
            0%, 100% { transform: translate(0, 0) scale(1); opacity: 1; }
            25% { transform: translate(50px, -40px) scale(1.5); }
            50% { transform: translate(-30px, 50px) scale(0.7); }
            75% { transform: translate(40px, 30px) scale(1.3); }
          }
          
          @keyframes plasmaActive2 {
            0%, 100% { transform: translate(0, 0) scale(1) rotate(0deg); }
            50% { transform: translate(-50px, -50px) scale(1.6) rotate(180deg); }
          }
          
          @keyframes plasmaActive3 {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(60px, -30px) scale(1.8); }
            66% { transform: translate(30px, 40px) scale(0.6); }
          }
          
          @keyframes plasmaActive4 {
            0%, 100% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(-60px, -40px) scale(1.5); }
          }
          
          @keyframes ringExpand {
            0% { transform: scale(1); opacity: 0.6; }
            100% { transform: scale(1.8); opacity: 0; }
          }
          
          @keyframes ringExpandFast {
            0% { transform: scale(1); opacity: 0.8; }
            100% { transform: scale(2); opacity: 0; }
          }
          
          @keyframes ringExpandSlow {
            0% { transform: scale(1); opacity: 0.5; }
            100% { transform: scale(2.2); opacity: 0; }
          }
        `}</style>

        {/* Epic voice orb */}
        <div className={`voice-orb-wrapper ${status === 'listening' ? 'listening' : ''} ${status === 'speaking' ? 'speaking' : ''} ${status === 'processing' ? 'processing' : ''}`}>
          {/* Expanding ring pulses */}
          <div className="ring-pulse"></div>
          <div className="ring-pulse ring-pulse-2"></div>
          <div className="ring-pulse ring-pulse-3"></div>
          
          {/* Floating plasma blobs */}
          <div className="plasma plasma-1"></div>
          <div className="plasma plasma-2"></div>
          <div className="plasma plasma-3"></div>
          <div className="plasma plasma-4"></div>
          
          <button
            onClick={handleTalkButtonPress}
            onContextMenu={(e) => e.preventDefault()}
            disabled={status === 'processing' || status === 'speaking'}
            className="voice-orb touch-none"
            aria-label={statusText[status]}
          >
            {/* Inner glass highlight */}
            <div className="orb-glass"></div>
            <Mic className="w-16 h-16 text-white drop-shadow-lg relative z-10 pointer-events-none" />
          </button>
        </div>

        {/* Status text */}
        <div className={`text-xl font-medium select-none ${theme === 'dark' ? 'text-white/90' : 'text-[#060541]/90'}`}>
          {isSearching 
            ? (language === 'ar' ? 'جارٍ البحث...' : 'Searching...') 
            : statusText[status]}
        </div>

        {/* Instruction text */}
        <p className={`text-sm text-center max-w-[240px] select-none ${theme === 'dark' ? 'text-white/60' : 'text-[#060541]/60'}`}>
          {status === 'connecting'
            ? t('Connecting now. Tap again to cancel.', 'جارٍ الاتصال الآن. اضغط مرة أخرى للإلغاء.')
            : isConversationActive
            ? (
              isNoiseGuardActive
                ? t('Noisy place mode is on. Tap the orb, speak, then I return to normal loop.', 'وضع الضوضاء مفعل. اضغط الدائرة وتكلم، ثم أرجع للوضع الطبيعي.')
                : t('Speak naturally. I will wait for you, then answer, then listen again.', 'تحدث بشكل طبيعي. سأنتظر حتى تنتهي، ثم أرد، ثم أعود للاستماع.')
            )
            : isConnectionReady
              ? t('Tap once to start a natural conversation', 'اضغط مرة واحدة لبدء محادثة طبيعية')
              : t('Tap once to connect and start', 'اضغط مرة واحدة للاتصال والبدء')}
        </p>

        {/* Countdown when recording */}
        {isHolding && (
          <div className={`text-4xl font-bold tabular-nums select-none ${theme === 'dark' ? 'text-white' : 'text-[#060541]'}`}>
            {countdown}s
          </div>
        )}

        {/* User transcript (what you said) */}
        {liveTranscript && (
          <div className={`max-w-sm text-center text-base select-none ${theme === 'dark' ? 'text-white/70' : 'text-[#060541]/70'}`}>
            <span className={`text-sm block mb-1 ${theme === 'dark' ? 'text-white/50' : 'text-[#060541]/50'}`}>{t('You:', 'أنت:')}</span>
            <div className="leading-snug max-h-[2.6em] overflow-y-auto overscroll-contain">
              "{liveTranscript}"
            </div>
          </div>
        )}

        {/* AI transcript (what AI said) */}
        {aiTranscript && status !== 'listening' && (
          <div className={`max-w-sm text-center text-base select-none ${theme === 'dark' ? 'text-purple-300/90' : 'text-purple-600/90'}`}>
            <span className={`text-sm block mb-1 ${theme === 'dark' ? 'text-purple-300/60' : 'text-purple-600/60'}`}>{t('Wakti:', 'واكتي:')}</span>
            <div className="leading-snug max-h-[8em] overflow-y-auto overscroll-contain">
              "{aiTranscript}"
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-base text-red-400 font-medium select-none">
            {error}
          </div>
        )}

        {/* Lightweight diagnostics */}
        {debugHint && (
          <div className={`max-w-sm text-center text-xs leading-relaxed select-none ${theme === 'dark' ? 'text-white/45' : 'text-[#060541]/45'}`}>
            <div>{debugHint}</div>
          </div>
        )}

        {/* End button */}
        <button
          onClick={handleEndConversation}
          className={`mt-2 px-10 py-3 rounded-full text-lg font-medium transition-colors select-none ${theme === 'dark' ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-black/10 hover:bg-black/20 text-[#060541]'}`}
        >
          {t('End', 'إنهاء')}
        </button>
      </div>
    </div>
  );
}
