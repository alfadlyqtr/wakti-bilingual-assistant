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

  // Use refs for values needed in callbacks to avoid stale closures
  const userNameRef = useRef<string>('');
  const voiceGenderRef = useRef<'male' | 'female'>('male');

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
  }, []);

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
        
        const waktiInfo = language === 'ar'
          ? `عندما يسأل المستخدم "ما هو وقتي" أو أسئلة مشابهة: أجب بطريقة ودية: "بالتأكيد! وقتي هو تطبيق ذكاء اصطناعي شامل للإنتاجية. مصمم ليكون سهل الاستخدام ومتكيف مع احتياجاتك. للحصول على أدلة خطوة بخطوة، افتح المساعدة والأدلة - هناك 3 تبويبات: الأدلة، مساعد وقتي الصغير الذي سيشرح لك كل شيء، وتبويب الدعم للتواصل معنا."`
          : `When asked "what is Wakti" or similar: Respond friendly: "Sure${currentUserName ? ', ' + currentUserName : ''}! Wakti AI is your all-in-one productivity AI app. It's built to be user-friendly and adaptable to your needs. For step-by-step guides, open Help & Guides - there are 3 tabs: Guides (like mini documents), my little brother Wakti Help Assistant who will walk you through everything if you don't feel like reading, and a Support tab to get in touch with us directly."`;
        
        const instructions = language === 'ar'
          ? `أنت مساعد Wakti الصوتي الذكي. ${personalTouch} أجب بإيجاز ووضوح. تحدث بالعربية. كن ودودًا ومفيدًا وطبيعياً. أجب كأنك صديق يساعد. ${waktiInfo}`
          : `You are Wakti, a smart voice assistant. ${personalTouch} Answer concisely and clearly. Be friendly, helpful, and natural. Respond like a helpful friend. ${waktiInfo}`;
        
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
          setConversationHistory(prev => [...prev, { role: 'user', text: msg.transcript }]);
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
          setConversationHistory(prev => [...prev, { role: 'assistant', text: msg.transcript }]);
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
  }, [language]);

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
        className="absolute top-4 right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
        aria-label="Close"
      >
        <X className="w-7 h-7 text-white" />
      </button>

      <div className="flex flex-col items-center gap-5 p-6">
        {/* Siri-style animated orb with CSS animations */}
        <div className={`siri-orb-container ${status === 'listening' ? 'listening' : ''} ${status === 'speaking' ? 'speaking' : ''}`}>
          <div className="siri-orb">
            <div className="siri-orb-gradient"></div>
            <div className="siri-orb-highlight"></div>
            <div className="siri-orb-shine"></div>
          </div>
          <div className="siri-glow"></div>
        </div>
        
        {/* Siri orb CSS animations */}
        <style>{`
          .siri-orb-container {
            position: relative;
            width: 140px;
            height: 140px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .siri-orb {
            position: relative;
            width: 120px;
            height: 120px;
            border-radius: 50%;
            overflow: hidden;
            animation: siriFloat 4s ease-in-out infinite;
          }
          
          .siri-orb-gradient {
            position: absolute;
            inset: -50%;
            background: conic-gradient(
              from 0deg,
              hsl(200, 100%, 60%),
              hsl(260, 90%, 65%),
              hsl(320, 85%, 60%),
              hsl(280, 80%, 55%),
              hsl(210, 100%, 65%),
              hsl(200, 100%, 60%)
            );
            animation: siriRotate 6s linear infinite;
            filter: blur(8px);
          }
          
          .siri-orb-highlight {
            position: absolute;
            inset: 0;
            border-radius: 50%;
            background: radial-gradient(
              ellipse 60% 40% at 30% 25%,
              rgba(255, 255, 255, 0.8) 0%,
              rgba(255, 255, 255, 0.2) 30%,
              transparent 60%
            );
            animation: siriHighlight 3s ease-in-out infinite;
          }
          
          .siri-orb-shine {
            position: absolute;
            inset: 0;
            border-radius: 50%;
            background: radial-gradient(
              circle at 70% 70%,
              rgba(255, 100, 200, 0.4) 0%,
              transparent 50%
            );
            animation: siriShine 4s ease-in-out infinite reverse;
          }
          
          .siri-glow {
            position: absolute;
            inset: -20px;
            border-radius: 50%;
            background: radial-gradient(
              circle,
              hsla(280, 90%, 65%, 0.4) 0%,
              hsla(210, 100%, 60%, 0.2) 40%,
              transparent 70%
            );
            animation: siriGlow 3s ease-in-out infinite;
            filter: blur(15px);
          }
          
          /* Listening state - more active */
          .siri-orb-container.listening .siri-orb {
            animation: siriFloat 1.5s ease-in-out infinite, siriBounce 0.3s ease-in-out infinite;
          }
          .siri-orb-container.listening .siri-orb-gradient {
            animation: siriRotate 2s linear infinite;
          }
          .siri-orb-container.listening .siri-glow {
            animation: siriGlowActive 0.5s ease-in-out infinite;
          }
          
          /* Speaking state - pulsing */
          .siri-orb-container.speaking .siri-orb {
            animation: siriSpeak 0.8s ease-in-out infinite;
          }
          .siri-orb-container.speaking .siri-glow {
            animation: siriGlowSpeak 0.8s ease-in-out infinite;
          }
          
          @keyframes siriRotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          
          @keyframes siriFloat {
            0%, 100% { transform: scale(1) translateY(0); }
            50% { transform: scale(1.03) translateY(-3px); }
          }
          
          @keyframes siriBounce {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.08); }
          }
          
          @keyframes siriHighlight {
            0%, 100% { opacity: 0.8; transform: translateX(0) translateY(0); }
            33% { opacity: 1; transform: translateX(5px) translateY(-3px); }
            66% { opacity: 0.9; transform: translateX(-3px) translateY(2px); }
          }
          
          @keyframes siriShine {
            0%, 100% { opacity: 0.6; transform: translateX(0) translateY(0); }
            50% { opacity: 1; transform: translateX(-5px) translateY(-5px); }
          }
          
          @keyframes siriGlow {
            0%, 100% { opacity: 0.6; transform: scale(1); }
            50% { opacity: 0.9; transform: scale(1.1); }
          }
          
          @keyframes siriGlowActive {
            0%, 100% { opacity: 0.7; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.2); }
          }
          
          @keyframes siriSpeak {
            0%, 100% { transform: scale(1); }
            25% { transform: scale(1.05); }
            50% { transform: scale(0.98); }
            75% { transform: scale(1.03); }
          }
          
          @keyframes siriGlowSpeak {
            0%, 100% { opacity: 0.6; transform: scale(1); }
            25% { opacity: 1; transform: scale(1.15); }
            50% { opacity: 0.7; transform: scale(1.05); }
            75% { opacity: 0.9; transform: scale(1.2); }
          }
        `}</style>

        {/* Status text */}
        <div className="text-lg text-white/80">
          {statusText[status]}
        </div>

        {/* User transcript (what you said) */}
        {liveTranscript && (
          <div className="max-w-xs text-center text-sm text-white/60 italic">
            <span className="text-white/40 text-xs block mb-1">{language === 'ar' ? 'أنت:' : 'You:'}</span>
            "{liveTranscript}"
          </div>
        )}

        {/* AI transcript (what AI said) */}
        {aiTranscript && status !== 'listening' && (
          <div className="max-w-xs text-center text-sm text-blue-300/80">
            <span className="text-blue-300/50 text-xs block mb-1">{language === 'ar' ? 'واكتي:' : 'Wakti:'}</span>
            "{aiTranscript}"
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Countdown when recording */}
        {isHolding && (
          <div className="text-2xl font-bold text-white tabular-nums">
            {countdown}s
          </div>
        )}

        {/* Hold to talk button */}
        <button
          onMouseDown={handleHoldStart}
          onMouseUp={handleHoldEnd}
          onMouseLeave={handleHoldEnd}
          onTouchStart={handleHoldStart}
          onTouchEnd={handleHoldEnd}
          onContextMenu={(e) => e.preventDefault()}
          disabled={!isConnectionReady || status === 'processing' || status === 'speaking' || status === 'connecting'}
          className={`
            flex items-center justify-center w-20 h-20 rounded-full transition-all duration-150
            select-none touch-none
            ${isHolding 
              ? 'bg-red-500 scale-110 shadow-lg shadow-red-500/50' 
              : 'bg-white/20 hover:bg-white/30 active:scale-95'}
            ${(!isConnectionReady || status === 'processing' || status === 'speaking' || status === 'connecting') ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
          aria-label={statusText[status]}
        >
          <Mic className={`w-8 h-8 ${isHolding ? 'text-white' : 'text-white/80'} pointer-events-none`} />
        </button>

        {/* Waveform bars - show when holding/listening */}
        {isHolding && (
          <div className="flex items-end gap-1 h-8">
            {[...Array(7)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-white/60 rounded-full transition-all duration-75"
                style={{
                  height: `${8 + Math.random() * micLevel * 24}px`,
                }}
              />
            ))}
          </div>
        )}

        {/* Instruction text */}
        <p className="text-xs text-white/50 text-center max-w-[200px]">
          {language === 'ar' 
            ? 'اضغط مع الاستمرار للتحدث، ثم اتركه للإرسال'
            : 'Press and hold to speak, release to send'}
        </p>

        {/* End button - easier to reach on mobile than X in corner */}
        <button
          onClick={() => {
            // Save conversation to chat before closing
            conversationHistory.forEach(item => {
              if (item.role === 'user') {
                onUserMessage(item.text);
              } else {
                onAssistantMessage(item.text);
              }
            });
            onClose();
          }}
          className="mt-4 px-8 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white/80 text-base font-medium transition-colors"
        >
          {language === 'ar' ? 'إنهاء' : 'End'}
        </button>
      </div>
    </div>
  );
}
