import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeftRight, Mic, User, UserRound, X, Volume2, Languages, Loader2 } from 'lucide-react';
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
  const [spokenLanguageOverride, setSpokenLanguageOverride] = useState(() => {
    return localStorage.getItem('wakti_live_translator_spoken_override') === '1';
  });
  const [spokenLanguage, setSpokenLanguage] = useState(() => {
    const saved = localStorage.getItem('wakti_live_translator_spoken');
    if (saved) return saved;
    return language === 'ar' ? 'ar' : 'en';
  });
  const [voice, setVoice] = useState(() => {
    const saved = localStorage.getItem('wakti_live_translator_voice');
    const validVoices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'];
    return (saved && validVoices.includes(saved)) ? saved : 'echo';
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
  const isProcessingResponseRef = useRef(false);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isHoldingRef = useRef(false);
  const targetLanguageRef = useRef(localStorage.getItem('wakti_live_translator_target') || 'ar');
  const spokenLanguageRef = useRef(localStorage.getItem('wakti_live_translator_spoken') || (language === 'ar' ? 'ar' : 'en'));
  const VALID_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'] as const;
  const getValidVoice = (v: string | null): string => {
    if (v && VALID_VOICES.includes(v as any)) return v;
    return 'echo';
  };
  const voiceRef = useRef(getValidVoice(localStorage.getItem('wakti_live_translator_voice')));

  // Keep refs in sync with state and persist to localStorage
  useEffect(() => {
    targetLanguageRef.current = targetLanguage;
    localStorage.setItem('wakti_live_translator_target', targetLanguage);
  }, [targetLanguage]);

  useEffect(() => {
    spokenLanguageRef.current = spokenLanguage;
    localStorage.setItem('wakti_live_translator_spoken', spokenLanguage);
    localStorage.setItem('wakti_live_translator_spoken_override', spokenLanguageOverride ? '1' : '0');
  }, [spokenLanguage, spokenLanguageOverride]);

  useEffect(() => {
    const validVoice = getValidVoice(voice);
    voiceRef.current = validVoice;
    localStorage.setItem('wakti_live_translator_voice', validVoice);
    if (voice !== validVoice) setVoice(validVoice);
  }, [voice]);

  // --- 1. CORE UTILITIES ---
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

  const buildInstructions = useCallback((targetLangCode: string, spokenLangCode: string) => {
    const targetLangName = TRANSLATION_LANGUAGES.find(l => l.code === targetLangCode)?.name.en || targetLangCode;
    const spokenLangName = TRANSLATION_LANGUAGES.find(l => l.code === spokenLangCode)?.name.en || spokenLangCode;
    return `ROLE: Silent translator. You are a translation machine, not an assistant.

INPUT: User speaks ${spokenLangName}.
OUTPUT: You speak ONLY the ${targetLangName} translation. Nothing else.

CRITICAL RULES:
1. TRANSLATE ONLY. Never respond to content. Never answer questions. Never help.
2. If user says "I need a taxi" in ${spokenLangName}, you say the ${targetLangName} translation of "I need a taxi". You do NOT call a taxi or ask for location.
3. NO commentary. NO "Sure!". NO "Here's the translation". NO conversation.
4. Output ONLY the translated words in ${targetLangName}, then STOP.
5. You are a parrot that converts ${spokenLangName} sounds into ${targetLangName} sounds. Nothing more.`;
  }, []);

  const sendResponseCreate = useCallback(() => {
    if (dcRef.current?.readyState === 'open') {
      dcRef.current.send(JSON.stringify({ type: 'response.create' }));
    }
  }, []);

  // --- 2. REALTIME EVENT HANDLER ---
  const handleRealtimeEvent = useCallback((msg: any) => {
    switch (msg.type) {
      case 'conversation.item.input_audio_transcription.completed':
        const transcript = msg.transcript?.trim() || '';
        setUserTranscript(transcript);
        if (transcript.length > 0) {
          if (!isProcessingResponseRef.current) {
            sendResponseCreate();
          }
          setStatus('processing');
        } else {
          setError(t('No speech detected.', 'لم يتم التقاط صوت.'));
          setStatus('ready');
        }
        break;
      case 'response.created':
        if (isProcessingResponseRef.current) return;
        isProcessingResponseRef.current = true;
        break;
      case 'response.audio_transcript.delta':
        setStatus('speaking');
        if (msg.delta) setTranslatedText(prev => prev + msg.delta);
        break;
      case 'response.audio_transcript.done':
        if (msg.transcript) setTranslatedText(msg.transcript);
        break;
      case 'response.done':
        isProcessingResponseRef.current = false;
        setStatus('ready');
        setError(null);
        break;
      case 'error':
        if (!msg.error?.message?.includes('buffer too small')) {
          setError(msg.error?.message || 'Realtime error');
        }
        setStatus('ready');
        break;
      default:
        break;
    }
  }, [t, sendResponseCreate]);

  // --- 3. CONNECTION LOGIC ---
  const initializeConnection = useCallback(async () => {
    setStatus('connecting');
    setError(null);
    setUserTranscript('');
    setTranslatedText('');

    if (dcRef.current) { try { dcRef.current.close(); } catch (e) {} dcRef.current = null; }
    if (pcRef.current) { try { pcRef.current.close(); } catch (e) {} pcRef.current = null; }

    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      if (audioContextRef.current) { try { audioContextRef.current.close(); } catch (e) {} }
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
      });
      pcRef.current = pc;

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setError(language === 'ar' ? 'انقطع الاتصال' : 'Connection lost');
          setStatus('idle');
        }
      };

      stream.getAudioTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (audioRef.current && event.streams[0]) {
          audioRef.current.srcObject = event.streams[0];
          audioRef.current.play().catch(() => {});
        }
      };

      const dc = pc.createDataChannel('oai-events', { ordered: true });
      dcRef.current = dc;

      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = setTimeout(() => {
        setError(language === 'ar' ? 'انتهت مهلة الاتصال' : 'Connection timeout');
        setStatus('idle');
        cleanup();
      }, 15000);

      dc.onopen = () => {
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        
        const currentTargetLang = targetLanguageRef.current;
        const currentSpokenLang = spokenLanguageRef.current;
        const currentVoice = voiceRef.current;
        
        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            instructions: buildInstructions(currentTargetLang, currentSpokenLang),
            voice: currentVoice,
            input_audio_transcription: { model: 'whisper-1', language: currentSpokenLang },
            turn_detection: null
          }
        }));
        setStatus('ready');
      };

      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleRealtimeEvent(msg);
        } catch (e) {}
      };

      dc.onerror = () => {
        setError(language === 'ar' ? 'خطأ في الاتصال' : 'Connection error');
        setStatus('idle');
      };

      await pc.setLocalDescription();
      await waitForIceGatheringComplete(pc, 5000);

      const offer = pc.localDescription;
      if (!offer) throw new Error('Failed to create SDP offer');

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await supabase.functions.invoke('openai-realtime-translate-session', {
        body: { sdp_offer: offer.sdp },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (response.error || !response.data?.sdp_answer) {
        throw new Error(response.error?.message || 'Failed to get SDP answer');
      }

      await pc.setRemoteDescription({ type: 'answer', sdp: response.data.sdp_answer });

    } catch (err: any) {
      setError(err.message || (language === 'ar' ? 'فشل الاتصال' : 'Connection failed'));
      setStatus('idle');
      cleanup();
    }
  }, [language, cleanup, buildInstructions, handleRealtimeEvent, waitForIceGatheringComplete]);

  // --- 4. RECORDING LOGIC ---
  const stopRecording = useCallback(() => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    isHoldingRef.current = false;
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    const holdDuration = Date.now() - holdStartRef.current;
    if (holdDuration < 500) {
      setIsHolding(false);
      setStatus('ready');
      setTimeout(() => { isStoppingRef.current = false; }, 300);
      return;
    }

    setIsHolding(false);
    setStatus('processing');
    
    setTimeout(() => {
      if (dcRef.current && dcRef.current.readyState === 'open') {
        dcRef.current.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
      }
      setTimeout(() => { isStoppingRef.current = false; }, 700);
    }, 300);
  }, []);

  const startRecording = useCallback(() => {
    if (dcRef.current?.readyState !== 'open') {
      setError(t('Not connected', 'غير متصل'));
      return;
    }

    isStoppingRef.current = false;
    isHoldingRef.current = true;
    isProcessingResponseRef.current = false;
    setError(null);
    setStatus('listening');
    setUserTranscript('');
    setTranslatedText('');
    setCountdown(MAX_RECORD_SECONDS);
    holdStartRef.current = Date.now();

    dcRef.current.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));

    countdownIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - holdStartRef.current) / 1000);
      const remaining = Math.max(0, MAX_RECORD_SECONDS - elapsed);
      setCountdown(remaining);
      if (remaining <= 0) stopRecording();
    }, 200);
  }, [t, stopRecording]);

  // --- 5. UI HANDLERS ---
  const handleHoldStart = (e: React.PointerEvent) => {
    e.preventDefault();
    if (status === 'ready') {
      setIsHolding(true);
      startRecording();
    }
  };

  const handleHoldEnd = (e: React.PointerEvent) => {
    e.preventDefault();
    if (isHolding) {
      stopRecording();
      setIsHolding(false);
    }
  };

  const handleDisconnect = () => cleanup();

  const statusText: Record<typeof status, string> = {
    idle: t('Tap Connect to start', 'اضغط اتصل للبدء'),
    connecting: t('Connecting...', 'جارٍ الاتصال...'),
    ready: t('Hold to speak', 'اضغط مع الاستمرار للتحدث'),
    listening: t('Listening...', 'أسمعك...'),
    processing: t('Translating...', 'جارٍ الترجمة...'),
    speaking: t('Speaking...', 'يتحدث...'),
  };

  const currentTargetLangName = TRANSLATION_LANGUAGES.find(l => l.code === targetLanguage)?.name[language] || targetLanguage;

  return (
    <div
      className="live-translator-nocopy space-y-4 select-none [-webkit-user-select:none] [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent]"
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onPaste={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <style>{`
        .live-translator-nocopy,
        .live-translator-nocopy * {
          -webkit-user-select: none;
          user-select: none;
          -webkit-touch-callout: none;
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
      
      <div className="text-center pb-2">
        <h2 className="text-lg font-semibold flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 bg-clip-text text-transparent drop-shadow-[0_0_14px_rgba(56,189,248,0.35)]">
          <Languages className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_10px_rgba(56,189,248,0.45)]" />
          {t('Live Translator', 'المترجم الفوري')}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t('Translation only • clean interpreter voice', 'ترجمة فقط • صوت مترجم واضح')}
        </p>
      </div>

      <div className="grid grid-cols-12 gap-3 p-3 rounded-xl border border-white/10 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 shadow-[0_2px_20px_rgba(56,189,248,0.12)] md:flex md:items-center md:gap-3">
        <div className="col-span-5 md:flex-1">
          <Label className="text-xs font-medium text-muted-foreground mb-1 block">{t('Spoken', 'المتحدث')}</Label>
          <Select
            value={spokenLanguage}
            onValueChange={(val) => {
              setSpokenLanguageOverride(true);
              setSpokenLanguage(val);
              spokenLanguageRef.current = val;
              setUserTranscript('');
              setTranslatedText('');
              if (dcRef.current?.readyState === 'open') {
                dcRef.current.send(JSON.stringify({
                  type: 'session.update',
                  session: { 
                    instructions: buildInstructions(targetLanguageRef.current, val), 
                    voice: voiceRef.current,
                    input_audio_transcription: { model: 'whisper-1', language: val }
                  }
                }));
              }
            }}
            disabled={status === 'connecting' || status === 'listening' || status === 'processing' || status === 'speaking'}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-60">
              {TRANSLATION_LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>{lang.name[language]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2 flex items-end justify-center md:col-auto">
          <button
            type="button"
            title={t('Swap languages', 'تبديل اللغات')}
            onClick={() => {
              const nextSpoken = targetLanguageRef.current;
              const nextTarget = spokenLanguageRef.current;
              setSpokenLanguageOverride(true);
              setSpokenLanguage(nextSpoken);
              setTargetLanguage(nextTarget);
              spokenLanguageRef.current = nextSpoken;
              targetLanguageRef.current = nextTarget;
              setUserTranscript('');
              setTranslatedText('');
              if (dcRef.current?.readyState === 'open') {
                dcRef.current.send(JSON.stringify({
                  type: 'session.update',
                  session: { 
                    instructions: buildInstructions(nextTarget, nextSpoken), 
                    voice: voiceRef.current,
                    input_audio_transcription: { model: 'whisper-1', language: nextSpoken }
                  }
                }));
              }
            }}
            disabled={status === 'connecting' || status === 'listening' || status === 'processing' || status === 'speaking'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/60 text-foreground transition-all active:scale-95 dark:bg-white/10 dark:hover:bg-white/15 hover:bg-white/80"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
        </div>

        <div className="col-span-5 md:flex-1">
          <Label className="text-xs font-medium text-muted-foreground mb-1 block">{t('To', 'إلى')}</Label>
          <Select 
            value={targetLanguage} 
            onValueChange={(val) => {
              setTargetLanguage(val);
              targetLanguageRef.current = val;
              setUserTranscript('');
              setTranslatedText('');
              if (dcRef.current?.readyState === 'open') {
                dcRef.current.send(JSON.stringify({
                  type: 'session.update',
                  session: { instructions: buildInstructions(val, spokenLanguageRef.current), voice: voiceRef.current }
                }));
              }
            }}
            disabled={status === 'connecting' || status === 'listening' || status === 'processing' || status === 'speaking'}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-60">
              {TRANSLATION_LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>{lang.name[language]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-12 md:col-auto">
          <div className="text-xs font-medium text-muted-foreground mb-1 text-center md:text-left">{t('AI Voice', 'صوت الذكاء الاصطناعي')}</div>
          <Select 
            value={voice} 
            onValueChange={(val) => {
              setVoice(val);
              voiceRef.current = val;
              if (dcRef.current?.readyState === 'open') {
                dcRef.current.send(JSON.stringify({ type: 'session.update', session: { voice: val } }));
              }
            }}
            disabled={status === 'connecting' || status === 'listening' || status === 'processing' || status === 'speaking'}
          >
            <SelectTrigger className="w-full md:w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alloy">Alloy</SelectItem>
              <SelectItem value="ash">Ash</SelectItem>
              <SelectItem value="ballad">Ballad</SelectItem>
              <SelectItem value="coral">Coral</SelectItem>
              <SelectItem value="echo">Echo</SelectItem>
              <SelectItem value="sage">Sage</SelectItem>
              <SelectItem value="shimmer">Shimmer</SelectItem>
              <SelectItem value="verse">Verse</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {status === 'idle' ? (
        <Button onClick={initializeConnection} className="w-full h-10 text-sm bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
          <Volume2 className="w-4 h-4 mr-2" /> {t('Start Interpreter', 'ابدأ الترجمة')}
        </Button>
      ) : (
        <Button onClick={handleDisconnect} variant="outline" size="sm" className="w-full">
          <X className="w-4 h-4 mr-1" /> {t('Stop', 'إيقاف')}
        </Button>
      )}

      {status !== 'idle' && (
        <div className="flex flex-col items-center gap-3 py-4 select-none">
          <style>{`
            .translator-orb {
              position: relative; width: 120px; height: 120px; border-radius: 50%;
              background: linear-gradient(135deg, hsl(180 85% 60%) 0%, hsl(280 70% 65%) 50%, hsl(25 95% 60%) 100%);
              background-size: 300% 300%; display: flex; align-items: center; justify-content: center;
              cursor: pointer; border: none; outline: none; transition: all 0.3s ease;
              animation: translatorGradient 6s ease infinite;
              box-shadow: 0 0 25px hsla(210, 100%, 65%, 0.35), 0 0 45px hsla(280, 70%, 65%, 0.20);
            }
            .translator-orb.listening {
              transform: scale(1.1); animation: translatorGradient 2.2s ease infinite, pulse 0.8s ease-in-out infinite;
              box-shadow: 0 0 25px hsla(210, 100%, 65%, 0.8), 0 0 60px hsla(280, 70%, 65%, 0.55);
            }
            .translator-orb.speaking { animation: translatorGradient 3.5s ease infinite, breathe 1.6s ease-in-out infinite; }
            .translator-orb.processing { animation: translatorGradient 1.8s ease infinite, spin 1.5s linear infinite; }
            @keyframes translatorGradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
            @keyframes pulse { 0%, 100% { transform: scale(1.1); } 50% { transform: scale(1.15); } }
            @keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          `}</style>
          <button
            onPointerDown={handleHoldStart}
            onPointerUp={handleHoldEnd}
            onPointerLeave={handleHoldEnd}
            onPointerCancel={handleHoldEnd}
            disabled={status === 'connecting' || status === 'processing' || status === 'speaking'}
            className={`translator-orb ${status === 'listening' ? 'listening' : ''} ${status === 'speaking' ? 'speaking' : ''} ${status === 'processing' ? 'processing' : ''}`}
          >
            {status === 'connecting' ? <Loader2 className="w-10 h-10 text-white animate-spin" /> : 
             status === 'speaking' ? <Volume2 className="w-10 h-10 text-white" /> : <Mic className="w-10 h-10 text-white" />}
          </button>
          <div className="text-center select-none">
            <div className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-[#060541]'}`}>
              {statusText[status]} {isHolding && <span className="ml-2 text-purple-500 font-bold">{countdown}s</span>}
            </div>
            <div className={`text-xs mt-1 ${theme === 'dark' ? 'text-white/50' : 'text-[#060541]/50'}`}>→ {currentTargetLangName}</div>
          </div>
        </div>
      )}

      {(userTranscript || translatedText) && (
        <div className="space-y-2">
          {userTranscript && (
            <div className={`px-3 py-2 rounded-lg border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5 font-bold">
                {TRANSLATION_LANGUAGES.find(l => l.code === spokenLanguage)?.name[language]} {t('Speaker Said', 'قال المتحدث')}
              </div>
              <div className="text-sm" dir="auto">{userTranscript}</div>
            </div>
          )}
          {translatedText && (
            <div className={`px-3 py-2 rounded-lg border border-white/10 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 shadow-[0_8px_40px_rgba(56,189,248,0.10)]`}>
              <div className="text-[10px] uppercase tracking-wider bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-0.5 font-bold">
                {TRANSLATION_LANGUAGES.find(l => l.code === targetLanguage)?.name[language]} {t('Translation', 'الترجمة')}
              </div>
              <div className="text-sm font-medium" dir="auto">{translatedText}</div>
            </div>
          )}
        </div>
      )}

      {error && <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-500 text-xs text-center">{error}</div>}
    </div>
  );
}

export default LiveTranslator;
