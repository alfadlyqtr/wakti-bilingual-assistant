import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, X, Volume2, Languages, Loader2 } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface LiveTranslatorProps {
  onBack?: () => void;
}

const MAX_RECORD_SECONDS = 30;

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
        
        // Translation-only system prompt
        const instructions = `You are a real-time voice translator. Your ONLY job is to translate what the user says into ${targetLangName}.

CRITICAL RULES:
1. Listen to what the user says
2. Translate it to ${targetLangName}
3. Speak ONLY the translation - nothing else
4. Do NOT add greetings, commentary, or explanations
5. Do NOT say "Here's the translation" or "You said..."
6. Do NOT ask questions or make conversation
7. Keep the same tone and emotion as the original
8. If the user already speaks ${targetLangName}, just repeat what they said
9. Be fast and natural - like a professional interpreter`;
        
        console.log('[LiveTranslator] Instructions:', instructions);
        console.log('[LiveTranslator] Voice:', openaiVoice, '| Target:', targetLangName);
        
        // Use manual turn detection - we control when to commit with hold-to-talk
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
      
      const response = await supabase.functions.invoke('openai-realtime-session', {
        body: { sdp_offer: offer.sdp, language },
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
    <div className="space-y-6">
      {/* Hidden audio element for playback */}
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-semibold flex items-center justify-center gap-2">
          <Languages className="w-5 h-5" />
          {t('Live Translator', 'المترجم الفوري')}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('Speak and hear instant translations', 'تحدث واسمع الترجمة فوراً')}
        </p>
      </div>

      {/* Settings */}
      <div className="grid grid-cols-2 gap-4">
        {/* Target Language */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            {t('Translate to', 'ترجم إلى')}
          </Label>
          <Select 
            value={targetLanguage} 
            onValueChange={setTargetLanguage}
            disabled={status !== 'idle'}
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

        {/* Voice Gender */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            {t('Voice', 'الصوت')}
          </Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setVoiceGender('male')}
              disabled={status !== 'idle'}
              className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-all ${
                voiceGender === 'male'
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white/80 dark:bg-white/5 border-border hover:bg-white dark:hover:bg-white/10'
              } ${status !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {t('Male', 'ذكر')} 👨
            </button>
            <button
              type="button"
              onClick={() => setVoiceGender('female')}
              disabled={status !== 'idle'}
              className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-all ${
                voiceGender === 'female'
                  ? 'bg-pink-500 text-white border-pink-500'
                  : 'bg-white/80 dark:bg-white/5 border-border hover:bg-white dark:hover:bg-white/10'
              } ${status !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {t('Female', 'أنثى')} 👩
            </button>
          </div>
        </div>
      </div>

      {/* Connection Button */}
      {status === 'idle' ? (
        <Button
          onClick={initializeConnection}
          className="w-full h-12 text-base"
        >
          <Volume2 className="w-5 h-5 mr-2" />
          {t('Connect', 'اتصل')}
        </Button>
      ) : (
        <Button
          onClick={handleDisconnect}
          variant="outline"
          className="w-full h-12 text-base"
        >
          <X className="w-5 h-5 mr-2" />
          {t('Disconnect', 'قطع الاتصال')}
        </Button>
      )}

      {/* Voice Orb */}
      {status !== 'idle' && (
        <div className="flex flex-col items-center gap-4 py-6">
          {/* Orb CSS */}
          <style>{`
            .translator-orb {
              position: relative;
              width: 160px;
              height: 160px;
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
              -webkit-tap-highlight-color: transparent;
              touch-action: none;
              user-select: none;
              transition: box-shadow 0.3s ease-out, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            
            .translator-orb:disabled {
              opacity: 0.4;
              cursor: not-allowed;
              filter: grayscale(0.5);
            }
            
            .translator-orb.listening {
              transform: scale(1.1);
              animation: gradientShift 2s ease infinite, orbPulse 0.5s ease-in-out infinite;
              box-shadow: 
                0 0 80px rgba(123, 47, 247, 0.7),
                0 0 160px rgba(241, 7, 163, 0.5),
                0 0 240px rgba(0, 212, 255, 0.3),
                inset 0 0 80px rgba(255, 255, 255, 0.2);
            }
            
            .translator-orb.speaking {
              animation: gradientShift 4s ease infinite, speakingBreath 1.5s ease-in-out infinite;
              box-shadow: 
                0 0 100px rgba(241, 7, 163, 0.6),
                0 0 200px rgba(123, 47, 247, 0.4),
                inset 0 0 60px rgba(255, 255, 255, 0.15);
            }
            
            .translator-orb.processing {
              animation: gradientShift 3s ease infinite, processingGlow 1s ease-in-out infinite;
            }
            
            @keyframes gradientShift {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            
            @keyframes orbPulse {
              0%, 100% { transform: scale(1.1); }
              50% { transform: scale(1.15); }
            }
            
            @keyframes speakingBreath {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.08); }
            }
            
            @keyframes processingGlow {
              0%, 100% { opacity: 0.8; filter: brightness(1); }
              50% { opacity: 1; filter: brightness(1.2); }
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
              <Loader2 className="w-12 h-12 text-white animate-spin" />
            ) : (
              <Mic className="w-12 h-12 text-white drop-shadow-lg" />
            )}
          </button>

          {/* Status */}
          <div className={`text-lg font-medium ${theme === 'dark' ? 'text-white/90' : 'text-[#060541]/90'}`}>
            {statusText[status]}
          </div>

          {/* Countdown when recording */}
          {isHolding && (
            <div className={`text-3xl font-bold tabular-nums ${theme === 'dark' ? 'text-white' : 'text-[#060541]'}`}>
              {countdown}s
            </div>
          )}

          {/* Target language indicator */}
          <div className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-[#060541]/60'}`}>
            {t('Translating to', 'الترجمة إلى')} <span className="font-medium">{targetLangName}</span>
          </div>
        </div>
      )}

      {/* Transcripts */}
      {(userTranscript || translatedText) && (
        <div className="space-y-3">
          {userTranscript && (
            <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
              <div className="text-xs text-muted-foreground mb-1">{t('You said:', 'قلت:')}</div>
              <div className="text-sm" dir="auto">{userTranscript}</div>
            </div>
          )}
          {translatedText && (
            <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-purple-500/10' : 'bg-purple-500/10'}`}>
              <div className="text-xs text-muted-foreground mb-1">{t('Translation:', 'الترجمة:')}</div>
              <div className="text-sm font-medium" dir="auto">{translatedText}</div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm text-center">
          {error}
        </div>
      )}
    </div>
  );
}

export default LiveTranslator;
