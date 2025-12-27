import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Mic, Search, MessageCircle } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_VOICES } from './TalkBackSettings';

interface TalkBubbleProps {
  isOpen: boolean;
  onClose: () => void;
  onUserMessage: (text: string) => void;
  onAssistantMessage: (text: string, audioUrl?: string) => void;
}

const MAX_RECORD_SECONDS = 10; // 10 second limit

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

export function TalkBubble({ isOpen, onClose, onUserMessage, onAssistantMessage }: TalkBubbleProps) {
  const { language, theme } = useTheme();
  const t = useCallback((en: string, ar: string) => (language === 'ar' ? ar : en), [language]);
  const [isHolding, setIsHolding] = useState(false);
  const [countdown, setCountdown] = useState(MAX_RECORD_SECONDS);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [status, setStatus] = useState<'connecting' | 'ready' | 'listening' | 'processing' | 'speaking'>('connecting');
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isConnectionReady, setIsConnectionReady] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('male');
  const [aiTranscript, setAiTranscript] = useState<string>('');
  const [conversationHistory, setConversationHistory] = useState<{role: 'user' | 'assistant', text: string}[]>([]);
  const [talkSummary, setTalkSummary] = useState<string>('');
  const [searchMode, setSearchMode] = useState(false); // One-turn search mode (auto-resets after use)
  const [isSearching, setIsSearching] = useState(false); // Currently fetching search results
  const [personalTouch, setPersonalTouch] = useState<any>(null);

  // Use refs for values needed in callbacks to avoid stale closures
  const userNameRef = useRef<string>('');
  const voiceGenderRef = useRef<'male' | 'female'>('male');
  const conversationHistoryRef = useRef<{role: 'user' | 'assistant', text: string}[]>([]);
  const talkSummaryRef = useRef<string>('');
  const searchModeRef = useRef(false); // Ref for search mode to avoid stale closures
  const pendingTranscriptRef = useRef<string>(''); // Store transcript while waiting for search

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const holdStartRef = useRef<number>(0);
  const isStoppingRef = useRef(false); // Guard against multiple stopRecording calls
  const isHoldingRef = useRef(false); // Track holding state for audio processor callback
  const personalTouchRef = useRef<any>(null);

  // Build Personal Touch enforcement block
  const buildPersonalTouchSection = useCallback(() => {
    const pt = personalTouchRef.current;
    if (!pt || typeof pt !== 'object') return '';

    const userNick = (pt.nickname || '').toString().trim();
    const aiNick = (pt.aiNickname || pt.ai_nickname || '').toString().trim();
    const tone = (pt.tone || 'neutral').toString().trim();
    const style = (pt.style || 'short answers').toString().trim();
    const extra = (pt.instruction || '').toString().trim();

    let section = '\n🎯 CRITICAL PERSONAL TOUCH ENFORCEMENT (MUST FOLLOW)\n';
    if (userNick) {
      section += `- YOU MUST call the user "${userNick}" - use this nickname in EVERY response!\n`;
      section += `- Start responses with "Hey ${userNick}" or "${userNick}," or similar.\n`;
    }
    if (aiNick) {
      section += `- When referring to yourself, use "${aiNick}" instead of "I" or "Wakti".\n`;
    }
    section += `- 🎭 TONE: Be ${tone}. Every response must reflect this tone.\n`;
    section += `- 📝 STYLE: Use ${style} format for all responses.\n`;
    if (extra) section += `- 📌 CUSTOM INSTRUCTION: ${extra}\n`;
    return section;
  }, []);

  // Fetch user's nickname from PersonalTouchManager and voice gender from TTS settings
  useEffect(() => {
    const fetchUserData = () => {
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

      // Get voice gender from Talk Back settings (localStorage)
      try {
        const lsKey = language === 'ar' ? 'wakti_tts_voice_ar' : 'wakti_tts_voice_en';
        const savedVoice = localStorage.getItem(lsKey) || '';
        const femaleVoice = language === 'ar' ? DEFAULT_VOICES.ar.female : DEFAULT_VOICES.en.female;
        const maleVoice = language === 'ar' ? DEFAULT_VOICES.ar.male : DEFAULT_VOICES.en.male;
        
        // Check if it's female voice
        const isFemale = savedVoice === femaleVoice;
        const gender = isFemale ? 'female' : 'male';
        
        console.log('[Talk] Voice gender check:', {
          savedVoice,
          femaleVoice,
          maleVoice,
          isFemale,
          gender
        });
        
        setVoiceGender(gender);
        voiceGenderRef.current = gender;
      } catch (e) {
        console.warn('[Talk] Could not get voice gender:', e);
      }
    };
    fetchUserData();
  }, [language]);

  // Load Personal Touch (nickname, aiNickname, tone, style, instruction)
  useEffect(() => {
    const loadPT = () => {
      try {
        const raw = localStorage.getItem('wakti_personal_touch');
        console.log('[Talk] Loading Personal Touch from localStorage:', raw);
        const parsed = raw ? JSON.parse(raw) : null;
        const pt = parsed && typeof parsed === 'object' ? parsed : null;
        console.log('[Talk] Parsed Personal Touch:', pt);
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
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
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
    setStatus('connecting');
    setMicLevel(0);
    setError(null);
    setIsConnectionReady(false);
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

  const buildMemoryContext = useCallback((lang: string) => {
    const lastTurns = conversationHistoryRef.current.slice(-10);
    const summary = talkSummaryRef.current.trim();

    if (!summary && lastTurns.length === 0) {
      return '';
    }

    const lines = lastTurns.map(t => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.text}`);
    return t(
      `Conversation memory (important):\nSummary so far: ${summary || '(none)'}\nLast 10 turns:\n${lines.join('\n')}`,
      `ذاكرة المحادثة (مهم):\nملخص حتى الآن: ${summary || '(لا يوجد)'}\nآخر 10 رسائل:\n${lines.join('\n')}`
    );
  }, [t]);

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
    setStatus('connecting');
    setError(null);
    setIsConnectionReady(false);

    // Clean up old OpenAI connection
    if (dcRef.current) {
      try { dcRef.current.close(); } catch (e) { /* ignore */ }
      dcRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (e) { /* ignore */ }
      pcRef.current = null;
    }

    try {
      // Get fresh microphone stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Add audio track
      stream.getAudioTracks().forEach(track => {
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
        console.log('[Talk] Data channel open - sending session config (manual turn detection)');
        
        // Use refs to get current values (avoid stale closures)
        const currentUserName = userNameRef.current;
        const currentVoiceGender = voiceGenderRef.current;
        
        // Build personal instructions with user's name - MUST use name in greeting
        const personalTouch = currentUserName ? (language === 'ar' 
          ? `أنت تتحدث مع ${currentUserName}. يجب أن تستخدم اسمه "${currentUserName}" في ردك الأول وأحياناً في الردود الأخرى.`
          : `You are talking to ${currentUserName}. You MUST use their name "${currentUserName}" in your first response and occasionally in other responses.`
        ) : '';
        
        const waktiQuickRules = t(
          `WAKTI quick rules (app questions):
1) When asked "what is Wakti": answer friendly and mention Help & Guides has 3 tabs: Guides, my little brother Wakti Help Assistant, and Support.
2) When asked "who made Wakti": say it was made by TMW (The Modern Web) in Doha, Qatar (tmw.qa).
3) When asked "what can Wakti do": give a short list of key capabilities (tasks/events/voice tools/AI chat+search+content) then point to Help & Guides.
4) IMPORTANT - Web Search: You CANNOT browse the internet in Talk mode. If user asks you to search something, tell them: "I can't browse the web in Talk mode. Tap the Search toggle above, then ask me again and I'll search for real." Never pretend you searched.`,
          `قواعد WAKTI السريعة (عند السؤال عن التطبيق):
1) عندما يسأل المستخدم "ما هو وقتي" أو سؤال مشابه: أجب بطريقة ودية واذكر أن "المساعدة والأدلة" فيها 3 تبويبات: الأدلة، مساعد وقتي الصغير، والدعم.
2) عندما يسأل "من صنع وقتي" أو "من عمل وقتي": قل أنه تم تطويره بواسطة TMW (The Modern Web) في الدوحة، قطر (tmw.qa).
3) عندما يسأل "ماذا يمكن لوقتي أن يفعل" أو "وش يسوي وقتي": أعطِ قائمة قصيرة بأهم القدرات (مهام/فعاليات/أدوات صوت/دردشة وبحث وذكاء) ثم وجّه للمساعدة والأدلة.
4) مهم - البحث: لا يمكنك تصفح الإنترنت في وضع المحادثة. إذا طلب المستخدم البحث، قل له: "لا أستطيع البحث في وضع المحادثة. اضغط على زر البحث في الأعلى، ثم اسألني مرة أخرى وسأبحث فعلاً." لا تتظاهر أبداً بأنك بحثت.`
        );

        const memoryContext = buildMemoryContext(language);
        const personalTouchSection = buildPersonalTouchSection();

        const instructions = t(
          `You are WAKTI, a smart voice assistant. ${personalTouch}

