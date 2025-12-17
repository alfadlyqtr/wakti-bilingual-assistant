import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Mic } from 'lucide-react';
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

export function TalkBubble({ isOpen, onClose, onUserMessage, onAssistantMessage }: TalkBubbleProps) {
  const { language } = useTheme();
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

  // Use refs for values needed in callbacks to avoid stale closures
  const userNameRef = useRef<string>('');
  const voiceGenderRef = useRef<'male' | 'female'>('male');
  const conversationHistoryRef = useRef<{role: 'user' | 'assistant', text: string}[]>([]);
  const talkSummaryRef = useRef<string>('');

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

  // Initialize connection when Talk bubble opens - wait a bit for userName to be fetched
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
  }, [isOpen]);

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
    setAiTranscript('');
    setConversationHistory([]);
    conversationHistoryRef.current = [];
    setTalkSummary('');
    talkSummaryRef.current = '';
  }, []);

  const buildMemoryContext = useCallback((lang: string) => {
    const lastTurns = conversationHistoryRef.current.slice(-4);
    const summary = talkSummaryRef.current.trim();

    if (!summary && lastTurns.length === 0) {
      return '';
    }

    const lines = lastTurns.map(t => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.text}`);
    return t(
      `Conversation memory (important):\nSummary so far: ${summary || '(none)'}\nLast 4 turns:\n${lines.join('\n')}`,
      `ذاكرة المحادثة (مهم):\nملخص حتى الآن: ${summary || '(لا يوجد)'}\nآخر 4 رسائل:\n${lines.join('\n')}`
    );
  }, [t]);

  // Initialize WebRTC connection when bubble opens
  const initializeConnection = useCallback(async () => {
    setStatus('connecting');
    setError(null);
    setIsConnectionReady(false);

    // Clean up old connection first
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
3) When asked "what can Wakti do": give a short list of key capabilities (tasks/events/voice tools/AI chat+search+content) then point to Help & Guides.`,
          `قواعد WAKTI السريعة (عند السؤال عن التطبيق):
1) عندما يسأل المستخدم "ما هو وقتي" أو سؤال مشابه: أجب بطريقة ودية واذكر أن "المساعدة والأدلة" فيها 3 تبويبات: الأدلة، مساعد وقتي الصغير، والدعم.
2) عندما يسأل "من صنع وقتي" أو "من عمل وقتي": قل أنه تم تطويره بواسطة TMW (The Modern Web) في الدوحة، قطر (tmw.qa).
3) عندما يسأل "ماذا يمكن لوقتي أن يفعل" أو "وش يسوي وقتي": أعطِ قائمة قصيرة بأهم القدرات (مهام/فعاليات/أدوات صوت/دردشة وبحث وذكاء) ثم وجّه للمساعدة والأدلة.`
        );

        const memoryContext = buildMemoryContext(language);

        const instructions = t(
          `You are WAKTI, a smart voice assistant. ${personalTouch}

Style rules (important):
- Always start with the direct answer (1-2 lines).
- Then: max 2-6 lines.
- Use bullet points for features/steps.
- Don’t ramble or repeat.

${waktiQuickRules}

${memoryContext ? memoryContext : ''}`,
          `أنت مساعد WAKTI الصوتي الذكي. ${personalTouch}

قواعد أسلوب (مهم):
- ابدأ دائماً بإجابة مباشرة (سطر أو سطرين).
- بعد ذلك: 2 إلى 6 أسطر كحد أقصى.
- استخدم نقاط عند ذكر ميزات أو خطوات.
- لا تطوّل ولا تكرر.

${waktiQuickRules}

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
  }, [language, userName, voiceGender]);

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
        if (msg.transcript) {
          setLiveTranscript(msg.transcript);
          setConversationHistory(prev => {
            const next = [...prev, { role: 'user' as const, text: String(msg.transcript) }];
            conversationHistoryRef.current = next;
            return next;
          });
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
            const limited = merged.length > 320 ? merged.slice(merged.length - 320) : merged;
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

    setIsHolding(false);
    setStatus('processing');

    // Send input_audio_buffer.commit to finalize and request response
    if (dcRef.current && dcRef.current.readyState === 'open') {
      console.log('[Talk] Sending commit and response.create');
      // Inject memory right before creating a response (Option B: summary + last 4 turns)
      try {
        const currentUserName = userNameRef.current;
        const personalTouch = currentUserName ? (language === 'ar'
          ? `أنت تتحدث مع ${currentUserName}. يجب أن تستخدم اسمه "${currentUserName}" في ردك الأول وأحياناً في الردود الأخرى.`
          : `You are talking to ${currentUserName}. You MUST use their name "${currentUserName}" in your first response and occasionally in other responses.`
        ) : '';

        const waktiQuickRules = t(
          `WAKTI quick rules (app questions):
1) When asked "what is Wakti": answer friendly and mention Help & Guides has 3 tabs: Guides, my little brother Wakti Help Assistant, and Support.
2) When asked "who made Wakti": say it was made by TMW (The Modern Web) in Doha, Qatar (tmw.qa).
3) When asked "what can Wakti do": give a short list of key capabilities (tasks/events/voice tools/AI chat+search+content) then point to Help & Guides.`,
          `قواعد WAKTI السريعة (عند السؤال عن التطبيق):
