import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, User, UserRound, X, Volume2, Languages, Loader2 } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface LiveTranslatorProps {
  onBack?: () => void;
}

const MAX_RECORD_SECONDS = 10;

// Complete language list
const TRANSLATION_LANGUAGES = [
  { code: 'en', name: { en: 'English', ar: 'الإنجليزية' } },
  { code: 'ar', name: { en: 'Arabic', ar: 'العربية' } },
  { code: 'af', name: { en: 'Afrikaans', ar: 'الأفريقانية' } },
  { code: 'sq', name: { en: 'Albanian', ar: 'الألبانية' } },
  { code: 'bn', name: { en: 'Bengali', ar: 'البنغالية' } },
  { code: 'eu', name: { en: 'Basque', ar: 'الباسكية' } },
  { code: 'bg', name: { en: 'Bulgarian', ar: 'البلغارية' } },
  { code: 'ca', name: { en: 'Catalan', ar: 'الكاتالونية' } },
  { code: 'zh', name: { en: 'Chinese', ar: 'الصينية' } },
  { code: 'hr', name: { en: 'Croatian', ar: 'الكرواتية' } },
  { code: 'cs', name: { en: 'Czech', ar: 'التشيكية' } },
  { code: 'da', name: { en: 'Danish', ar: 'الدنماركية' } },
  { code: 'nl', name: { en: 'Dutch', ar: 'الهولندية' } },
  { code: 'et', name: { en: 'Estonian', ar: 'الإستونية' } },
  { code: 'tl', name: { en: 'Filipino (Tagalog)', ar: 'الفلبينية (التاغالوغ)' } },
  { code: 'fi', name: { en: 'Finnish', ar: 'الفنلندية' } },
  { code: 'fr', name: { en: 'French', ar: 'الفرنسية' } },
  { code: 'ka', name: { en: 'Georgian', ar: 'الجورجية' } },
  { code: 'de', name: { en: 'German', ar: 'الألمانية' } },
  { code: 'el', name: { en: 'Greek', ar: 'اليونانية' } },
  { code: 'he', name: { en: 'Hebrew', ar: 'العبرية' } },
  { code: 'hi', name: { en: 'Hindi', ar: 'الهندية' } },
  { code: 'hu', name: { en: 'Hungarian', ar: 'المجرية' } },
  { code: 'is', name: { en: 'Icelandic', ar: 'الآيسلندية' } },
  { code: 'id', name: { en: 'Indonesian', ar: 'الإندونيسية' } },
  { code: 'it', name: { en: 'Italian', ar: 'الإيطالية' } },
  { code: 'ja', name: { en: 'Japanese', ar: 'اليابانية' } },
  { code: 'ko', name: { en: 'Korean', ar: 'الكورية' } },
  { code: 'lv', name: { en: 'Latvian', ar: 'اللاتفية' } },
  { code: 'lt', name: { en: 'Lithuanian', ar: 'الليتوانية' } },
  { code: 'lb', name: { en: 'Luxembourgish', ar: 'اللوكسمبورغية' } },
  { code: 'ms', name: { en: 'Malaysian', ar: 'الماليزية' } },
  { code: 'mt', name: { en: 'Maltese', ar: 'المالطية' } },
  { code: 'no', name: { en: 'Norwegian', ar: 'النرويجية' } },
  { code: 'fa', name: { en: 'Persian (Farsi)', ar: 'الفارسية' } },
  { code: 'pl', name: { en: 'Polish', ar: 'البولندية' } },
  { code: 'pt', name: { en: 'Portuguese', ar: 'البرتغالية' } },
  { code: 'ro', name: { en: 'Romanian', ar: 'الرومانية' } },
  { code: 'ru', name: { en: 'Russian', ar: 'الروسية' } },
  { code: 'sr', name: { en: 'Serbian', ar: 'الصربية' } },
  { code: 'sk', name: { en: 'Slovak', ar: 'السلوفاكية' } },
  { code: 'es', name: { en: 'Spanish', ar: 'الإسبانية' } },
  { code: 'sw', name: { en: 'Swahili', ar: 'السواحلية' } },
  { code: 'sv', name: { en: 'Swedish', ar: 'السويدية' } },
  { code: 'th', name: { en: 'Thai', ar: 'التايلاندية' } },
  { code: 'tr', name: { en: 'Turkish', ar: 'التركية' } },
  { code: 'uk', name: { en: 'Ukrainian', ar: 'الأوكرانية' } },
  { code: 'ur', name: { en: 'Urdu', ar: 'الأردية' } },
  { code: 'vi', name: { en: 'Vietnamese', ar: 'الفيتنامية' } }
];