Style rules (important):
- Always start with the direct answer (1-2 lines).
- Then: max 2-6 lines.
- Use bullet points for features/steps.
- Don’t ramble or repeat.

${waktiQuickRules}
${personalTouchSection}

${memoryContext ? memoryContext : ''}`,
          `أنت مساعد WAKTI الصوتي الذكي. ${personalTouch}

قواعد أسلوب (مهم):
- ابدأ دائماً بإجابة مباشرة (سطر أو سطرين).
- بعد ذلك: 2 إلى 6 أسطر كحد أقصى.
- استخدم نقاط عند ذكر ميزات أو خطوات.
- لا تطوّل ولا تكرر.

${waktiQuickRules}
${personalTouchSection}

${memoryContext ? memoryContext : ''}`
        );
        
        // Select OpenAI Realtime voice based on Talk Back settings
        // Valid voices: alloy, ash, ballad, coral, echo, sage, shimmer, verse, mann, cedar
        // male=echo (deep), female=shimmer (expressive)
        const openaiVoice = currentVoiceGender === 'female' ? 'shimmer' : 'echo';
        console.log('[Talk] Instructions:', instructions);
        console.log('[Talk] User name:', currentUserName, '| Voice:', openaiVoice, '(gender:', currentVoiceGender, ')');
        
        // Use manual turn detection (null) - we control when to commit with hold-to-talk
        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            type: 'realtime',
            instructions,
            voice: openaiVoice,
            input_audio_transcription: { model: 'whisper-1' },
            turn_detection: null, // Manual - we control when user finishes speaking
          }
        }));
        
        setIsConnectionReady(true);
        setStatus('ready');
        
        // Start continuous mic level animation
        startMicLevelAnimation();
      };

      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleRealtimeEvent(msg);
        } catch (e) {
          console.warn('Failed to parse realtime event:', e);
        }
      };

      dc.onerror = (err) => {
        console.error('[Talk] Data channel error:', err);
        setError(language === 'ar' ? 'خطأ في الاتصال' : 'Connection error');
        setIsConnectionReady(false);
      };

      dc.onclose = () => {
        console.log('[Talk] Data channel closed');
        setIsConnectionReady(false);
        // Don't auto-reconnect - connection should stay open with server_vad
        // If it closes, show error and let user close/reopen
        setStatus('connecting');
        setError(language === 'ar' ? 'انقطع الاتصال' : 'Connection lost');
      };

      // Create offer
      await pc.setLocalDescription();
      const offer = pc.localDescription;

      if (!offer) {
        throw new Error('Failed to create SDP offer');
      }

      // Get session token from backend
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      console.log('[Talk] Calling Edge Function for SDP exchange...');
      const response = await supabase.functions.invoke('openai-realtime-session', {
        body: { sdp_offer: offer.sdp, language },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (response.error || !response.data?.sdp_answer) {
        throw new Error(response.error?.message || 'Failed to get SDP answer');
      }

      console.log('[Talk] Got SDP answer, setting remote description...');
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: response.data.sdp_answer,
      });

      // Connection will be ready when dc.onopen fires

    } catch (err) {
      console.error('[Talk] Failed to initialize connection:', err);
      setError(language === 'ar' ? 'فشل الاتصال' : 'Connection failed');
      setStatus('ready');
      setIsConnectionReady(false);
    }
  }, [buildMemoryContext, buildPersonalTouchSection, language, startMicLevelAnimation, t]);

  // Initialize connection when Talk bubble opens or engine changes
  useEffect(() => {
    if (isOpen) {
      // Small delay to allow userName fetch to complete
      const timer = setTimeout(() => {
        initializeConnection();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      cleanup();
    }
    return () => cleanup();
  }, [isOpen, initializeConnection, cleanup]);

  // Handle realtime events from OpenAI
  const handleRealtimeEvent = useCallback((msg: any) => {
    console.log('[Talk] Realtime event:', msg.type, msg);
    switch (msg.type) {
      case 'session.created':
        console.log('[Talk] Session created');
        break;
      case 'session.updated':
        console.log('[Talk] Session updated - ready for hold-to-talk');
        break;
      case 'input_audio_buffer.committed':
        // Audio buffer committed
        console.log('[Talk] Audio committed');
        break;
      case 'conversation.item.input_audio_transcription.completed':
        // User's speech transcribed
        const transcript = msg.transcript?.trim() || '';
        setLiveTranscript(transcript);
        
        // Only proceed if user actually said something (not empty/silence)
        if (transcript.length > 0) {
          setConversationHistory(prev => {
            const next = [...prev, { role: 'user' as const, text: transcript }];
            conversationHistoryRef.current = next;
            return next;
          });
          
          // If in search mode, perform web search then respond
          if (searchModeRef.current) {
            console.log('[Talk] Search mode active - performing web search for:', transcript);
            pendingTranscriptRef.current = transcript;
            
            // Clean the transcript for better search results (removes filler words)
            const cleanedQuery = cleanSearchQuery(transcript);
            
            // Perform search and then send response with results
            performWebSearch(cleanedQuery).then((searchContext) => {
              console.log('[Talk] Search complete, sending response with context');
              sendResponseCreate(searchContext, transcript);
              
              // Auto-reset search mode after one use (A2 behavior)
              setSearchMode(false);
              searchModeRef.current = false;
            });
          } else {
            // Talk mode - respond normally (transcript already validated as non-empty)
            console.log('[Talk] Talk mode - sending response for:', transcript);
            sendResponseCreate(undefined, transcript);
          }
        } else {
          // User didn't say anything - go back to ready without responding
          console.log('[Talk] Empty transcript - user did not speak, skipping response');
          setStatus('ready');
        }
        break;
      case 'response.audio_transcript.delta':
        // AI speaking - partial transcript (accumulate)
        setStatus('speaking');
        if (msg.delta) {
          setAiTranscript(prev => prev + msg.delta);
        }
        break;
      case 'response.audio_transcript.done':
        // AI finished speaking - full transcript
        if (msg.transcript) {
          setAiTranscript(msg.transcript);
          setConversationHistory(prev => {
            const next = [...prev, { role: 'assistant' as const, text: String(msg.transcript) }];
            conversationHistoryRef.current = next;
            return next;
          });

          // Update rolling summary (simple, safe heuristic)
          setTalkSummary(prev => {
            const compact = (s: string) => s.replace(/\s+/g, ' ').trim();
            const entry = compact(String(msg.transcript));
            const base = compact(prev);
            const merged = base ? `${base} | ${entry}` : entry;
            const limited = merged.length > 1200 ? merged.slice(merged.length - 1200) : merged;
            talkSummaryRef.current = limited;
            return limited;
          });
        }
        break;
      case 'response.done':
        console.log('[Talk] Response complete - ready for next turn');
        setStatus('ready');
        setError(null); // Clear any timeout error
        break;
      case 'error':
        console.error('[Talk] Realtime error:', msg);
        // Handle specific errors gracefully
        if (msg.error?.message?.includes('active response')) {
          console.log('[Talk] Waiting for active response to complete...');
        } else if (msg.error?.message?.includes('buffer too small')) {
          // Not enough audio detected - just go back to ready
          console.log('[Talk] Buffer too small - waiting for more speech');
          setStatus('ready');
        } else {
          setError(msg.error?.message || 'Realtime error');
          setStatus('ready');
        }
        break;
      default:
        break;
    }
  }, []);

  // Perform web search using live-talk-search Edge Function
  const performWebSearch = useCallback(async (query: string): Promise<string> => {
    try {
      console.log('[Talk] Performing web search for:', query);
      setIsSearching(true);
      
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      const response = await supabase.functions.invoke('live-talk-search', {
        body: { query, language },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      
      if (response.error || !response.data?.success) {
        console.error('[Talk] Search failed:', response.error || response.data?.error);
        return t(
          'Search failed. Please try again.',
          'فشل البحث. يرجى المحاولة مرة أخرى.'
        );
      }
      
      console.log('[Talk] Search results:', response.data);
      return response.data.context || t('No results found.', 'لم يتم العثور على نتائج.');
    } catch (err) {
      console.error('[Talk] Search error:', err);
      return t('Search error occurred.', 'حدث خطأ في البحث.');
    } finally {
      setIsSearching(false);
    }
  }, [language, t]);

  // Send response.create with optional search context
  const sendResponseCreate = useCallback((searchContext?: string, userUtterance?: string) => {
    if (!dcRef.current || dcRef.current.readyState !== 'open') {
      console.warn('[Talk] Data channel not open, cannot send response.create');
      setError(language === 'ar' ? 'فشل الاتصال' : 'Connection failed');
      setStatus('ready');
      return;
    }

    try {
      const currentUserName = userNameRef.current;
      const personalTouch = currentUserName ? (language === 'ar'
        ? `أنت تتحدث مع ${currentUserName}. يجب أن تستخدم اسمه "${currentUserName}" في ردك الأول وأحياناً في الردود الأخرى.`
        : `You are talking to ${currentUserName}. You MUST use their name "${currentUserName}" in your first response and occasionally in other responses.`
      ) : '';

      const personalTouchSection = buildPersonalTouchSection();

      // If we have search context, use special search instructions
      const searchInstructions = searchContext ? t(
        `\n\nWEB SEARCH RESULTS (use these to answer the user's question):\n${searchContext}\n\nIMPORTANT: Base your answer on the search results above. Cite sources when relevant.\nAfter you finish the answer, add a short friendly note: "For advanced search, try Search mode in Wakti AI."`,
        `\n\nنتائج البحث على الويب (استخدمها للإجابة على سؤال المستخدم):\n${searchContext}\n\nمهم: بني إجابتك على نتائج البحث أعلاه. اذكر المصادر عند الحاجة.\nبعد أن تنهي الإجابة، أضف ملاحظة ودية قصيرة: \"للبحث المتقدم، جرّب وضع البحث في Wakti AI.\"`
      ) : '';

      const waktiQuickRules = searchContext ? '' : t(
        `WAKTI quick rules (app questions):
1) When asked "what is Wakti": answer friendly and mention Help & Guides has 3 tabs: Guides, my little brother Wakti Help Assistant, and Support.
2) When asked "who made Wakti": say it was made by TMW (The Modern Web) in Doha, Qatar (tmw.qa).
3) When asked "what can Wakti do": give a short list of key capabilities (tasks/events/voice tools/AI chat+search+content) then point to Help & Guides.
4) IMPORTANT - Web Search: You CANNOT browse the internet in Talk mode. If user asks you to search something, tell them: "I can't browse the web in Talk mode. Tap the Search toggle above, then ask me again and I'll search for real." Never pretend you searched.`,
        `قواعد WAKTI السريعة (عند السؤال عن التطبيق):
1) عندما يسأل المستخدم "ما هو وقتي" أو سؤال مشابه: أجب بطريقة ودية واذكر أن "المساعدة والأدلة" فيها 3 تبويبات: الأدلة، مساعد وقتي الصغير، والدعم.
2) عندما يسأل "من صنع وقتي" أو "من عمل وقتي": قل أنه تم تطويره بواسطة TMW (The Modern Web) في الدوحة، قطر (tmw.qa).
3) عندما يسأل "ماذا يمكن لوقتي أن يفعل" أو "وش يسوي وقتي": أعطِ قائمة قصيرة بأهم القدرات (مهام/فعاليات/أدوات صوت/دردشة وبحث وذكاء) ثم وجّه للمساعدة والأدلة.
4) مهم - البحث: لا يمكنك تصفح الإنترنت في وضع المحادثة. إذا طلب المستخدم البحث، قل له: "لا أستطيع البحث في وضع المحادثة. اضغط على زر البحث في الأعلى، ثم اسألني مرة أخرى وسأبحث فعلاً." لا تتظاهر أبداً بأنك بحثت.`
      );

      const memoryContext = buildMemoryContext(language);

      let followUpContext = '';
      const u = (userUtterance || '').trim();
      if (u) {
        const isShort = u.length <= 20;
        const isAmbiguousFollowup = /^(since when|when\?|since\?|why\?|how\?|what\?|which\?|who\?)$/i.test(u);
        if (isShort || isAmbiguousFollowup) {
          const lastAssistant = [...conversationHistoryRef.current].reverse().find(x => x.role === 'assistant')?.text || '';
          if (lastAssistant) {
            const clipped = lastAssistant.length > 500 ? `${lastAssistant.slice(0, 500)}...` : lastAssistant;
            followUpContext = t(
              `\n\nFollow-up context (important): The user's short follow-up "${u}" refers to the previous assistant message:\n${clipped}`,
              `\n\nسياق المتابعة (مهم): سؤال المستخدم القصير "${u}" يشير إلى رسالة المساعد السابقة:\n${clipped}`
            );
          }
        }
      }

      const refreshedInstructions = t(
        `You are WAKTI, a smart voice assistant. ${personalTouch}

Style rules (important):
- Always start with the direct answer (1-2 lines).
- Then: max 2-6 lines.
- Use bullet points for features/steps.
- Don't ramble or repeat.

${waktiQuickRules}${searchInstructions}${followUpContext}

${personalTouchSection}

${memoryContext ? memoryContext : ''}`,
        `أنت مساعد WAKTI الصوتي الذكي. ${personalTouch}

قواعد أسلوب (مهم):
- ابدأ دائماً بإجابة مباشرة (سطر أو سطرين).
- بعد ذلك: 2 إلى 6 أسطر كحد أقصى.
- استخدم نقاط عند ذكر ميزات أو خطوات.
- لا تطوّل ولا تكرر.

${waktiQuickRules}${searchInstructions}${followUpContext}

${personalTouchSection}

${memoryContext ? memoryContext : ''}`
      );

      dcRef.current.send(JSON.stringify({
        type: 'session.update',
        session: {
          instructions: refreshedInstructions,
        }
      }));
    } catch (e) {
      console.warn('[Talk] Failed to inject instructions before response:', e);
    }

    dcRef.current.send(JSON.stringify({ type: 'response.create' }));
  }, [buildMemoryContext, buildPersonalTouchSection, language, t]);

  // Stop recording and send to AI (defined first so startRecording can reference it)
  const stopRecording = useCallback(() => {
    // Guard against multiple calls
    if (isStoppingRef.current) {
      return;
    }
    isStoppingRef.current = true;

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    // Check minimum hold duration (at least 0.5 seconds to avoid accidental taps)
    const holdDuration = Date.now() - holdStartRef.current;
    const MIN_HOLD_MS = 500; // 0.5 seconds minimum
    
    if (holdDuration < MIN_HOLD_MS) {
      console.log('[Talk] Hold too short (' + holdDuration + 'ms), ignoring');
      setIsHolding(false);
      isHoldingRef.current = false;
      setStatus('ready');
      // Clear the audio buffer to prevent accumulated audio
      if (dcRef.current && dcRef.current.readyState === 'open') {
        dcRef.current.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
      }
      setTimeout(() => { isStoppingRef.current = false; }, 300);
      return;
    }

    setIsHolding(false);
    isHoldingRef.current = false;
    setStatus('processing');

    // Send input_audio_buffer.commit to finalize
    if (dcRef.current && dcRef.current.readyState === 'open') {
      console.log('[Talk] Sending commit. HoldDuration:', holdDuration, 'ms. SearchMode:', searchModeRef.current);
      dcRef.current.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
      
      // Both Talk and Search modes now wait for transcript event before responding
      // This allows us to check if user actually spoke (non-empty transcript)
      // Response is triggered in handleRealtimeEvent for 'conversation.item.input_audio_transcription.completed'
    } else {
      console.warn('[Talk] Data channel not open, cannot send commit');
      setError(language === 'ar' ? 'فشل الاتصال' : 'Connection failed');
      setStatus('ready');
    }

    // Reset guard after short delay to allow next recording
    setTimeout(() => {
      isStoppingRef.current = false;
    }, 1000);

    // Timeout fallback: if still processing/speaking after 30s, reset
    setTimeout(() => {
      setStatus((prev) => {
        if (prev === 'processing' || prev === 'speaking') {
          console.warn('[Talk] Response timeout, resetting to ready');
          setError(language === 'ar' ? 'انتهت المهلة' : 'Response timeout');
          return 'ready';
        }
        return prev;
      });
    }, 30000); // Increased to 30s to allow for longer responses
  }, [language, sendResponseCreate]);

  // Start recording when user holds
  const startRecording = useCallback(() => {
    if (!isConnectionReady || !dcRef.current || dcRef.current.readyState !== 'open') {
      console.warn('[Talk] Cannot start recording - connection not ready');
      setError(language === 'ar' ? 'الاتصال غير جاهز' : 'Connection not ready');
      return;
    }

    // Reset the stopping guard when starting a new recording
    isStoppingRef.current = false;

    dcRef.current?.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
    console.log('[Talk] Cleared audio buffer for fresh recording');

    setError(null);
    setStatus('listening');
    setLiveTranscript('');
    pendingTranscriptRef.current = ''; // Clear pending transcript
    setAiTranscript(''); // Clear previous AI response
    setCountdown(MAX_RECORD_SECONDS);
    holdStartRef.current = Date.now();

    // Start countdown
    countdownIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - holdStartRef.current) / 1000);
      const remaining = Math.max(0, MAX_RECORD_SECONDS - elapsed);
      setCountdown(remaining);
      if (remaining <= 0) {
        stopRecording();
      }
    }, 200);
  }, [isConnectionReady, isHolding, language, stopRecording]);

  // Hold handlers
  const handleHoldStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (status === 'ready' && isConnectionReady) {
      setError(null);
      setIsHolding(true);
      isHoldingRef.current = true; // Update ref for audio processor callback
      startRecording();
    }
  }, [status, isConnectionReady, startRecording]);

  const handleHoldEnd = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (isHolding) {
      stopRecording();
    }
  }, [isHolding, stopRecording]);

  if (!isOpen) return null;

  const statusText: Record<typeof status, string> = {
    connecting: language === 'ar' ? 'جارٍ الاتصال...' : 'Connecting...',
    ready: language === 'ar' ? 'اضغط مع الاستمرار للتحدث' : 'Hold to talk',
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
          onClick={onClose}
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
            onMouseDown={handleHoldStart}
            onMouseUp={handleHoldEnd}
            onMouseLeave={handleHoldEnd}
            onTouchStart={handleHoldStart}
            onTouchEnd={handleHoldEnd}
            onContextMenu={(e) => e.preventDefault()}
            disabled={!isConnectionReady || status === 'processing' || status === 'speaking' || status === 'connecting'}
            className="voice-orb"
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
          {t('Press and hold to speak, release to send', 'اضغط مع الاستمرار للتحدث، ثم اتركه للإرسال')}
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
            <div className="leading-snug max-h-[2.6em] overflow-y-auto overscroll-contain">
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

        {/* End button */}
        <button
          onClick={() => {
            conversationHistory.forEach(item => {
              if (item.role === 'user') {
                onUserMessage(item.text);
              } else {
                onAssistantMessage(item.text);
              }
            });
            onClose();
          }}
          className={`mt-2 px-10 py-3 rounded-full text-lg font-medium transition-colors select-none ${theme === 'dark' ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-black/10 hover:bg-black/20 text-[#060541]'}`}
        >
          {t('End', 'إنهاء')}
        </button>
      </div>
    </div>
  );
}