1) عندما يسأل المستخدم "ما هو وقتي" أو سؤال مشابه: أجب بطريقة ودية واذكر أن "المساعدة والأدلة" فيها 3 تبويبات: الأدلة، مساعد وقتي الصغير، والدعم.
2) عندما يسأل "من صنع وقتي" أو "من عمل وقتي": قل أنه تم تطويره بواسطة TMW (The Modern Web) في الدوحة، قطر (tmw.qa).
3) عندما يسأل "ماذا يمكن لوقتي أن يفعل" أو "وش يسوي وقتي": أعطِ قائمة قصيرة بأهم القدرات (مهام/فعاليات/أدوات صوت/دردشة وبحث وذكاء) ثم وجّه للمساعدة والأدلة.`
        );

        const memoryContext = buildMemoryContext(language);

        const refreshedInstructions = t(
          `You are WAKTI, a smart voice assistant. ${personalTouch}

Style rules (important):
- Always start with the direct answer (1-2 lines).
- Then: max 2-6 lines.
- Use bullet points for features/steps.
- Don’t ramble or repeat.

${waktiQuickRules}

${memoryContext ? memoryContext : ''}`,
          `أنت مساعد WAKTI الصوتي الذكي. ${personalTouch}

قواعد أسلوب (مهم):
- ابدأ دائماً بإجابة مباشرة (سطر أو سطرين).
- بعد ذلك: 2 إلى 6 أسطر كحد أقصى.
- استخدم نقاط عند ذكر ميزات أو خطوات.
- لا تطوّل ولا تكرر.

${waktiQuickRules}