export function LiveTranslator({ onBack }: LiveTranslatorProps) {
  const { language, theme } = useTheme();
  const t = useCallback((en: string, ar: string) => (language === 'ar' ? ar : en), [language]);

  // State
  const [targetLanguage, setTargetLanguage] = useState(() => {
    return localStorage.getItem('wakti_live_translator_target') || 'ar';
  });
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>(() => {
    return (localStorage.getItem('wakti_live_translator_voice') as 'male' | 'female') || 'male';
  });
  const [status, setStatus] = useState<'idle' | 'connecting' | 'ready' | 'listening' | 'processing' | 'speaking'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [countdown, setCountdown] = useState(MAX_RECORD_SECONDS);
  const [userTranscript, setUserTranscript] = useState('');
  const [translatedText, setTranslatedText] = useState('');

  // Refs for OpenAI Realtime (WebRTC)
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const holdStartRef = useRef<number>(0);
  const isStoppingRef = useRef(false);
  const isHoldingRef = useRef(false);
  const targetLanguageRef = useRef(targetLanguage);
  const voiceGenderRef = useRef(voiceGender);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const waitForIceGatheringComplete = useCallback((pc: RTCPeerConnection, timeoutMs = 5000) => {
    return new Promise<void>((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }

      const timeout = window.setTimeout(() => {
        pc.removeEventListener('icegatheringstatechange', onStateChange);
        resolve();
      }, timeoutMs);

      function onStateChange() {
        if (pc.iceGatheringState === 'complete') {
          window.clearTimeout(timeout);
          pc.removeEventListener('icegatheringstatechange', onStateChange);
          resolve();
        }
      }

      pc.addEventListener('icegatheringstatechange', onStateChange);
    });
  }, []);

  // Keep refs in sync
  useEffect(() => {
    targetLanguageRef.current = targetLanguage;
  }, [targetLanguage]);

  useEffect(() => {
    voiceGenderRef.current = voiceGender;
  }, [voiceGender]);

  // Persist preferences
  useEffect(() => {
    localStorage.setItem('wakti_live_translator_target', targetLanguage);
  }, [targetLanguage]);

  useEffect(() => {
    localStorage.setItem('wakti_live_translator_voice', voiceGender);
  }, [voiceGender]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
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
    setStatus('idle');
    setIsHolding(false);
    setError(null);
    setUserTranscript('');
    setTranslatedText('');
  }, []);

  // Initialize OpenAI Realtime connection (WebRTC) - same approach as TalkBubble
  const initializeConnection = useCallback(async () => {
    setStatus('connecting');
    setError(null);
    setUserTranscript('');
    setTranslatedText('');

    // Clean up old connection
    if (dcRef.current) {
      try { dcRef.current.close(); } catch (e) { /* ignore */ }
      dcRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (e) { /* ignore */ }
      pcRef.current = null;
    }

    try {
      console.log('[LiveTranslator] Starting connection...');
      
      // Get fresh microphone stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      console.log('[LiveTranslator] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      console.log('[LiveTranslator] Microphone access granted');

      // Setup analyser for mic level visualization
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch (e) { /* ignore */ }
      }
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      
      // Resume AudioContext for mobile browsers (required for iOS/Android)
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Create RTCPeerConnection
      console.log('[LiveTranslator] Creating RTCPeerConnection...');
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });
      pcRef.current = pc;

      pc.onconnectionstatechange = () => {
        console.log('[LiveTranslator] pc.connectionState:', pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setError(language === 'ar' ? 'انقطع الاتصال' : 'Connection lost');
          setStatus('idle');
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[LiveTranslator] pc.iceConnectionState:', pc.iceConnectionState);
      };

      pc.onicegatheringstatechange = () => {
        console.log('[LiveTranslator] pc.iceGatheringState:', pc.iceGatheringState);
      };

      // Add audio track
      stream.getAudioTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
      console.log('[LiveTranslator] Audio track added');

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

      // Add connection timeout (15 seconds) - use ref to avoid stale closure
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      connectionTimeoutRef.current = setTimeout(() => {
        console.error('[LiveTranslator] Connection timeout - data channel did not open');
        setError(language === 'ar' ? 'انتهت مهلة الاتصال' : 'Connection timeout');
        setStatus('idle');
        cleanup();
      }, 15000);

      dc.onopen = () => {
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        console.log('[LiveTranslator] Data channel open - sending session config');
        
        const currentTargetLang = targetLanguageRef.current;
        const currentVoiceGender = voiceGenderRef.current;
        const targetLangName = TRANSLATION_LANGUAGES.find(l => l.code === currentTargetLang)?.name.en || currentTargetLang;
        
        // OpenAI Realtime voice: male=echo, female=shimmer
        const openaiVoice = currentVoiceGender === 'female' ? 'shimmer' : 'echo';
        
        // UN-style professional interpreter prompt - TRANSLATION ONLY
        const instructions = `You are a United Nations professional interpreter. You provide simultaneous translation into ${targetLangName}.

ABSOLUTE RULES - NEVER BREAK THESE:
- Output ONLY the translation in ${targetLangName}. Nothing else. Ever.
- NEVER say hello, hi, greetings, or any pleasantries
- NEVER say "The translation is..." or "You said..." or "Here's..."
- NEVER add commentary, explanations, or your own thoughts
- NEVER ask questions or engage in conversation
- NEVER acknowledge the user or respond to them personally
- If you hear silence or unclear audio, say nothing
- If the user speaks ${targetLangName}, repeat their words exactly

You are invisible. You are a voice that converts speech from one language to ${targetLangName}. That is your only function. Speak clearly, professionally, and naturally like a UN interpreter.`;
        
        console.log('[LiveTranslator] Instructions:', instructions);
        console.log('[LiveTranslator] Voice:', openaiVoice, '| Target:', targetLangName);
        
        // Use manual turn detection - we control when to commit with hold-to-talk
        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            instructions,
            voice: openaiVoice,
            input_audio_transcription: { model: 'whisper-1' },
            turn_detection: null, // Manual - we control when user finishes speaking
          }
        }));
        
        setStatus('ready');
      };

      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleRealtimeEvent(msg);
        } catch (e) {
          console.warn('[LiveTranslator] Failed to parse realtime event:', e);
        }
      };

      dc.onerror = (err) => {
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        console.error('[LiveTranslator] Data channel error:', err);
        setError(language === 'ar' ? 'خطأ في الاتصال' : 'Connection error');
        setStatus('idle');
      };

      dc.onclose = () => {
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        console.log('[LiveTranslator] Data channel closed');
        if (status !== 'idle') {
          setStatus('idle');
          setError(language === 'ar' ? 'انقطع الاتصال' : 'Connection lost');
        }
      };

      // Create offer
      await pc.setLocalDescription();

      // On mobile networks, sending the SDP before ICE gathering completes can cause
      // sessions that never fully open the data channel.
      console.log('[LiveTranslator] Waiting for ICE gathering to complete...');
      await waitForIceGatheringComplete(pc, 5000);

      const offer = pc.localDescription;

      if (!offer) {
        throw new Error('Failed to create SDP offer');
      }

      // Get session token from backend
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      console.log('[LiveTranslator] Calling Edge Function for SDP exchange...');
      console.log('[LiveTranslator] Has access token:', !!accessToken);
      
      const response = await supabase.functions.invoke('openai-realtime-translate-session', {
        body: { sdp_offer: offer.sdp },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      console.log('[LiveTranslator] Edge function response:', response.error ? 'ERROR' : 'OK', response.data ? 'has data' : 'no data');
      
      if (response.error || !response.data?.sdp_answer) {
        console.error('[LiveTranslator] Edge function error:', response.error);
        throw new Error(response.error?.message || 'Failed to get SDP answer');
      }

      console.log('[LiveTranslator] Got SDP answer, setting remote description...');
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: response.data.sdp_answer,
      });

      // Connection will be ready when dc.onopen fires

    } catch (err: any) {
      console.error('[LiveTranslator] Failed to initialize connection:', err);
      setError(err.message || (language === 'ar' ? 'فشل الاتصال' : 'Connection failed'));
      setStatus('idle');
      cleanup();
    }
  }, [language, status, cleanup]);

  // Handle realtime events from OpenAI
  const handleRealtimeEvent = useCallback((msg: any) => {
    console.log('[LiveTranslator] Realtime event:', msg.type);
    switch (msg.type) {
      case 'session.created':
        console.log('[LiveTranslator] Session created');
        break;
      case 'session.updated':
        console.log('[LiveTranslator] Session updated - ready for hold-to-talk');
        break;
      case 'input_audio_buffer.committed':
        console.log('[LiveTranslator] Audio committed');
        break;
      case 'conversation.item.input_audio_transcription.completed':
        // User's speech transcribed
        const transcript = msg.transcript?.trim() || '';
        setUserTranscript(transcript);
        
        if (transcript.length > 0) {
          console.log('[LiveTranslator] User said:', transcript);
          // Trigger response
          sendResponseCreate();
        } else {
          console.log('[LiveTranslator] Empty transcript - user did not speak');
          setStatus('ready');
        }
        break;
      case 'response.audio_transcript.delta':
        // AI speaking - partial transcript
        setStatus('speaking');
        if (msg.delta) {
          setTranslatedText(prev => prev + msg.delta);
        }
        break;
      case 'response.audio_transcript.done':
        // AI finished speaking
        if (msg.transcript) {
          setTranslatedText(msg.transcript);
        }
        break;
      case 'response.done':
        console.log('[LiveTranslator] Response complete');
        setStatus('ready');
        setError(null);
        break;
      case 'error':
        console.error('[LiveTranslator] Realtime error:', msg);
        if (msg.error?.message?.includes('buffer too small')) {
          console.log('[LiveTranslator] Buffer too small - waiting for more speech');
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

  // Send response.create to trigger AI response
  const sendResponseCreate = useCallback(() => {
    if (!dcRef.current || dcRef.current.readyState !== 'open') {
      console.warn('[LiveTranslator] Data channel not open');
      return;
    }
    dcRef.current.send(JSON.stringify({ type: 'response.create' }));
  }, []);

  // Start recording (hold-to-talk)
  const startRecording = useCallback(() => {
    if (!dcRef.current || dcRef.current.readyState !== 'open') {
      setError(t('Not connected', 'غير متصل'));
      return;
    }

    isStoppingRef.current = false;
    isHoldingRef.current = true;
    setError(null);
    setStatus('listening');
    setUserTranscript('');
    setTranslatedText('');
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
  }, [t]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    isHoldingRef.current = false;

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    // Check minimum hold duration
    const holdDuration = Date.now() - holdStartRef.current;
    const MIN_HOLD_MS = 500;
    
    if (holdDuration < MIN_HOLD_MS) {
      console.log('[LiveTranslator] Hold too short, ignoring');
      setIsHolding(false);
      setStatus('ready');
      setTimeout(() => { isStoppingRef.current = false; }, 300);
      return;
    }

    setIsHolding(false);
    setStatus('processing');

    // Commit the audio buffer to trigger transcription
    if (dcRef.current && dcRef.current.readyState === 'open') {
      dcRef.current.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    }

    setTimeout(() => { isStoppingRef.current = false; }, 1000);
  }, []);

  // Hold handlers
  const handleHoldStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (status === 'ready') {
      setIsHolding(true);
      startRecording();
    }
  }, [status, startRecording]);

  const handleHoldEnd = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (isHolding) {
      stopRecording();
    }
  }, [isHolding, stopRecording]);

  // Disconnect
  const handleDisconnect = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const statusText: Record<typeof status, string> = {
    idle: t('Tap Connect to start', 'اضغط اتصل للبدء'),
    connecting: t('Connecting...', 'جارٍ الاتصال...'),
    ready: t('Hold to speak', 'اضغط مع الاستمرار للتحدث'),
    listening: t('Listening...', 'أسمعك...'),
    processing: t('Translating...', 'جارٍ الترجمة...'),
    speaking: t('Speaking...', 'يتحدث...'),
  };

  const targetLangName = TRANSLATION_LANGUAGES.find(l => l.code === targetLanguage)?.name[language] || targetLanguage;

  return (
    <div className="space-y-4">
      {/* Hidden audio element for playback */}
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
      {/* Header - compact */}
      <div className="text-center pb-2">
        <h2 className="text-lg font-semibold flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
          <Languages className="w-5 h-5 text-cyan-500" />
          {t('Live Translator', 'المترجم الفوري')}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t('Translation only • clean interpreter voice', 'ترجمة فقط • صوت مترجم واضح')}
        </p>
      </div>

      {/* Compact Settings Row */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-purple-500/5 to-blue-500/5 border border-purple-500/10">
        {/* Target Language */}
        <div className="flex-1">
          <Label className="text-xs font-medium text-muted-foreground mb-1 block">
            {t('To', 'إلى')}
          </Label>
          <Select 
            value={targetLanguage} 
            onValueChange={(val) => {
              setTargetLanguage(val);
              targetLanguageRef.current = val;
              if (dcRef.current && dcRef.current.readyState === 'open' && status === 'ready') {
                const targetLangName = TRANSLATION_LANGUAGES.find(l => l.code === val)?.name.en || val;
                const openaiVoice = voiceGenderRef.current === 'female' ? 'shimmer' : 'echo';
                const instructions = `You are a high-precision simultaneous interpreter. You translate speech into ${targetLangName}.

ABSOLUTE RULES - NEVER BREAK THESE:
- Output ONLY the translation in ${targetLangName}. Nothing else. Ever.
- NEVER say hello, hi, greetings, or any pleasantries
- NEVER say "The translation is..." or "You said..." or "Here's..."
- NEVER add commentary, explanations, or your own thoughts
- NEVER ask questions or engage in conversation
- NEVER acknowledge the user or respond to them personally
- If you hear silence or unclear audio, say nothing
- If the user speaks ${targetLangName}, repeat their words exactly

You are invisible. You are a voice that converts speech from one language to ${targetLangName}. That is your only function. Speak clearly, professionally, and naturally like an expert interpreter.`;
                dcRef.current.send(JSON.stringify({
                  type: 'session.update',
                  session: { instructions, voice: openaiVoice }
                }));
              }
            }}
            disabled={status === 'connecting' || status === 'listening' || status === 'processing' || status === 'speaking'}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {TRANSLATION_LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name[language]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Voice Gender - icons + labels */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setVoiceGender('male');
              voiceGenderRef.current = 'male';
              if (dcRef.current && dcRef.current.readyState === 'open' && status === 'ready') {
                const targetLangName = TRANSLATION_LANGUAGES.find(l => l.code === targetLanguageRef.current)?.name.en || targetLanguageRef.current;
                const instructions = `You are a high-precision simultaneous interpreter. You translate speech into ${targetLangName}.

ABSOLUTE RULES - NEVER BREAK THESE:
- Output ONLY the translation in ${targetLangName}. Nothing else. Ever.
- NEVER say hello, hi, greetings, or any pleasantries
- NEVER say "The translation is..." or "You said..." or "Here's..."
- NEVER add commentary, explanations, or your own thoughts
- NEVER ask questions or engage in conversation
- NEVER acknowledge the user or respond to them personally
- If you hear silence or unclear audio, say nothing
- If the user speaks ${targetLangName}, repeat their words exactly

You are invisible. You are a voice that converts speech from one language to ${targetLangName}. That is your only function. Speak clearly, professionally, and naturally like an expert interpreter.`;
                dcRef.current.send(JSON.stringify({
                  type: 'session.update',
                  session: { instructions, voice: 'echo' }
                }));
              }
            }}
            disabled={status === 'connecting' || status === 'listening' || status === 'processing' || status === 'speaking'}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
              voiceGender === 'male'
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white border-transparent'
                : 'bg-white/50 dark:bg-white/10 border-purple-500/10 hover:bg-white/80 dark:hover:bg-white/20'
            } ${(status === 'connecting' || status === 'listening' || status === 'processing' || status === 'speaking') ? 'opacity-50' : ''}`}
          >
            <User className="w-4 h-4" />
            {t('Male', 'ذكر')}
          </button>

          <button
            type="button"
            onClick={() => {
              setVoiceGender('female');
              voiceGenderRef.current = 'female';
              if (dcRef.current && dcRef.current.readyState === 'open' && status === 'ready') {
                const targetLangName = TRANSLATION_LANGUAGES.find(l => l.code === targetLanguageRef.current)?.name.en || targetLanguageRef.current;
                const instructions = `You are a high-precision simultaneous interpreter. You translate speech into ${targetLangName}.

