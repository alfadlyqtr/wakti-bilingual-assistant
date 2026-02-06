import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, X, Check, Loader2, Type } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, nextDay, parse as dateParse } from 'date-fns';
import { CALENDAR_ADD_ENTRY_SCHEMA } from '@/schemas/calendarAddEntrySchema';

// ─── Types ──────────────────────────────────────────────────────────────────

type VoiceState = 'idle' | 'connecting' | 'greeting' | 'listening' | 'thinking' | 'confirming' | 'done' | 'error';

interface ExtractedEntry {
  title: string;
  date: string; // yyyy-MM-dd
  description?: string;
}

interface VoiceAssistantProps {
  onSaveEntry: (entry: { title: string; date: string; description?: string }) => void;
}

// ─── Date parsing helper ────────────────────────────────────────────────────

function parseDateFromText(text: string): string {
  const lower = text.toLowerCase().trim();
  const today = new Date();

  // "today"
  if (lower.includes('today') || lower.includes('اليوم')) {
    return format(today, 'yyyy-MM-dd');
  }

  // "tomorrow"
  if (lower.includes('tomorrow') || lower.includes('غدا') || lower.includes('غداً') || lower.includes('بكرة') || lower.includes('بكره')) {
    return format(addDays(today, 1), 'yyyy-MM-dd');
  }

  // "day after tomorrow"
  if (lower.includes('day after tomorrow') || lower.includes('بعد غد') || lower.includes('بعد بكرة') || lower.includes('بعد بكره')) {
    return format(addDays(today, 2), 'yyyy-MM-dd');
  }

  // "next monday", "next tuesday", etc.
  const dayNames: Record<string, 0 | 1 | 2 | 3 | 4 | 5 | 6> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
    الأحد: 0, الاثنين: 1, الثلاثاء: 2, الأربعاء: 3, الخميس: 4, الجمعة: 5, السبت: 6,
  };

  for (const [name, dayIndex] of Object.entries(dayNames)) {
    if (lower.includes(name)) {
      const next = nextDay(today, dayIndex);
      return format(next, 'yyyy-MM-dd');
    }
  }

  // Try to find a date pattern like "February 10" or "10 February" or "2026-02-10"
  const isoMatch = lower.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }

  const monthNames: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    يناير: 1, فبراير: 2, مارس: 3, أبريل: 4, مايو: 5, يونيو: 6,
    يوليو: 7, أغسطس: 8, سبتمبر: 9, أكتوبر: 10, نوفمبر: 11, ديسمبر: 12,
  };

  for (const [mName, mNum] of Object.entries(monthNames)) {
    const re1 = new RegExp(`${mName}\\s+(\\d{1,2})`, 'i');
    const re2 = new RegExp(`(\\d{1,2})\\s+${mName}`, 'i');
    const m1 = lower.match(re1);
    const m2 = lower.match(re2);
    const dayNum = m1 ? parseInt(m1[1]) : m2 ? parseInt(m2[1]) : null;
    if (dayNum && dayNum >= 1 && dayNum <= 31) {
      const year = today.getFullYear();
      return `${year}-${String(mNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    }
  }

  // Fallback: today
  return format(today, 'yyyy-MM-dd');
}

// ─── Extract structured data from transcript ────────────────────────────────

function extractEntryFromTranscript(transcript: string): ExtractedEntry {
  const date = parseDateFromText(transcript);

  // Try to separate title from date words
  let title = transcript.trim();

  // Remove common date phrases from the title
  const datePatterns = [
    /\b(today|tomorrow|day after tomorrow)\b/gi,
    /\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi,
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b/gi,
    /\b\d{1,2}\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi,
    /\b\d{4}-\d{1,2}-\d{1,2}\b/g,
    /\b(اليوم|غدا|غداً|بكرة|بكره|بعد غد|بعد بكرة|بعد بكره)\b/g,
    /\b(الأحد|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت)\b/g,
    /\b(on|at|for|في|يوم)\b/gi,
  ];

  for (const pattern of datePatterns) {
    title = title.replace(pattern, '');
  }

  // Clean up extra spaces
  title = title.replace(/\s+/g, ' ').trim();

  // Remove leading "add", "create", "new", etc.
  title = title.replace(/^(add|create|new|make|set|put|أضف|أنشئ|سجل)\s+/i, '').trim();

  // Remove trailing prepositions
  title = title.replace(/\s+(on|for|at|في)$/i, '').trim();

  // If title is empty after cleanup, use original
  if (!title) {
    title = transcript.trim();
  }

  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);

  return { title, date };
}

// ─── Component ──────────────────────────────────────────────────────────────

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ onSaveEntry }) => {
  const { language, theme } = useTheme();
  const { user } = useAuth();
  const isDark = theme === 'dark';
  const t = (en: string, ar: string) => language === 'ar' ? ar : en;

  // UI state
  const [isOpen, setIsOpen] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [aiTranscript, setAiTranscript] = useState('');
  const [extractedEntry, setExtractedEntry] = useState<ExtractedEntry | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [typeMode, setTypeMode] = useState(false);
  const [typedText, setTypedText] = useState('');

  // WebRTC refs
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intentionalSpeechRef = useRef(false);
  const greetingDoneRef = useRef(false);
  const initializingRef = useRef(false);

  // ─── Cleanup ────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (dcRef.current) { try { dcRef.current.close(); } catch {} dcRef.current = null; }
    if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }
    intentionalSpeechRef.current = false;
    greetingDoneRef.current = false;
    initializingRef.current = false;
    setVoiceState('idle');
    setTranscript('');
    setAiTranscript('');
    setExtractedEntry(null);
    setErrorMsg('');
    setTypeMode(false);
    setTypedText('');
  }, []);

  useEffect(() => { return () => cleanup(); }, [cleanup]);

  // ─── Handle Realtime events ─────────────────────────────────────────────

  const handleRealtimeEvent = useCallback((msg: any) => {
    switch (msg.type) {
      case 'conversation.item.input_audio_transcription.completed': {
        const text = msg.transcript?.trim() || '';
        // Cancel any AI auto-response
        try {
          if (dcRef.current?.readyState === 'open') {
            dcRef.current.send(JSON.stringify({ type: 'response.cancel' }));
          }
        } catch {}

        if (text.length > 0) {
          console.log('[VoiceAssistant] User said:', text);
          setTranscript(text);
          setVoiceState('thinking');

          // Extract entry from transcript
          const entry = extractEntryFromTranscript(text);
          setExtractedEntry(entry);
          setVoiceState('confirming');
        } else {
          setVoiceState('listening');
        }
        break;
      }

      case 'response.audio_transcript.delta': {
        if (intentionalSpeechRef.current && msg.delta) {
          setAiTranscript(prev => prev + msg.delta);
        }
        break;
      }

      case 'response.done': {
        intentionalSpeechRef.current = false;
        // After greeting finishes, switch to listening
        if (!greetingDoneRef.current) {
          greetingDoneRef.current = true;
          setTimeout(() => {
            setVoiceState('listening');
            setAiTranscript('');
          }, 600);
        }
        // Kill any follow-up chatbot response
        try {
          if (dcRef.current?.readyState === 'open') {
            dcRef.current.send(JSON.stringify({ type: 'response.cancel' }));
            dcRef.current.send(JSON.stringify({
              type: 'session.update',
              session: {
                instructions: 'Do NOT speak. Do NOT respond. Only transcribe audio input silently. Say absolutely nothing.',
              }
            }));
          }
        } catch {}
        break;
      }

      case 'error':
        if (!msg.error?.message?.includes('buffer too small') && !msg.error?.message?.includes('response.cancel')) {
          console.error('[VoiceAssistant] Realtime error:', msg.error);
        }
        break;

      default:
        break;
    }
  }, []);

  // ─── Initialize connection ──────────────────────────────────────────────

  const initializeConnection = useCallback(async () => {
    if (initializingRef.current) return;
    initializingRef.current = true;
    setVoiceState('connecting');
    setErrorMsg('');

    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      stream.getAudioTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (audioRef.current && event.streams[0]) {
          audioRef.current.srcObject = event.streams[0];
          audioRef.current.muted = false;
          audioRef.current.volume = 1;
          audioRef.current.play().catch(() => {});
        }
      };

      const dc = pc.createDataChannel('oai-events', { ordered: true });
      dcRef.current = dc;

      dc.onopen = () => {
        console.log('[VoiceAssistant] Data channel open');

        const instructions = t(
          `You are a voice-controlled assistant for the Wakti app. You are NOT a chatbot. You do NOT have conversations. You NEVER offer help or ask follow-up questions on your own. You ONLY speak when given an explicit instruction that starts with "Say EXACTLY this". If you receive any audio input, do NOT respond to it — just transcribe it silently. NEVER generate any response unless explicitly instructed.`,
          `أنت مساعد صوتي لتطبيق وقتي. أنت لست روبوت محادثة. لا تتحدث أبدًا من تلقاء نفسك. لا تعرض المساعدة. لا تسأل أسئلة. تحدث فقط عندما يُطلب منك بالضبط "قل بالضبط هذا". إذا استلمت أي صوت، لا ترد عليه — فقط انسخه بصمت.`
        );

        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            instructions,
            voice: 'shimmer',
            input_audio_transcription: language === 'ar'
              ? { model: 'whisper-1', language: 'ar' }
              : { model: 'whisper-1' },
            turn_detection: null,
          }
        }));

        // Speak greeting
        const name = displayName || '';
        const greeting = name
          ? t(`Hey ${name}! How can I help?`, `أهلاً ${name}! كيف أقدر أساعدك؟`)
          : t(`Hey! How can I help?`, `أهلاً! كيف أقدر أساعدك؟`);

        setAiTranscript('');
        setVoiceState('greeting');
        intentionalSpeechRef.current = true;

        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            instructions: t(
              `Say EXACTLY this and nothing else: "${greeting}"`,
              `قل بالضبط هذا ولا شيء آخر: "${greeting}"`
            )
          }
        }));
        dc.send(JSON.stringify({ type: 'response.create' }));
      };

      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleRealtimeEvent(msg);
        } catch {}
      };

      dc.onerror = () => {
        setVoiceState('error');
        setErrorMsg(t('Connection error', 'خطأ في الاتصال'));
      };

      dc.onclose = () => {
        if (voiceState !== 'done') {
          setVoiceState('idle');
        }
      };

      await pc.setLocalDescription();
      const offer = pc.localDescription;
      if (!offer) throw new Error('Failed to create SDP offer');

      const response = await supabase.functions.invoke('voice-assistant-session', {
        body: { sdp_offer: offer.sdp },
      });

      if (response.error || !response.data?.sdp_answer) {
        throw new Error(response.error?.message || 'Failed to get SDP answer');
      }

      if (response.data.display_name) {
        setDisplayName(response.data.display_name);
      }

      await pc.setRemoteDescription({ type: 'answer', sdp: response.data.sdp_answer });

    } catch (err: any) {
      console.error('[VoiceAssistant] Connection failed:', err);
      setVoiceState('error');
      setErrorMsg(t('Failed to connect. Please try again.', 'فشل الاتصال. حاول مرة أخرى.'));
      initializingRef.current = false;
    }
  }, [language, t, displayName, handleRealtimeEvent, voiceState]);

  // ─── Open / Close ───────────────────────────────────────────────────────

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    initializeConnection();
  }, [initializeConnection]);

  const handleClose = useCallback(() => {
    cleanup();
    setIsOpen(false);
  }, [cleanup]);

  // ─── Toggle listening ───────────────────────────────────────────────────

  const toggleListening = useCallback(() => {
    if (voiceState === 'listening') {
      // Stop listening (mute mic)
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(t => t.enabled = false);
      }
      setVoiceState('idle');
    } else if (voiceState === 'idle' || voiceState === 'confirming') {
      // Start listening (unmute mic)
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(t => t.enabled = true);
      }
      setTranscript('');
      setExtractedEntry(null);
      setVoiceState('listening');
    }
  }, [voiceState]);

  // ─── Confirm & Save ─────────────────────────────────────────────────────

  const handleConfirm = useCallback(() => {
    if (!extractedEntry) return;
    onSaveEntry({
      title: extractedEntry.title,
      date: extractedEntry.date,
      description: extractedEntry.description,
    });
    setVoiceState('done');
    setTimeout(() => {
      handleClose();
    }, 800);
  }, [extractedEntry, onSaveEntry, handleClose]);

  // ─── Type mode submit ───────────────────────────────────────────────────

  const handleTypeSubmit = useCallback(() => {
    if (!typedText.trim()) return;
    const entry = extractEntryFromTranscript(typedText.trim());
    setExtractedEntry(entry);
    setTranscript(typedText.trim());
    setVoiceState('confirming');
    setTypeMode(false);
    setTypedText('');
  }, [typedText]);

  // ─── Format date for display ────────────────────────────────────────────

  const formatDateDisplay = (dateStr: string) => {
    try {
      const d = dateParse(dateStr, 'yyyy-MM-dd', new Date());
      return format(d, 'EEEE, MMMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  // ─── State label ────────────────────────────────────────────────────────

  const stateLabel = () => {
    switch (voiceState) {
      case 'connecting': return t('Connecting...', 'جارٍ الاتصال...');
      case 'greeting': return t('Speaking...', 'يتحدث...');
      case 'listening': return t('Listening...', 'أستمع...');
      case 'thinking': return t('Processing...', 'جارٍ المعالجة...');
      case 'confirming': return t('Confirm', 'تأكيد');
      case 'done': return t('Saved!', 'تم الحفظ!');
      case 'error': return t('Error', 'خطأ');
      default: return '';
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      {/* Hidden audio element for AI speech */}
      <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />

      {/* Floating Orb Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleOpen}
            className="fixed bottom-24 left-4 z-50 rounded-full shadow-lg h-14 w-14 flex items-center justify-center"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, hsl(210, 100%, 65%) 0%, hsl(280, 70%, 65%) 100%)'
                : 'linear-gradient(135deg, #060541 0%, hsl(260, 70%, 25%) 100%)',
              boxShadow: isDark
                ? '0 0 25px hsla(210, 100%, 65%, 0.5), 0 4px 16px hsla(0, 0%, 0%, 0.4)'
                : '0 4px 20px hsla(243, 84%, 14%, 0.3)',
            }}
          >
            <Mic className="h-6 w-6 text-white" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Voice Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="fixed inset-0 z-50"
              style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-x-4 z-50 flex flex-col overflow-hidden"
              style={{
                top: '17.5%',
                height: '65%',
                borderRadius: '1.5rem',
                background: isDark
                  ? 'linear-gradient(135deg, rgba(12,15,20,0.92) 0%, rgba(30,33,45,0.95) 100%)'
                  : 'linear-gradient(135deg, rgba(252,254,253,0.95) 0%, rgba(240,242,248,0.97) 100%)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: isDark
                  ? '1px solid rgba(255,255,255,0.08)'
                  : '1px solid rgba(6,5,65,0.1)',
                boxShadow: isDark
                  ? '0 0 40px hsla(210, 100%, 65%, 0.15), 0 8px 32px hsla(0, 0%, 0%, 0.6)'
                  : '0 8px 40px hsla(243, 84%, 14%, 0.15)',
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold" style={{ color: isDark ? '#f2f2f2' : '#060541' }}>
                    {t('Wakti Voice', 'صوت وقتي')}
                  </span>
                  {voiceState !== 'idle' && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(6,5,65,0.08)',
                        color: isDark ? 'hsl(210, 100%, 65%)' : '#060541',
                      }}
                    >
                      {stateLabel()}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-full transition-colors"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(6,5,65,0.06)',
                  }}
                >
                  <X className="h-4 w-4" style={{ color: isDark ? '#858384' : '#606062' }} />
                </button>
              </div>

              {/* Content area */}
              <div className="flex-1 flex flex-col items-center justify-center px-5 overflow-y-auto gap-4">

                {/* AI transcript (greeting) */}
                {(voiceState === 'greeting' || voiceState === 'connecting') && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center"
                  >
                    {voiceState === 'connecting' && (
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" style={{ color: isDark ? 'hsl(210,100%,65%)' : '#060541' }} />
                    )}
                    <p className="text-base" style={{ color: isDark ? '#f2f2f2' : '#060541' }}>
                      {aiTranscript || (voiceState === 'connecting' ? t('Connecting...', 'جارٍ الاتصال...') : '')}
                    </p>
                  </motion.div>
                )}

                {/* Listening state */}
                {voiceState === 'listening' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-4"
                  >
                    {/* Pulse ring */}
                    <div className="relative">
                      <motion.div
                        animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.1, 0.4] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: isDark
                            ? 'radial-gradient(circle, hsla(210,100%,65%,0.3) 0%, transparent 70%)'
                            : 'radial-gradient(circle, hsla(243,84%,14%,0.2) 0%, transparent 70%)',
                          width: '120px',
                          height: '120px',
                          top: '-20px',
                          left: '-20px',
                        }}
                      />
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={toggleListening}
                        aria-label={t('Stop listening', 'إيقاف الاستماع')}
                        className="relative z-10 rounded-full h-20 w-20 flex items-center justify-center"
                        style={{
                          background: isDark
                            ? 'linear-gradient(135deg, hsl(210,100%,65%) 0%, hsl(280,70%,65%) 100%)'
                            : 'linear-gradient(135deg, #060541 0%, hsl(260,70%,25%) 100%)',
                          boxShadow: isDark
                            ? '0 0 30px hsla(210,100%,65%,0.5)'
                            : '0 4px 20px hsla(243,84%,14%,0.3)',
                        }}
                      >
                        <Mic className="h-8 w-8 text-white" />
                      </motion.button>
                    </div>
                    <p className="text-sm" style={{ color: isDark ? '#858384' : '#606062' }}>
                      {t('Listening... speak now', 'أستمع... تحدث الآن')}
                    </p>
                    {transcript && (
                      <p className="text-sm text-center mt-2" style={{ color: isDark ? '#f2f2f2' : '#060541' }}>
                        "{transcript}"
                      </p>
                    )}
                  </motion.div>
                )}

                {/* Thinking */}
                {voiceState === 'thinking' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <Loader2 className="h-8 w-8 animate-spin" style={{ color: isDark ? 'hsl(210,100%,65%)' : '#060541' }} />
                    <p className="text-sm" style={{ color: isDark ? '#858384' : '#606062' }}>
                      {t('Processing...', 'جارٍ المعالجة...')}
                    </p>
                  </motion.div>
                )}

                {/* Confirming — show extracted entry */}
                {voiceState === 'confirming' && extractedEntry && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full space-y-3"
                  >
                    <p className="text-xs text-center mb-2" style={{ color: isDark ? '#858384' : '#606062' }}>
                      {t('You said:', 'قلت:')} "{transcript}"
                    </p>

                    {/* Preview card */}
                    <div
                      className="rounded-xl p-4 space-y-2"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(6,5,65,0.04)',
                        border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(6,5,65,0.08)',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium" style={{ color: isDark ? '#858384' : '#606062' }}>
                          {t('Title', 'العنوان')}
                        </span>
                      </div>
                      <p className="text-base font-semibold" style={{ color: isDark ? '#f2f2f2' : '#060541' }}>
                        {extractedEntry.title}
                      </p>

                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs font-medium" style={{ color: isDark ? '#858384' : '#606062' }}>
                          {t('Date', 'التاريخ')}
                        </span>
                      </div>
                      <p className="text-sm" style={{ color: isDark ? '#f2f2f2' : '#060541' }}>
                        {formatDateDisplay(extractedEntry.date)}
                      </p>

                      {extractedEntry.description && (
                        <>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs font-medium" style={{ color: isDark ? '#858384' : '#606062' }}>
                              {t('Description', 'الوصف')}
                            </span>
                          </div>
                          <p className="text-sm" style={{ color: isDark ? '#f2f2f2' : '#060541' }}>
                            {extractedEntry.description}
                          </p>
                        </>
                      )}
                    </div>

                    {/* Confirm / Retry buttons */}
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={toggleListening}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
                        style={{
                          background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(6,5,65,0.06)',
                          color: isDark ? '#f2f2f2' : '#060541',
                        }}
                      >
                        {t('Try again', 'حاول مرة أخرى')}
                      </button>
                      <button
                        onClick={handleConfirm}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-colors"
                        style={{
                          background: isDark
                            ? 'linear-gradient(135deg, hsl(142,76%,55%) 0%, hsl(160,80%,45%) 100%)'
                            : 'linear-gradient(135deg, hsl(142,76%,40%) 0%, hsl(160,80%,35%) 100%)',
                        }}
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          <Check className="h-4 w-4" />
                          {t('Confirm & Save', 'تأكيد وحفظ')}
                        </span>
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Done */}
                {voiceState === 'done' && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <div
                      className="h-16 w-16 rounded-full flex items-center justify-center"
                      style={{
                        background: isDark
                          ? 'linear-gradient(135deg, hsl(142,76%,55%) 0%, hsl(160,80%,45%) 100%)'
                          : 'linear-gradient(135deg, hsl(142,76%,40%) 0%, hsl(160,80%,35%) 100%)',
                      }}
                    >
                      <Check className="h-8 w-8 text-white" />
                    </div>
                    <p className="text-base font-semibold" style={{ color: isDark ? '#f2f2f2' : '#060541' }}>
                      {t('Saved!', 'تم الحفظ!')}
                    </p>
                  </motion.div>
                )}

                {/* Error */}
                {voiceState === 'error' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <p className="text-sm text-red-500">{errorMsg}</p>
                    <button
                      onClick={() => {
                        cleanup();
                        initializeConnection();
                      }}
                      className="px-4 py-2 rounded-xl text-sm font-medium"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(6,5,65,0.06)',
                        color: isDark ? '#f2f2f2' : '#060541',
                      }}
                    >
                      {t('Try again', 'حاول مرة أخرى')}
                    </button>
                  </motion.div>
                )}
              </div>

              {/* Bottom controls */}
              <div className="px-5 pb-5 pt-2 flex flex-col gap-2">
                {/* Type instead */}
                {(voiceState === 'listening' || voiceState === 'idle') && !typeMode && (
                  <button
                    onClick={() => setTypeMode(true)}
                    className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-xl transition-colors"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(6,5,65,0.04)',
                      color: isDark ? '#858384' : '#606062',
                    }}
                  >
                    <Type className="h-3.5 w-3.5" />
                    {t('Type instead', 'اكتب بدلاً من ذلك')}
                  </button>
                )}

                {/* Type input */}
                {typeMode && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={typedText}
                      onChange={(e) => setTypedText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleTypeSubmit()}
                      placeholder={t('e.g. Doctor tomorrow', 'مثال: دكتور غداً')}
                      autoFocus
                      className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(6,5,65,0.06)',
                        color: isDark ? '#f2f2f2' : '#060541',
                        border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(6,5,65,0.1)',
                      }}
                    />
                    <button
                      onClick={handleTypeSubmit}
                      className="px-4 py-2 rounded-xl text-sm font-medium text-white"
                      style={{
                        background: isDark
                          ? 'linear-gradient(135deg, hsl(210,100%,65%) 0%, hsl(280,70%,65%) 100%)'
                          : 'linear-gradient(135deg, #060541 0%, hsl(260,70%,25%) 100%)',
                      }}
                    >
                      {t('Go', 'تم')}
                    </button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default VoiceAssistant;