${memoryContext ? memoryContext : ''}`
        );

        dcRef.current.send(JSON.stringify({
          type: 'session.update',
          session: {
            instructions: refreshedInstructions,
          }
        }));
      } catch (e) {
        console.warn('[Talk] Failed to inject memory before response:', e);
      }
      dcRef.current.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
      dcRef.current.send(JSON.stringify({ type: 'response.create' }));
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
  }, [buildMemoryContext, language, t]);

  // Start recording when user holds
  const startRecording = useCallback(() => {
    if (!isConnectionReady || !dcRef.current || dcRef.current.readyState !== 'open') {
      console.warn('[Talk] Cannot start recording - connection not ready');
      setError(language === 'ar' ? 'الاتصال غير جاهز' : 'Connection not ready');
      return;
    }

    // Reset the stopping guard when starting a new recording
    isStoppingRef.current = false;

    setError(null);
    setStatus('listening');
    setLiveTranscript('');
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
  }, [isConnectionReady, language, stopRecording]);

  // Hold handlers
  const handleHoldStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (status === 'ready' && isConnectionReady) {
      setError(null);
      setIsHolding(true);
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
    <div className="fixed top-0 left-0 right-0 bottom-0 z-[9999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md" style={{ paddingTop: 'env(safe-area-inset-top, 20px)', paddingBottom: 'env(safe-area-inset-bottom, 20px)' }}>
      {/* Hidden audio element for playback */}
      <audio ref={audioRef} autoPlay className="hidden" />

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10 select-none"
        aria-label="Close"
      >
        <X className="w-7 h-7 text-white" />
      </button>

      <div className="flex flex-col items-center gap-6 p-6 select-none">
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
            box-shadow: 
              0 0 60px rgba(123, 47, 247, 0.5),
              0 0 120px rgba(241, 7, 163, 0.3),
              inset 0 0 60px rgba(255, 255, 255, 0.1);
            overflow: visible;
            -webkit-tap-highlight-color: transparent;
            touch-action: none;
            user-select: none;
            -webkit-user-select: none;
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
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
          
          /* Floating plasma blobs */
          .plasma {
            position: absolute;
            border-radius: 50%;
            filter: blur(20px);
            mix-blend-mode: screen;
            pointer-events: none;
          }
          
          .plasma-1 {
            width: 100px;
            height: 100px;
            background: radial-gradient(circle, rgba(0, 212, 255, 0.8) 0%, transparent 70%);
            top: -20px;
            left: -20px;
            animation: plasmaFloat1 6s ease-in-out infinite;
          }
          
          .plasma-2 {
            width: 80px;
            height: 80px;
            background: radial-gradient(circle, rgba(241, 7, 163, 0.8) 0%, transparent 70%);
            bottom: -15px;
            right: -15px;
            animation: plasmaFloat2 5s ease-in-out infinite;
          }
          
          .plasma-3 {
            width: 60px;
            height: 60px;
            background: radial-gradient(circle, rgba(123, 47, 247, 0.9) 0%, transparent 70%);
            top: 50%;
            left: -30px;
            animation: plasmaFloat3 7s ease-in-out infinite;
          }
          
          .plasma-4 {
            width: 70px;
            height: 70px;
            background: radial-gradient(circle, rgba(255, 107, 107, 0.7) 0%, transparent 70%);
            bottom: 20%;
            right: -25px;
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
        <div className="text-xl font-medium text-white/90 select-none">
          {statusText[status]}
        </div>

        {/* Countdown when recording */}
        {isHolding && (
          <div className="text-4xl font-bold text-white tabular-nums select-none">
            {countdown}s
          </div>
        )}

        {/* User transcript (what you said) */}
        {liveTranscript && (
          <div className="max-w-sm text-center text-base text-white/70 select-none">
            <span className="text-white/50 text-sm block mb-1">{t('You:', 'أنت:')}</span>
            "{liveTranscript}"
          </div>
        )}

        {/* AI transcript (what AI said) */}
        {aiTranscript && status !== 'listening' && (
          <div className="max-w-sm text-center text-base text-purple-300/90 select-none">
            <span className="text-purple-300/60 text-sm block mb-1">{t('Wakti:', 'واكتي:')}</span>
            "{aiTranscript}"
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-base text-red-400 font-medium select-none">
            {error}
          </div>
        )}

        {/* Instruction text */}
        <p className="text-sm text-white/60 text-center max-w-[240px] select-none">
          {t('Press and hold to speak, release to send', 'اضغط مع الاستمرار للتحدث، ثم اتركه للإرسال')}
        </p>

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
          className="mt-2 px-10 py-3 rounded-full bg-white/15 hover:bg-white/25 text-white text-lg font-medium transition-colors select-none"
        >
          {t('End', 'إنهاء')}
        </button>
      </div>
    </div>
  );
}