ABSOLUTE RULES - NEVER BREAK THESE:
- Output ONLY the translation in ${targetLangName}. Nothing else. Ever.
- NEVER say hello, hi, greetings, or any pleasantries
- NEVER say "The translation is..." or "You said..." or "Here's..."
- NEVER add commentary, explanations, or your own thoughts
- NEVER ask questions or engage in conversation
- NEVER acknowledge the user or respond to them personally
- If you hear silence or unclear audio, say nothing
- If the user speaks ${targetLangName}, repeat their words exactly

You are invisible. You are a voice that converts speech from one language to ${targetLangName}. That is your only function. Speak clearly, professionally, and naturally like an expert interpreter.`;
                dcRef.current.send(JSON.stringify({
                  type: 'session.update',
                  session: { instructions, voice: 'shimmer' }
                }));
              }
            }}
            disabled={status === 'connecting' || status === 'listening' || status === 'processing' || status === 'speaking'}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
              voiceGender === 'female'
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white border-transparent'
                : 'bg-white/50 dark:bg-white/10 border-purple-500/10 hover:bg-white/80 dark:hover:bg-white/20'
            } ${(status === 'connecting' || status === 'listening' || status === 'processing' || status === 'speaking') ? 'opacity-50' : ''}`}
          >
            <UserRound className="w-4 h-4" />
            {t('Female', 'أنثى')}
          </button>
        </div>
      </div>

      {/* Connection Button - compact */}
      {status === 'idle' ? (
        <Button
          onClick={initializeConnection}
          className="w-full h-10 text-sm bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        >
          <Volume2 className="w-4 h-4 mr-2" />
          {t('Start Interpreter', 'ابدأ الترجمة')}
        </Button>
      ) : (
        <Button
          onClick={handleDisconnect}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <X className="w-4 h-4 mr-1" />
          {t('Stop', 'إيقاف')}
        </Button>
      )}

      {/* Voice Orb - Clean Professional Design */}
      {status !== 'idle' && (
        <div className="flex flex-col items-center gap-3 py-4">
          {/* Orb CSS - cleaner, more professional */}
          <style>{`
            .translator-orb {
              position: relative;
              width: 120px;
              height: 120px;
              border-radius: 50%;
              background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 50%, #3b82f6 100%);
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              border: none;
              outline: none;
              box-shadow: 0 4px 20px rgba(139, 92, 246, 0.3);
              -webkit-tap-highlight-color: transparent;
              touch-action: none;
              user-select: none;
              transition: all 0.3s ease;
            }
            
            .translator-orb:disabled {
              opacity: 0.5;
              cursor: not-allowed;
            }
            
            .translator-orb:not(:disabled):hover {
              transform: scale(1.05);
              box-shadow: 0 6px 30px rgba(139, 92, 246, 0.4);
            }
            
            .translator-orb.listening {
              transform: scale(1.1);
              animation: pulse 1s ease-in-out infinite;
              box-shadow: 0 0 40px rgba(139, 92, 246, 0.6), 0 0 80px rgba(99, 102, 241, 0.4);
            }
            
            .translator-orb.speaking {
              background: linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%);
              animation: breathe 2s ease-in-out infinite;
              box-shadow: 0 0 40px rgba(16, 185, 129, 0.5);
            }
            
            .translator-orb.processing {
              animation: spin 1.5s linear infinite;
            }
            
            @keyframes pulse {
              0%, 100% { transform: scale(1.1); box-shadow: 0 0 40px rgba(139, 92, 246, 0.6); }
              50% { transform: scale(1.15); box-shadow: 0 0 60px rgba(139, 92, 246, 0.8); }
            }
            
            @keyframes breathe {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.05); }
            }
            
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>

          <button
            onMouseDown={handleHoldStart}
            onMouseUp={handleHoldEnd}
            onMouseLeave={handleHoldEnd}
            onTouchStart={handleHoldStart}
            onTouchEnd={handleHoldEnd}
            onContextMenu={(e) => e.preventDefault()}
            disabled={status === 'connecting' || status === 'processing' || status === 'speaking'}
            className={`translator-orb ${status === 'listening' ? 'listening' : ''} ${status === 'speaking' ? 'speaking' : ''} ${status === 'processing' ? 'processing' : ''}`}
            aria-label={statusText[status]}
          >
            {status === 'connecting' ? (
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            ) : status === 'speaking' ? (
              <Volume2 className="w-10 h-10 text-white" />
            ) : (
              <Mic className="w-10 h-10 text-white" />
            )}
          </button>

          {/* Status + Countdown inline */}
          <div className="text-center">
            <div className={`text-base font-medium ${theme === 'dark' ? 'text-white/90' : 'text-[#060541]/90'}`}>
              {statusText[status]}
              {isHolding && <span className="ml-2 text-purple-500 font-bold">{countdown}s</span>}
            </div>
            <div className={`text-xs mt-1 ${theme === 'dark' ? 'text-white/50' : 'text-[#060541]/50'}`}>
              → {targetLangName}
            </div>
          </div>
        </div>
      )}

      {/* Transcripts - cleaner cards */}
      {(userTranscript || translatedText) && (
        <div className="space-y-2">
          {userTranscript && (
            <div className={`px-3 py-2 rounded-lg border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{t('Original', 'الأصل')}</div>
              <div className="text-sm" dir="auto">{userTranscript}</div>
            </div>
          )}
          {translatedText && (
            <div className={`px-3 py-2 rounded-lg border-2 ${theme === 'dark' ? 'bg-purple-500/10 border-purple-500/30' : 'bg-purple-50 border-purple-200'}`}>
              <div className="text-[10px] uppercase tracking-wider text-purple-500 mb-0.5">{targetLangName}</div>
              <div className="text-sm font-medium" dir="auto">{translatedText}</div>
            </div>
          )}
        </div>
      )}

      {/* Error - compact */}
      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-500 text-xs text-center">
          {error}
        </div>
      )}
    </div>
  );
}

export default LiveTranslator;
