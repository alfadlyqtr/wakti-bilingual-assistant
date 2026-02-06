import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Check, RotateCcw, Pencil, SkipForward, Eye, EyeOff, Lock, Loader2 } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { Logo3D } from '@/components/Logo3D';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { countries } from '@/utils/countries';
import { validateDisplayName, validateEmail, validatePassword, validateConfirmPassword } from '@/utils/validations';

// ─── Types ───────────────────────────────────────────────────────────────────

type StepId = 'greeting' | 'name' | 'username' | 'email' | 'password' | 'confirm_password' | 'dob' | 'country' | 'city' | 'terms' | 'creating' | 'welcome';

interface StepDef {
  id: StepId;
  required: boolean;
  voice: boolean; // whether user answers by voice (false = typed / tap)
  questionEn: string;
  questionAr: string;
}

const STEPS: StepDef[] = [
  { id: 'greeting',         required: true,  voice: false, questionEn: '', questionAr: '' },
  { id: 'name',             required: true,  voice: true,  questionEn: "What's your name?", questionAr: 'ما اسمك؟' },
  { id: 'username',         required: true,  voice: true,  questionEn: 'Choose a username.', questionAr: 'اختر اسم مستخدم.' },
  { id: 'email',            required: true,  voice: true,  questionEn: "What's your email address?", questionAr: 'ما بريدك الإلكتروني؟' },
  { id: 'password',         required: true,  voice: false, questionEn: 'For privacy, please type your password.', questionAr: 'للخصوصية، اكتب كلمة المرور.' },
  { id: 'confirm_password', required: true,  voice: false, questionEn: 'Please confirm your password.', questionAr: 'أكد كلمة المرور.' },
  { id: 'dob',              required: false, voice: true,  questionEn: 'When were you born? You can skip this.', questionAr: 'متى ولدت؟ يمكنك تخطي هذا.' },
  { id: 'country',          required: false, voice: true,  questionEn: 'Which country are you from? You can skip this.', questionAr: 'من أي بلد أنت؟ يمكنك تخطي هذا.' },
  { id: 'city',             required: false, voice: true,  questionEn: 'Which city? You can skip this.', questionAr: 'أي مدينة؟ يمكنك تخطي هذا.' },
  { id: 'terms',            required: true,  voice: false, questionEn: 'Please agree to our Privacy Policy and Terms of Service.', questionAr: 'يرجى الموافقة على سياسة الخصوصية وشروط الخدمة.' },
  { id: 'creating',         required: true,  voice: false, questionEn: 'Creating your account...', questionAr: 'جارٍ إنشاء حسابك...' },
  { id: 'welcome',          required: true,  voice: false, questionEn: '', questionAr: '' },
];

// ─── Spelled-out letter joiner ────────────────────────────────────────────────
// Handles "A-B-D-U-L-L-A-H" or "a b d u l l a h" → "abdullah"
function joinSpelledLetters(raw: string): string {
  // Check if input looks like spelled-out letters (single chars separated by spaces, dashes, or dots)
  const parts = raw.trim().split(/[\s\-\.]+/);
  const isArabicChar = (s: string) => /^[\u0600-\u06FF]$/u.test(s);
  const isLatinOrDigit = (s: string) => /^[a-z0-9]$/i.test(s);
  const allSingleChars = parts.length >= 3 && parts.every(p => p.length === 1 && (isLatinOrDigit(p) || isArabicChar(p)));
  if (allSingleChars) {
    const joined = parts.join('');
    // If it was Latin/digits, normalize to lower; if Arabic, keep as-is
    return /[a-z0-9]/i.test(joined) ? joined.toLowerCase() : joined;
  }
  return raw;
}

// ─── Email cleanup helper ────────────────────────────────────────────────────

function cleanEmail(raw: string): string {
  let e = raw.trim().toLowerCase();
  // First try joining spelled-out letters in the local part
  // e.g. "v x r 10 at hotmail dot com" → handle the spelled part
  const atMatch = e.match(/^(.+?)\s*(at|@|آت)\s*(.+)$/i);
  if (atMatch) {
    let local = joinSpelledLetters(atMatch[1].trim());
    let domain = atMatch[3].trim();
    e = local + '@' + domain;
  }
  // Common speech-to-text patterns
  e = e.replace(/\s*at\s*/gi, '@');
  e = e.replace(/\s*آت\s*/gi, '@');
  e = e.replace(/\s*dot\s*/gi, '.');
  e = e.replace(/\s*دوت\s*/gi, '.');
  e = e.replace(/\s*نقطة\s*/gi, '.');
  e = e.replace(/\s*point\s*/gi, '.');
  // Remove all remaining spaces
  e = e.replace(/\s+/g, '');
  // Fix double @@ or ..
  e = e.replace(/@@+/g, '@');
  e = e.replace(/\.\./g, '.');
  return e;
}

// ─── Smart name extraction ───────────────────────────────────────────────────

function extractName(raw: string): string {
  let name = raw.trim();
  // Try joining spelled-out letters first (A-B-D-U-L-L-A-H → Abdullah)
  const spelled = joinSpelledLetters(name);
  if (spelled !== name) {
    // It was spelled out — capitalize first letter
    return /[a-z]/i.test(spelled)
      ? spelled.charAt(0).toUpperCase() + spelled.slice(1)
      : spelled;
  }
  // Strip common prefixes in English
  name = name.replace(/^(my name is|i'm|i am|it's|its|call me|they call me|this is|hey i'm|hi i'm|hello i'm)\s+/i, '');
  // Strip common prefixes in Arabic
  name = name.replace(/^(اسمي|أنا|انا|اسمي هو|يسموني)\s+/i, '');
  // Remove trailing period/comma
  name = name.replace(/[.,!?]+$/, '').trim();
  // Check if the remaining text is spelled out
  const spelledAfter = joinSpelledLetters(name);
  if (spelledAfter !== name) {
    return /[a-z]/i.test(spelledAfter)
      ? spelledAfter.charAt(0).toUpperCase() + spelledAfter.slice(1)
      : spelledAfter;
  }
  // Capitalize first letter of each word (Latin only). Arabic should be preserved as-is.
  if (/[a-z]/i.test(name)) {
    name = name.replace(/\b\w/g, c => c.toUpperCase());
  }
  return name;
}

function extractUsername(raw: string): string {
  let u = raw.trim().toLowerCase();
  // Strip common prefixes and filler phrases
  u = u.replace(/^(my username is|my username should be|my username would be|username is|username should be|i want|i'd like|i would like|call me|make it|let's go with|how about|it should be|it would be|it's|its)\s+/i, '');
  u = u.replace(/^(اسم المستخدم|اسم المستخدم هو|أريد|اريد|يكون|خليه)\s+/i, '');
  // Remove trailing period/comma
  u = u.replace(/[.,!?]+$/, '').trim();
  // Try joining spelled-out letters (a-l-f-a-d-l-y → alfadly)
  const spelled = joinSpelledLetters(u);
  if (spelled !== u) {
    return spelled.replace(/[^a-z0-9_]/g, '');
  }
  // Replace spaces with underscores, remove special chars
  u = u.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  return u;
}

// ─── Country fuzzy match ─────────────────────────────────────────────────────

function matchCountry(spoken: string): { code: string; name: string; nameAr: string } | null {
  const lower = spoken.trim().toLowerCase();
  // Try exact match first
  const exact = countries.find(c =>
    c.name.toLowerCase() === lower ||
    c.nameAr === spoken.trim() ||
    c.code.toLowerCase() === lower
  );
  if (exact) return exact;
  // Try includes
  const partial = countries.find(c =>
    c.name.toLowerCase().includes(lower) ||
    lower.includes(c.name.toLowerCase()) ||
    c.nameAr.includes(spoken.trim())
  );
  return partial || null;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface VoiceSignupProps {
  onSignupComplete: (needsEmailConfirmation: boolean) => void;
  onError: (msg: string) => void;
}

type SpeechKind = 'greeting' | 'question' | 'remark';

export function VoiceSignup({ onSignupComplete, onError }: VoiceSignupProps) {
  const { language, theme } = useTheme();
  const t = useCallback((en: string, ar: string) => (language === 'ar' ? ar : en), [language]);

  // ─── Form data ─────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    dob: '',
    country: '',
    countryCode: '',
    city: '',
    agreedToTerms: false,
  });

  // ─── Step state ────────────────────────────────────────────────────────────
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<'asking' | 'listening' | 'confirming' | 'editing'>('asking');
  const [capturedValue, setCapturedValue] = useState('');
  const [editValue, setEditValue] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  // ─── Connection state ──────────────────────────────────────────────────────
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'ready' | 'listening' | 'processing' | 'speaking'>('idle');
  const [aiTranscript, setAiTranscript] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // ─── Password visibility ───────────────────────────────────────────────────
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ─── WebRTC refs ───────────────────────────────────────────────────────────
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const isHoldingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const holdStartRef = useRef(0);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [countdown, setCountdown] = useState(10);
  const [isHolding, setIsHolding] = useState(false);
  const isConnectionReadyRef = useRef(false);
  const initializingRef = useRef(false);
  const stepIndexRef = useRef(stepIndex);
  stepIndexRef.current = stepIndex;
  const [greetingDone, setGreetingDone] = useState(false);
  const greetingDoneRef = useRef(false);
  const greetingSpokeRef = useRef(false);
  const questionSpokenForStepRef = useRef(-1);
  const [cardVisible, setCardVisible] = useState(false);
  const cardTimerRef = useRef<NodeJS.Timeout | null>(null);
  const intentionalSpeechRef = useRef(false);
  const [greetingFinished, setGreetingFinished] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const speechKindRef = useRef<SpeechKind>('question');
  const pendingAdvanceToStepRef = useRef<number | null>(null);

  const currentStep = STEPS[stepIndex];
  const MAX_RECORD_SECONDS = 10;

  const unlockAudio = useCallback(async () => {
    if (audioUnlocked) return;

    try {
      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
      }
    } catch (e) {
      console.warn('[VoiceSignup] Failed to resume AudioContext:', e);
    }

    try {
      if (audioRef.current) {
        audioRef.current.muted = false;
        audioRef.current.volume = 1;
        await audioRef.current.play();
      }
      setAudioUnlocked(true);
    } catch (e) {
      console.warn('[VoiceSignup] Audio play blocked (needs user gesture):', e);
    }
  }, [audioUnlocked]);

  // ─── Cleanup ───────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (audioContextRef.current) { try { audioContextRef.current.close(); } catch {} audioContextRef.current = null; }
    if (dcRef.current) { try { dcRef.current.close(); } catch {} dcRef.current = null; }
    if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }
    isConnectionReadyRef.current = false;
    setConnectionStatus('idle');
  }, []);

  useEffect(() => { return () => cleanup(); }, [cleanup]);

  // ─── Initialize OpenAI Realtime connection ─────────────────────────────────
  const initializeConnection = useCallback(async () => {
    if (initializingRef.current) return;
    initializingRef.current = true;
    setConnectionStatus('connecting');

    if (dcRef.current) { try { dcRef.current.close(); } catch {} dcRef.current = null; }
    if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }

    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      if (audioContextRef.current) { try { audioContextRef.current.close(); } catch {} }
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      stream.getAudioTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (audioRef.current && event.streams[0]) {
          audioRef.current.srcObject = event.streams[0];
          audioRef.current.muted = false;
          audioRef.current.volume = 1;
          audioRef.current.play().catch((e) => {
            console.warn('[VoiceSignup] Remote audio autoplay blocked:', e);
          });
        }
      };

      const dc = pc.createDataChannel('oai-events', { ordered: true });
      dcRef.current = dc;

      dc.onopen = () => {
        console.log('[VoiceSignup] Data channel open — sending session config + greeting');
        const instructions = t(
          `You are a voice-controlled signup form assistant. You are NOT a chatbot. You do NOT have conversations. You NEVER offer help, ask questions, or generate any speech on your own. You ONLY speak when given an explicit instruction that starts with "Say EXACTLY this". If you receive any audio input, do NOT respond to it — just transcribe it silently. NEVER generate any response unless explicitly instructed.`,
          `أنت مساعد نموذج تسجيل صوتي. أنت لست روبوت محادثة. لا تتحدث أبدًا من تلقاء نفسك. لا تعرض المساعدة. لا تسأل أسئلة. تحدث فقط عندما يُطلب منك بالضبط "قل بالضبط هذا". إذا استلمت أي صوت، لا ترد عليه — فقط انسخه بصمت.`
        );

        const openaiVoice = 'shimmer';
        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            instructions,
            voice: openaiVoice,
            input_audio_transcription: language === 'ar'
              ? { model: 'whisper-1', language: 'ar' }
              : { model: 'whisper-1' },
            turn_detection: null,
          }
        }));

        isConnectionReadyRef.current = true;

        // Speak greeting directly here — DC is guaranteed open
        if (!greetingSpokeRef.current) {
          greetingSpokeRef.current = true;
          const greeting = t(
            "Welcome! And thank you for choosing to create an account. You are going to love Wakti! I will fill up the form for you. You can say your answer, or spell it letter by letter. Now, please press the button to begin.",
            'مرحبًا! وشكرًا لاختيارك إنشاء حساب. ستحب وقتي! سأملأ النموذج لك. يمكنك قول الإجابة أو تهجئتها حرفًا حرفًا. الآن اضغط زر «ابدأ» للمتابعة.'
          );
          setAiTranscript('');
          setConnectionStatus('speaking');
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
        } else {
          setConnectionStatus('ready');
        }
      };

      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleRealtimeEvent(msg);
        } catch {}
      };

      dc.onerror = () => {
        setConnectionStatus('idle');
        isConnectionReadyRef.current = false;
      };

      dc.onclose = () => {
        isConnectionReadyRef.current = false;
        setConnectionStatus('idle');
      };

      await pc.setLocalDescription();
      const offer = pc.localDescription;
      if (!offer) throw new Error('Failed to create SDP offer');

      const response = await supabase.functions.invoke('live-voice-signup', {
        body: { sdp_offer: offer.sdp, language },
      });

      if (response.error || !response.data?.sdp_answer) {
        throw new Error(response.error?.message || 'Failed to get SDP answer');
      }

      await pc.setRemoteDescription({ type: 'answer', sdp: response.data.sdp_answer });
    } catch (err: any) {
      console.error('[VoiceSignup] Connection failed:', err);
      setConnectionStatus('idle');
      isConnectionReadyRef.current = false;
      initializingRef.current = false;
    }
  }, [language, t]);

  // ─── Process voice answer for current step ─────────────────────────────────
  const processVoiceAnswer = useCallback((transcript: string) => {
    const step = STEPS[stepIndexRef.current];
    if (!step) return;

    let cleaned = transcript;
    switch (step.id) {
      case 'name':
        cleaned = extractName(transcript);
        break;
      case 'username':
        cleaned = extractUsername(transcript);
        break;
      case 'email':
        cleaned = cleanEmail(transcript);
        break;
    }

    console.log('[VoiceSignup] Captured:', transcript, '→ cleaned:', cleaned);
    setCapturedValue(cleaned);
    setEditValue(cleaned);
    setPhase('confirming');
  }, []);

  const pickRemark = useCallback((stepId: StepId, value: string) => {
    const v = value.trim();
    if (language === 'ar') {
      const remarksByStep: Record<StepId, string[]> = {
        greeting: [],
        name: [
          `تشرفنا يا ${v}.`,
          `تمام يا ${v}.`,
          `حلو! تشرفنا يا ${v}.`,
        ],
        username: [
          'اختيار ممتاز.',
          'اسم مستخدم جميل.',
          'تمام، خيار قوي.',
        ],
        email: [
          'تمام، سجلته.',
          'وصلتني. شكرًا.',
          'ممتاز.',
        ],
        password: [],
        confirm_password: [],
        dob: [
          'تمام.',
          'ممتاز.',
          'وصلت.',
        ],
        country: [
          'حلو.',
          'تمام.',
          'ممتاز.',
        ],
        city: [
          'جميل.',
          'تمام.',
          'ممتاز.',
        ],
        terms: [],
        creating: [],
        welcome: [],
      };
      const list = remarksByStep[stepId] || ['تمام.'];
      return list[Math.floor(Math.random() * list.length)];
    }

    const remarksByStep: Record<StepId, string[]> = {
      greeting: [],
      name: [
        `Perfect. Nice to meet you, ${v}.`,
        `Great. Nice to meet you, ${v}.`,
        `Awesome — nice to meet you, ${v}.`,
      ],
      username: [
        'Nice username.',
        'Great choice.',
        'Perfect.',
      ],
      email: [
        'Got it.',
        "Perfect — I've saved it.",
        'Great.',
      ],
      password: [],
      confirm_password: [],
      dob: [
        'Perfect.',
        'Great.',
        'Nice.',
      ],
      country: [
        'Perfect.',
        'Sounds good.',
        'Nice.',
      ],
      city: [
        'Perfect.',
        'Nice.',
        'Great.',
      ],
      terms: [],
      creating: [],
      welcome: [],
    };
    const list = remarksByStep[stepId] || ['Perfect.'];
    return list[Math.floor(Math.random() * list.length)];
  }, [language]);

  const speakUtterance = useCallback((text: string, kind: SpeechKind) => {
    if (!dcRef.current || dcRef.current.readyState !== 'open') {
      console.warn('[VoiceSignup] Cannot speak - data channel not open');
      return;
    }
    setAiTranscript('');
    setConnectionStatus('speaking');
    intentionalSpeechRef.current = true;
    speechKindRef.current = kind;

    dcRef.current.send(JSON.stringify({
      type: 'session.update',
      session: {
        instructions: t(
          `Say EXACTLY this and nothing else: "${text}"`,
          `قل بالضبط هذا ولا شيء آخر: "${text}"`
        )
      }
    }));
    dcRef.current.send(JSON.stringify({ type: 'response.create' }));
  }, [t]);

  // ─── Handle realtime events ────────────────────────────────────────────────
  const handleRealtimeEvent = useCallback((msg: any) => {
    switch (msg.type) {
      case 'conversation.item.input_audio_transcription.completed': {
        const transcript = msg.transcript?.trim() || '';
        // AGGRESSIVELY cancel any AI auto-response — we only want the transcription, not chatbot replies
        try {
          if (dcRef.current?.readyState === 'open') {
            dcRef.current.send(JSON.stringify({ type: 'response.cancel' }));
            // Also update instructions to reinforce: do NOT reply
            dcRef.current.send(JSON.stringify({
              type: 'session.update',
              session: {
                instructions: 'Do NOT respond. Do NOT speak. Wait for explicit instructions only.'
              }
            }));
          }
        } catch {}
        if (transcript.length > 0) {
          setConnectionStatus('ready');
          processVoiceAnswer(transcript);
        } else {
          setConnectionStatus('ready');
        }
        break;
      }
      case 'response.audio_transcript.delta': {
        // Only show transcript during intentional speech (greeting/question), not AI auto-replies
        if (intentionalSpeechRef.current) {
          setConnectionStatus('speaking');
          if (msg.delta) setAiTranscript(prev => prev + msg.delta);
        }
        break;
      }
      case 'response.audio_transcript.done':
        break;
      case 'response.done': {
        console.log('[VoiceSignup] Response done, step:', STEPS[stepIndexRef.current]?.id, 'intentional:', intentionalSpeechRef.current);
        // IGNORE any response that we didn't explicitly trigger
        if (!intentionalSpeechRef.current) {
          console.log('[VoiceSignup] Ignoring unsolicited AI response');
          // Kill it just in case
          try {
            if (dcRef.current?.readyState === 'open') {
              dcRef.current.send(JSON.stringify({ type: 'response.cancel' }));
            }
          } catch {}
          break;
        }
        intentionalSpeechRef.current = false;
        // IMMEDIATELY silence the AI after every intentional speech to prevent follow-up chatbot replies
        try {
          if (dcRef.current?.readyState === 'open') {
            dcRef.current.send(JSON.stringify({ type: 'response.cancel' }));
            dcRef.current.send(JSON.stringify({
              type: 'session.update',
              session: {
                instructions: 'Do NOT respond. Do NOT speak. Do NOT generate any output. Wait silently for explicit instructions only. NEVER offer assistance.'
              }
            }));
          }
        } catch {}
        if (speechKindRef.current === 'remark' && pendingAdvanceToStepRef.current !== null) {
          const next = pendingAdvanceToStepRef.current;
          pendingAdvanceToStepRef.current = null;
          setConnectionStatus('ready');
          setTransitioning(false);
          setAiTranscript('');
          setPhase('asking');
          setStepIndex(next);
          break;
        }

        if (STEPS[stepIndexRef.current]?.id === 'greeting' && greetingSpokeRef.current && !greetingDoneRef.current) {
          greetingDoneRef.current = true;
          setConnectionStatus('ready');
          // Show "Let's Begin" button — user controls when to advance
          setGreetingFinished(true);
        } else {
          // Question finished speaking — delay then reveal the input card
          setConnectionStatus('ready');
          if (cardTimerRef.current) clearTimeout(cardTimerRef.current);
          cardTimerRef.current = setTimeout(() => {
            setAiTranscript('');
            setCardVisible(true);
          }, 1200);
        }
        break;
      }
      case 'error':
        if (!msg.error?.message?.includes('buffer too small') && !msg.error?.message?.includes('response.cancel')) {
          console.error('[VoiceSignup] Realtime error:', msg.error);
          setConnectionStatus('ready');
        }
        break;
      default:
        break;
    }
  }, [processVoiceAnswer]);

  // ─── Make AI speak a question ──────────────────────────────────────────────
  const speakQuestion = useCallback((text: string) => {
    if (!dcRef.current || dcRef.current.readyState !== 'open') {
      console.warn('[VoiceSignup] Cannot speak - data channel not open');
      return;
    }
    setAiTranscript('');
    setConnectionStatus('speaking');
    intentionalSpeechRef.current = true;
    speechKindRef.current = 'question';

    dcRef.current.send(JSON.stringify({
      type: 'session.update',
      session: {
        instructions: t(
          `Say EXACTLY this and nothing else: "${text}"`,
          `قل بالضبط هذا ولا شيء آخر: "${text}"`
        )
      }
    }));
    dcRef.current.send(JSON.stringify({ type: 'response.create' }));
  }, [t]);

  // ─── Auto-start connection and greeting on mount ───────────────────────────
  useEffect(() => {
    initializeConnection();
  }, [initializeConnection]);

  // Greeting is now spoken directly inside dc.onopen — no separate effect needed

  // ─── When step changes, speak the question (only once per step) ────────────
  useEffect(() => {
    if (!currentStep || currentStep.id === 'greeting' || currentStep.id === 'creating' || currentStep.id === 'welcome') return;
    if (phase !== 'asking') return;
    if (questionSpokenForStepRef.current === stepIndex) return;
    if (connectionStatus !== 'ready') return;

    questionSpokenForStepRef.current = stepIndex;
    setCardVisible(false);
    if (cardTimerRef.current) clearTimeout(cardTimerRef.current);
    const question = language === 'ar' ? currentStep.questionAr : currentStep.questionEn;
    if (question) {
      const timer = setTimeout(() => {
        speakQuestion(question);
      }, 1400);
      return () => clearTimeout(timer);
    }
  }, [stepIndex, phase, currentStep, connectionStatus, language, speakQuestion]);

  // ─── Hold-to-talk handlers ─────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    if (!isConnectionReadyRef.current || !dcRef.current || dcRef.current.readyState !== 'open') return;
    isStoppingRef.current = false;
    dcRef.current.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
    setConnectionStatus('listening');
    setCountdown(MAX_RECORD_SECONDS);
    holdStartRef.current = Date.now();

    countdownIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - holdStartRef.current) / 1000);
      const remaining = Math.max(0, MAX_RECORD_SECONDS - elapsed);
      setCountdown(remaining);
      if (remaining <= 0) stopRecording();
    }, 200);
  }, []);

  const stopRecording = useCallback(() => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }

    const holdDuration = Date.now() - holdStartRef.current;
    if (holdDuration < 500) {
      setIsHolding(false);
      isHoldingRef.current = false;
      setConnectionStatus('ready');
      if (dcRef.current?.readyState === 'open') {
        dcRef.current.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
      }
      setTimeout(() => { isStoppingRef.current = false; }, 300);
      return;
    }

    setIsHolding(false);
    isHoldingRef.current = false;
    setConnectionStatus('processing');

    if (dcRef.current?.readyState === 'open') {
      console.log('[VoiceSignup] Committing audio buffer (transcription only, no AI reply)');
      dcRef.current.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    }
    setTimeout(() => { isStoppingRef.current = false; }, 1000);
  }, []);

  const handleHoldStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    unlockAudio();
    if (connectionStatus === 'ready' && currentStep?.voice && (phase === 'asking' || phase === 'editing')) {
      setIsHolding(true);
      isHoldingRef.current = true;
      startRecording();
    }
  }, [connectionStatus, currentStep, phase, startRecording, unlockAudio]);

  const handleHoldEnd = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (isHolding) stopRecording();
  }, [isHolding, stopRecording]);

  // ─── Confirm captured value ────────────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    if (!currentStep) return;
    setFieldError(null);

    const value = editValue.trim();

    // Validate
    switch (currentStep.id) {
      case 'name': {
        const err = validateDisplayName(value);
        if (err) { setFieldError(err); return; }
        setFormData(prev => ({ ...prev, name: value }));
        break;
      }
      case 'username': {
        if (!value) { setFieldError(t('Username is required', 'اسم المستخدم مطلوب')); return; }
        setFormData(prev => ({ ...prev, username: value.replace(/\s+/g, '_').toLowerCase() }));
        break;
      }
      case 'email': {
        const err = validateEmail(value);
        if (err) { setFieldError(err); return; }
        setFormData(prev => ({ ...prev, email: value }));
        break;
      }
      case 'dob': {
        // Try to parse date from spoken text (e.g., "January 15 1990" or "1990-01-15")
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
          setFormData(prev => ({ ...prev, dob: parsed.toISOString().split('T')[0] }));
        }
        // If can't parse, just store raw (user can edit later)
        break;
      }
      case 'country': {
        const matched = matchCountry(value);
        if (matched) {
          setFormData(prev => ({ ...prev, country: matched.name, countryCode: matched.code }));
        } else {
          setFormData(prev => ({ ...prev, country: value }));
        }
        break;
      }
      case 'city': {
        setFormData(prev => ({ ...prev, city: value }));
        break;
      }
    }

    if (currentStep.voice) {
      const remark = pickRemark(currentStep.id, value);
      setTransitioning(true);
      setCardVisible(false);
      setCapturedValue('');
      setEditValue('');
      setAiTranscript('');
      pendingAdvanceToStepRef.current = stepIndexRef.current + 1;
      setTimeout(() => {
        speakUtterance(remark, 'remark');
      }, 800);
      return;
    }

    setTransitioning(true);
    setCardVisible(false);
    setTimeout(() => {
      setStepIndex(prev => prev + 1);
      setPhase('asking');
      setCapturedValue('');
      setEditValue('');
      setAiTranscript('');
      setTransitioning(false);
    }, 1200);
  }, [currentStep, editValue, pickRemark, speakUtterance, t]);

  // ─── Skip optional step ────────────────────────────────────────────────────
  const handleSkip = useCallback(() => {
    setTransitioning(true);
    setCardVisible(false);
    setTimeout(() => {
      setStepIndex(prev => prev + 1);
      setPhase('asking');
      setCapturedValue('');
      setEditValue('');
      setAiTranscript('');
      setFieldError(null);
      setTransitioning(false);
    }, 1200);
  }, []);

  // ─── Edit mode ─────────────────────────────────────────────────────────────
  const handleEdit = useCallback(() => {
    setPhase('editing');
  }, []);

  // ─── Retry voice ───────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    setCapturedValue('');
    setEditValue('');
    setPhase('asking');
    setFieldError(null);
    questionSpokenForStepRef.current = -1;
  }, []);

  // ─── Password typed submit ─────────────────────────────────────────────────
  const handlePasswordSubmit = useCallback(() => {
    setFieldError(null);
    if (currentStep?.id === 'password') {
      const err = validatePassword(formData.password);
      if (err) { setFieldError(err); return; }
      setTransitioning(true);
      setCardVisible(false);
      setTimeout(() => {
        setStepIndex(prev => prev + 1);
        setPhase('asking');
        setTransitioning(false);
      }, 1200);
    } else if (currentStep?.id === 'confirm_password') {
      const err = validateConfirmPassword(formData.password, formData.confirmPassword);
      if (err) { setFieldError(err); return; }
      setTransitioning(true);
      setCardVisible(false);
      setTimeout(() => {
        setStepIndex(prev => prev + 1);
        setPhase('asking');
        setTransitioning(false);
      }, 1200);
    }
  }, [currentStep, formData.password, formData.confirmPassword]);

  // ─── Terms agree ───────────────────────────────────────────────────────────
  const handleTermsAgree = useCallback(() => {
    if (!formData.agreedToTerms) return;
    setTransitioning(true);
    setCardVisible(false);
    setTimeout(() => {
      setStepIndex(prev => prev + 1);
      setPhase('asking');
      setTransitioning(false);
    }, 1200);
  }, [formData.agreedToTerms]);

  // ─── Final signup ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (currentStep?.id !== 'creating' || isSigningUp) return;

    const doSignup = async () => {
      setIsSigningUp(true);
      try {
        const redirectUrl = `${window.location.origin}/confirmed`;
        const selectedCountry = countries.find(c => c.code === formData.countryCode || c.name === formData.country);

        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              full_name: formData.name,
              username: formData.username,
              date_of_birth: formData.dob || '',
              country: selectedCountry?.name || formData.country || '',
              country_code: selectedCountry?.code || formData.countryCode || '',
              city: formData.city || '',
            },
          },
        });

        if (error) {
          if (error.status === 422 || error.message?.toLowerCase().includes('weak') || error.message?.toLowerCase().includes('easy to guess')) {
            onError(t('Please choose a different password. Try making it more unique.', 'يرجى اختيار كلمة مرور مختلفة. حاول جعلها أكثر تميزًا.'));
          } else {
            onError(error.message);
          }
          // Go back to password step
          setStepIndex(STEPS.findIndex(s => s.id === 'password'));
          setPhase('asking');
          setIsSigningUp(false);
          return;
        }

        if (data?.user) {
          // Speak welcome
          setStepIndex(STEPS.findIndex(s => s.id === 'welcome'));
          const welcomeMsg = t(
            "Welcome to Wakti! You have free access for 24 hours. Don't forget to subscribe. Check your email to confirm your account.",
            'مرحبًا بك في وقتي! لديك وصول مجاني لمدة 24 ساعة. لا تنسَ الاشتراك. تحقق من بريدك الإلكتروني لتأكيد حسابك.'
          );
          speakQuestion(welcomeMsg);

          setTimeout(() => {
            onSignupComplete(!data.user.email_confirmed_at);
          }, 6000);
        }
      } catch (err: any) {
        onError(err.message || t('An unexpected error occurred', 'حدث خطأ غير متوقع'));
        setIsSigningUp(false);
      }
    };

    doSignup();
  }, [currentStep?.id, isSigningUp, formData, onSignupComplete, onError, speakQuestion, t]);

  // ─── Render helpers ────────────────────────────────────────────────────────

  const isDark = theme === 'dark';
  const textColor = isDark ? 'text-[#f2f2f2]' : 'text-[#060541]';
  const textMuted = isDark ? 'text-[#858384]' : 'text-[#060541]/50';

  const orbStatusClass = connectionStatus === 'listening' ? 'listening'
    : connectionStatus === 'speaking' ? 'speaking'
    : connectionStatus === 'processing' ? 'processing'
    : '';

  // Progress
  const totalVoiceSteps = STEPS.filter(s => s.id !== 'greeting' && s.id !== 'creating' && s.id !== 'welcome').length;
  const currentVoiceStep = Math.min(stepIndex - 1, totalVoiceSteps);
  const progressPercent = Math.max(0, Math.min(100, (currentVoiceStep / totalVoiceSteps) * 100));

  // Show the input card only after AI finishes speaking + delay
  const showInputCard = currentStep && currentStep.id !== 'greeting' && currentStep.id !== 'creating' && currentStep.id !== 'welcome'
    && !transitioning
    && (cardVisible || phase === 'confirming' || phase === 'editing');

  // Handle "Let's Begin" button click
  const handleBegin = useCallback(() => {
    setStepIndex(1);
    setPhase('asking');
    setAiTranscript('');
    setConnectionStatus('ready');
    setGreetingFinished(false);
  }, []);

  return (
    <div
      className={`relative flex flex-col items-center justify-center py-8 px-5 max-w-md mx-auto select-none overflow-hidden rounded-[28px] ${
        isDark
          ? 'bg-gradient-to-b from-[#0a0d14] via-[#0c1018] to-[#080b12]'
          : 'bg-gradient-to-b from-[#f0f4f8] via-[#e8eef6] to-[#f5f8fc]'
      }`}
      style={{
        minHeight: '580px',
        boxShadow: isDark
          ? '0 0 100px hsla(220,70%,50%,0.06), 0 25px 70px rgba(0,0,0,0.5), 0 0 0 1px hsla(220,40%,25%,0.2), inset 0 1px 0 hsla(220,60%,70%,0.03)'
          : '0 0 80px hsla(220,60%,60%,0.08), 0 20px 60px rgba(6,5,65,0.08), 0 0 0 1px hsla(220,40%,80%,0.3), inset 0 1px 0 rgba(255,255,255,0.8)'
      }}
      onPointerDown={() => { unlockAudio(); }}
    >
      <audio ref={audioRef} autoPlay playsInline className="hidden" />

      {/* ═══════════════════════════════════════════════════════════════════════
          MAGIC MIRROR — Futuristic Glass Design (Theme-Aware)
          ═══════════════════════════════════════════════════════════════════════ */}
      <style>{`
        /* ── Ambient aurora ── */
        .vs-aurora {
          position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 0;
        }
        .vs-aurora::before {
          content: ''; position: absolute; width: 200%; height: 200%; top: -50%; left: -50%;
          background: ${isDark
            ? `radial-gradient(ellipse 40% 30% at 30% 20%, hsla(220,80%,50%,0.06) 0%, transparent 70%),
               radial-gradient(ellipse 35% 25% at 70% 75%, hsla(260,60%,40%,0.04) 0%, transparent 70%)`
            : `radial-gradient(ellipse 40% 30% at 30% 20%, hsla(220,80%,70%,0.15) 0%, transparent 70%),
               radial-gradient(ellipse 35% 25% at 70% 75%, hsla(260,60%,70%,0.1) 0%, transparent 70%)`
          };
          animation: vsAuroraDrift 20s ease-in-out infinite alternate;
        }
        .vs-aurora::after {
          content: ''; position: absolute; width: 150%; height: 150%; top: -25%; left: -25%;
          background: ${isDark
            ? `radial-gradient(ellipse 30% 35% at 65% 30%, hsla(180,60%,45%,0.04) 0%, transparent 70%)`
            : `radial-gradient(ellipse 30% 35% at 65% 30%, hsla(200,70%,75%,0.12) 0%, transparent 70%)`
          };
          animation: vsAuroraDrift 25s ease-in-out infinite alternate-reverse;
        }
        @keyframes vsAuroraDrift {
          0% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(2%, -1%) rotate(0.5deg); }
          100% { transform: translate(-1%, 1%) rotate(-0.3deg); }
        }

        /* ── Floating light motes ── */
        .vs-motes { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 0; }
        .vs-mote {
          position: absolute; border-radius: 50%;
          animation: vsMoteFloat linear infinite;
        }
        .vs-mote:nth-child(1) { width: 2px; height: 2px; left: 12%; animation-duration: 18s; animation-delay: 0s; background: ${isDark ? 'hsla(210,100%,75%,0.35)' : 'hsla(220,80%,55%,0.2)'}; filter: blur(0.5px); }
        .vs-mote:nth-child(2) { width: 3px; height: 3px; left: 28%; animation-duration: 22s; animation-delay: 3s; background: ${isDark ? 'hsla(200,80%,70%,0.25)' : 'hsla(260,60%,60%,0.15)'}; filter: blur(1px); }
        .vs-mote:nth-child(3) { width: 2px; height: 2px; left: 45%; animation-duration: 16s; animation-delay: 7s; background: ${isDark ? 'hsla(260,60%,75%,0.3)' : 'hsla(200,70%,55%,0.18)'}; filter: blur(0.5px); }
        .vs-mote:nth-child(4) { width: 1.5px; height: 1.5px; left: 62%; animation-duration: 20s; animation-delay: 1s; background: ${isDark ? 'hsla(180,70%,70%,0.25)' : 'hsla(180,60%,50%,0.15)'}; filter: blur(0.5px); }
        .vs-mote:nth-child(5) { width: 2px; height: 2px; left: 78%; animation-duration: 24s; animation-delay: 5s; background: ${isDark ? 'hsla(220,90%,80%,0.2)' : 'hsla(240,50%,60%,0.12)'}; filter: blur(1px); }
        .vs-mote:nth-child(6) { width: 1.5px; height: 1.5px; left: 90%; animation-duration: 19s; animation-delay: 9s; background: ${isDark ? 'hsla(240,50%,75%,0.25)' : 'hsla(210,70%,55%,0.15)'}; filter: blur(0.5px); }
        @keyframes vsMoteFloat {
          0% { transform: translateY(110%) translateX(0) scale(0); opacity: 0; }
          5% { opacity: 0.6; transform: translateY(95%) translateX(0) scale(0.6); }
          25% { transform: translateY(70%) translateX(12px) scale(0.9); opacity: 0.7; }
          50% { transform: translateY(45%) translateX(-8px) scale(1); opacity: 0.5; }
          75% { transform: translateY(20%) translateX(6px) scale(0.8); opacity: 0.3; }
          100% { transform: translateY(-10%) translateX(-4px) scale(0.3); opacity: 0; }
        }

        /* ── Mirror orb ── */
        .vs-orb-wrap {
          position: relative; width: 200px; height: 200px;
          display: flex; align-items: center; justify-content: center;
          z-index: 2; flex-shrink: 0;
        }
        .vs-orb-wrap::before {
          content: ''; position: absolute; width: 260px; height: 260px; border-radius: 50%;
          background: ${isDark
            ? 'radial-gradient(circle, hsla(215,80%,55%,0.1) 0%, hsla(215,80%,55%,0.03) 40%, transparent 70%)'
            : 'radial-gradient(circle, hsla(220,70%,60%,0.12) 0%, hsla(220,70%,60%,0.04) 40%, transparent 70%)'
          };
          animation: vsAmbientPulse 4s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes vsAmbientPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.06); opacity: 1; }
        }

        .vs-orb {
          position: relative; width: 140px; height: 140px; border-radius: 50%;
          background: ${isDark
            ? `radial-gradient(circle at 35% 25%, hsla(210,100%,90%,0.5) 0%, transparent 25%),
               radial-gradient(circle at 30% 30%, hsl(210,100%,72%) 0%, hsl(215,90%,55%) 20%, hsl(225,75%,38%) 45%, hsl(235,55%,22%) 70%, #080c16 100%)`
            : `radial-gradient(circle at 35% 25%, hsla(210,100%,95%,0.8) 0%, transparent 25%),
               radial-gradient(circle at 30% 30%, hsl(210,100%,82%) 0%, hsl(220,80%,68%) 20%, hsl(230,65%,55%) 45%, hsl(240,50%,42%) 70%, hsl(243,84%,14%) 100%)`
          };
          display: flex; align-items: center; justify-content: center;
          box-shadow: ${isDark
            ? '0 0 60px hsla(215,90%,60%,0.3), 0 0 120px hsla(215,80%,55%,0.1), inset 0 -20px 40px rgba(0,0,0,0.35), inset 0 4px 15px rgba(255,255,255,0.05)'
            : '0 0 50px hsla(220,70%,60%,0.25), 0 0 100px hsla(220,60%,55%,0.1), 0 8px 30px rgba(6,5,65,0.12), inset 0 -15px 30px rgba(0,0,0,0.15), inset 0 4px 15px rgba(255,255,255,0.2)'
          };
          transition: box-shadow 0.8s ease-out, transform 0.8s cubic-bezier(0.34,1.56,0.64,1);
        }
        .vs-glass {
          position: absolute; inset: 4px; border-radius: 50%;
          background:
            radial-gradient(ellipse 70% 45% at 30% 20%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.08) 40%, transparent 65%);
          pointer-events: none;
        }
        .vs-mirror-edge {
          position: absolute; inset: -3px; border-radius: 50%;
          background: conic-gradient(from 0deg,
            hsla(210,100%,80%,0.1), hsla(190,80%,70%,0.15), hsla(170,70%,65%,0.08),
            hsla(260,60%,70%,0.06), hsla(290,50%,70%,0.05), hsla(210,100%,80%,0.1));
          mask: radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px));
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px));
          pointer-events: none;
          animation: vsEdgeRotate 12s linear infinite;
        }
        .vs-mirror-edge-2 {
          position: absolute; inset: -6px; border-radius: 50%;
          background: conic-gradient(from 180deg,
            hsla(200,70%,70%,0.03), hsla(240,50%,65%,0.05), hsla(180,60%,60%,0.03),
            hsla(220,80%,75%,0.04), hsla(200,70%,70%,0.03));
          mask: radial-gradient(farthest-side, transparent calc(100% - 1.5px), black calc(100% - 1.5px));
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 1.5px), black calc(100% - 1.5px));
          pointer-events: none;
          animation: vsEdgeRotate 20s linear infinite reverse;
        }
        @keyframes vsEdgeRotate { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        .vs-ring {
          position: absolute; inset: -28px; border-radius: 50%;
          border: 1px solid ${isDark ? 'hsla(215,80%,65%,0.12)' : 'hsla(220,60%,55%,0.1)'};
          pointer-events: none; opacity: 0; display: none;
        }
        .vs-orb-wrap.listening .vs-ring,
        .vs-orb-wrap.speaking .vs-ring,
        .vs-orb-wrap.processing .vs-ring { opacity: 1; display: block; animation: vsRingPulse 3s ease-out infinite; }
        .vs-ring-2 { animation-delay: 1s !important; }
        .vs-ring-3 { animation-delay: 2s !important; }

        .vs-orb-wrap.listening .vs-orb {
          transform: scale(1.08);
          box-shadow: ${isDark
            ? '0 0 80px hsla(180,80%,55%,0.45), 0 0 160px hsla(200,70%,50%,0.2), inset 0 0 50px rgba(255,255,255,0.06)'
            : '0 0 60px hsla(180,70%,50%,0.3), 0 0 120px hsla(200,60%,50%,0.15), inset 0 0 40px rgba(255,255,255,0.1)'
          };
          animation: vsListenPulse 1s ease-in-out infinite;
        }
        .vs-orb-wrap.listening .vs-ring { border-color: hsla(180,80%,60%,0.35); animation: vsRingFast 1.2s ease-out infinite; }
        .vs-orb-wrap.speaking .vs-orb {
          animation: vsBreath 3.5s ease-in-out infinite;
          box-shadow: ${isDark
            ? '0 0 60px hsla(215,90%,60%,0.35), 0 0 130px hsla(200,70%,50%,0.12), inset 0 0 40px rgba(255,255,255,0.04)'
            : '0 0 50px hsla(220,70%,55%,0.25), 0 0 100px hsla(220,60%,50%,0.1), inset 0 0 30px rgba(255,255,255,0.08)'
          };
        }
        .vs-orb-wrap.speaking .vs-ring { border-color: ${isDark ? 'hsla(215,80%,65%,0.15)' : 'hsla(220,60%,55%,0.12)'}; animation: vsRingSlow 4s ease-out infinite; }
        .vs-orb-wrap.processing .vs-orb {
          animation: vsProcess 1.8s ease-in-out infinite;
          box-shadow: ${isDark
            ? '0 0 50px hsla(215,80%,55%,0.35), 0 0 100px hsla(200,70%,50%,0.12)'
            : '0 0 40px hsla(220,70%,55%,0.2), 0 0 80px hsla(220,60%,50%,0.08)'
          };
        }

        @keyframes vsListenPulse { 0%,100% { transform: scale(1.08); } 50% { transform: scale(1.13); } }
        @keyframes vsBreath { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }
        @keyframes vsProcess { 0%,100% { opacity: 0.85; } 50% { opacity: 1; filter: brightness(1.1); } }
        @keyframes vsRingPulse { 0% { transform: scale(1); opacity: 0.3; } 100% { transform: scale(2.2); opacity: 0; } }
        @keyframes vsRingFast { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(2.4); opacity: 0; } }
        @keyframes vsRingSlow { 0% { transform: scale(1); opacity: 0.2; } 100% { transform: scale(2.6); opacity: 0; } }

        @keyframes vsMicGlow {
          0%,100% { box-shadow: 0 0 18px hsla(215,90%,60%,0.2), 0 0 40px hsla(215,80%,55%,0.08); }
          50% { box-shadow: 0 0 30px hsla(215,90%,60%,0.4), 0 0 60px hsla(200,70%,55%,0.15); }
        }
        @keyframes vsMicRecord {
          0%,100% { box-shadow: 0 0 22px hsla(0,80%,55%,0.4), 0 0 50px hsla(0,80%,50%,0.15); transform: scale(1); }
          50% { box-shadow: 0 0 40px hsla(0,80%,55%,0.6), 0 0 80px hsla(0,80%,50%,0.22); transform: scale(1.04); }
        }

        .vs-card {
          background: ${isDark
            ? 'linear-gradient(170deg, hsla(220,35%,12%,0.8) 0%, hsla(225,30%,8%,0.85) 100%)'
            : 'linear-gradient(170deg, rgba(255,255,255,0.85) 0%, rgba(245,248,255,0.9) 100%)'
          };
          backdrop-filter: blur(40px) saturate(1.2);
          -webkit-backdrop-filter: blur(40px) saturate(1.2);
          border: 1px solid ${isDark ? 'hsla(220,50%,50%,0.06)' : 'hsla(220,50%,70%,0.2)'};
          box-shadow: ${isDark
            ? '0 0 50px hsla(220,70%,50%,0.03), 0 10px 35px rgba(0,0,0,0.3), inset 0 1px 0 hsla(220,60%,70%,0.03)'
            : '0 0 40px hsla(220,60%,60%,0.06), 0 8px 30px rgba(6,5,65,0.06), inset 0 1px 0 rgba(255,255,255,0.6)'
          };
        }

        .vs-reflection {
          position: absolute; top: 0; left: 10%; right: 10%; height: 1px;
          background: ${isDark
            ? 'linear-gradient(90deg, transparent, hsla(220,60%,70%,0.1), transparent)'
            : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)'
          };
          z-index: 1;
        }

        .vs-begin-btn {
          background: ${isDark
            ? 'linear-gradient(135deg, hsl(215,90%,55%) 0%, hsl(200,80%,50%) 100%)'
            : 'linear-gradient(135deg, hsl(243,84%,14%) 0%, hsl(220,70%,30%) 100%)'
          };
          color: white;
          border: none;
          padding: 14px 48px;
          border-radius: 16px;
          font-size: 15px;
          font-weight: 500;
          letter-spacing: 0.05em;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: ${isDark
            ? '0 0 30px hsla(215,90%,55%,0.25), 0 8px 25px rgba(0,0,0,0.3)'
            : '0 0 25px hsla(243,84%,14%,0.15), 0 8px 25px rgba(6,5,65,0.12)'
          };
        }
        .vs-begin-btn:hover {
          transform: translateY(-1px);
          box-shadow: ${isDark
            ? '0 0 40px hsla(215,90%,55%,0.35), 0 12px 30px rgba(0,0,0,0.35)'
            : '0 0 35px hsla(243,84%,14%,0.2), 0 12px 30px rgba(6,5,65,0.15)'
          };
        }
        .vs-begin-btn:active { transform: scale(0.97); }
      `}</style>

      {/* Aurora background */}
      <div className="vs-aurora" />

      {/* Floating light motes */}
      <div className="vs-motes">
        <div className="vs-mote" /><div className="vs-mote" /><div className="vs-mote" />
        <div className="vs-mote" /><div className="vs-mote" /><div className="vs-mote" />
      </div>

      {/* Mirror reflection line */}
      <div className="vs-reflection" />

      {/* ── Progress bar ── */}
      {currentStep?.id !== 'greeting' && currentStep?.id !== 'welcome' && (
        <div className="w-full max-w-[260px] mb-4 z-10">
          <div className={`h-[2px] rounded-full overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-[#060541]/[0.06]'}`}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: isDark
                ? 'linear-gradient(90deg, hsl(215,90%,60%), hsl(195,80%,55%), hsl(170,70%,50%))'
                : 'linear-gradient(90deg, hsl(243,84%,14%), hsl(220,70%,40%), hsl(200,60%,45%))'
              }}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <p className={`text-[8px] mt-1.5 text-center tracking-[0.25em] uppercase font-extralight ${isDark ? 'text-white/25' : 'text-[#060541]/30'}`}>
            {t(`Step ${Math.max(1, currentVoiceStep + 1)} of ${totalVoiceSteps}`, `خطوة ${Math.max(1, currentVoiceStep + 1)} من ${totalVoiceSteps}`)}
          </p>
        </div>
      )}

      {/* ── Mirror Orb ── */}
      <div className={`vs-orb-wrap ${orbStatusClass}`}>
        <div className="vs-ring" />
        <div className="vs-ring vs-ring-2" />
        <div className="vs-ring vs-ring-3" />
        <div className="vs-orb">
          <div className="vs-mirror-edge-2" />
          <div className="vs-mirror-edge" />
          <div className="vs-glass" />
          <div className="relative z-10 pointer-events-none">
            <Logo3D size="md" />
          </div>
        </div>
      </div>

      {/* ── Status text ── */}
      <motion.div
        className={`text-[10px] tracking-[0.2em] uppercase font-extralight mt-3 mb-3 z-10 ${
          connectionStatus === 'listening' ? 'text-[hsl(180,70%,45%)]' :
          connectionStatus === 'speaking' ? (isDark ? 'text-white/45' : 'text-[#060541]/40') :
          connectionStatus === 'processing' ? 'text-[hsl(215,80%,55%)]' :
          (isDark ? 'text-white/20' : 'text-[#060541]/25')
        }`}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        {connectionStatus === 'connecting' && (
          <span className="flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            {t('Connecting...', 'جارٍ الاتصال...')}
          </span>
        )}
        {connectionStatus === 'listening' && t('Listening...', 'أسمعك...')}
        {connectionStatus === 'speaking' && t('Wakti is speaking...', 'وقتي يتحدث...')}
        {connectionStatus === 'processing' && t('Processing...', 'جارٍ المعالجة...')}
        {connectionStatus === 'ready' && currentStep?.id === 'greeting' && !greetingSpokeRef.current && t('Preparing...', 'جارٍ التحضير...')}
        {connectionStatus === 'ready' && currentStep?.id !== 'greeting' && phase === 'asking' && cardVisible && currentStep?.voice && t('Tap the mic to speak', 'اضغط على المايك للتحدث')}
      </motion.div>

      {/* ── AI transcript ── */}
      <AnimatePresence mode="wait">
        {aiTranscript && (
          <motion.div
            key="ai-transcript"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`text-center text-[14px] max-w-[320px] leading-[1.7] z-10 px-4 font-light ${isDark ? 'text-white/65' : 'text-[#060541]/60'}`}
            style={{ letterSpacing: '0.01em' }}
          >
            "{aiTranscript}"
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── "Let's Begin" button — only shows after greeting finishes ── */}
      <AnimatePresence>
        {currentStep?.id === 'greeting' && greetingFinished && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="z-10 mt-4"
          >
            <button className="vs-begin-btn" onClick={handleBegin}>
              {t("Let's Begin", 'هيا نبدأ')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ QUESTION CARD — only appears after AI finishes speaking ═══ */}
      <AnimatePresence mode="wait">
        {showInputCard && (
          <motion.div
            key={currentStep.id}
            initial={{ opacity: 0, y: 40, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.92, filter: 'blur(4px)' }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="vs-card w-full max-w-sm rounded-2xl p-6 z-10"
          >
            {/* Question label */}
            <div className={`text-[15px] font-medium mb-4 text-center ${textColor}`}>
              {language === 'ar' ? currentStep.questionAr : currentStep.questionEn}
              {!currentStep.required && (
                <span className={`text-[11px] font-light ml-2 ${textMuted}`}>
                  {t('(optional)', '(اختياري)')}
                </span>
              )}
            </div>

            {/* ── Voice: Tap mic to record ── */}
            {currentStep.voice && phase === 'asking' && (
              <div className="flex flex-col items-center gap-3">
                <button
                  onMouseDown={handleHoldStart}
                  onMouseUp={handleHoldEnd}
                  onMouseLeave={handleHoldEnd}
                  onTouchStart={handleHoldStart}
                  onTouchEnd={handleHoldEnd}
                  onContextMenu={(e) => e.preventDefault()}
                  disabled={connectionStatus !== 'ready'}
                  aria-label={t('Tap to speak', 'اضغط للتحدث')}
                  className={`w-[72px] h-[72px] rounded-full flex items-center justify-center transition-all duration-300 ${
                    isHolding
                      ? 'bg-red-500/20 border-2 border-red-400/60'
                      : 'bg-[hsl(210,100%,65%)]/10 border border-[hsl(210,100%,65%)]/20'
                  } ${connectionStatus !== 'ready' ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer active:scale-90'}`}
                  style={{
                    animation: isHolding
                      ? 'vsMicRecord 1s ease-in-out infinite'
                      : connectionStatus === 'ready'
                        ? 'vsMicGlow 3s ease-in-out infinite'
                        : 'none'
                  }}
                >
                  <Mic className={`w-7 h-7 transition-colors ${
                    isHolding ? 'text-red-400' : 'text-[hsl(210,100%,75%)]'
                  }`} />
                </button>
                <span className={`text-[11px] tracking-wide ${isHolding ? 'text-red-400' : textMuted}`}>
                  {isHolding
                    ? `${countdown}s — ${t('Release to stop', 'ارفع للتوقف')}`
                    : connectionStatus === 'processing'
                    ? t('Processing...', 'جارٍ المعالجة...')
                    : t('Tap & hold to speak', 'اضغط مع الاستمرار للتحدث')
                  }
                </span>

                {/* ── Or type it ── */}
                <div className={`w-full flex items-center gap-2 mt-2 pt-3 border-t ${isDark ? 'border-white/[0.06]' : 'border-[#060541]/[0.06]'}`}>
                  <span className={`text-[10px] uppercase tracking-widest shrink-0 ${textMuted}`}>{t('or', 'أو')}</span>
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder={t('Type it here...', 'اكتبها هنا...')}
                    className={`flex-1 text-[13px] py-2 h-9 rounded-lg ${isDark ? 'bg-white/5 border-white/10 text-[#f2f2f2] placeholder:text-white/25' : 'bg-[#060541]/[0.03] border-[#060541]/10 text-[#060541] placeholder:text-[#060541]/30'}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && editValue.trim()) {
                        setCapturedValue(editValue.trim());
                        setPhase('confirming');
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    disabled={!editValue.trim()}
                    onClick={() => {
                      if (editValue.trim()) {
                        setCapturedValue(editValue.trim());
                        setPhase('confirming');
                      }
                    }}
                    className={`h-9 px-3 rounded-lg text-[12px] ${isDark ? 'bg-[hsl(210,100%,65%)] hover:bg-[hsl(210,100%,55%)]' : 'bg-[#060541] hover:bg-[#060541]/90 text-white'}`}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {!currentStep.required && (
                  <button onClick={handleSkip} className={`text-[11px] tracking-wide ${textMuted} hover:underline`}>
                    {t('Skip this step →', 'تخطي هذه الخطوة →')}
                  </button>
                )}
              </div>
            )}

            {/* ── Confirming captured value ── */}
            {currentStep.voice && phase === 'confirming' && (
              <div className="space-y-3">
                <div className={`text-center text-lg font-medium py-3 px-4 rounded-xl ${isDark ? 'bg-white/[0.06] border border-white/[0.06]' : 'bg-[#060541]/[0.04] border border-[#060541]/[0.06]'} ${textColor}`}>
                  {capturedValue}
                </div>
                {fieldError && <p className="text-[13px] text-red-500 text-center">{fieldError}</p>}
                <div className="flex gap-2 justify-center">
                  <Button size="sm" onClick={handleConfirm} className="bg-[hsl(142,76%,36%)] hover:bg-[hsl(142,76%,30%)] text-white gap-1.5 rounded-xl px-5">
                    <Check className="w-4 h-4" /> {t('Confirm', 'تأكيد')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleEdit} className={`gap-1.5 rounded-xl ${isDark ? 'border-white/15 hover:bg-white/5 text-[#f2f2f2]' : 'border-[#060541]/15 hover:bg-[#060541]/5 text-[#060541]'}`}>
                    <Pencil className="w-3.5 h-3.5" /> {t('Edit', 'تعديل')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleRetry} className={`gap-1.5 rounded-xl ${isDark ? 'text-[#858384] hover:text-[#f2f2f2]' : 'text-[#060541]/50 hover:text-[#060541]'}`}>
                    <RotateCcw className="w-3.5 h-3.5" /> {t('Retry', 'إعادة')}
                  </Button>
                </div>
              </div>
            )}

            {/* ── Editing captured value ── */}
            {currentStep.voice && phase === 'editing' && (
              <div className="space-y-3">
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className={`text-center text-base py-5 rounded-xl ${isDark ? 'bg-white/5 border-white/10 text-[#f2f2f2]' : 'bg-[#060541]/[0.03] border-[#060541]/10 text-[#060541]'}`}
                  autoFocus
                />
                {fieldError && <p className="text-[13px] text-red-500 text-center">{fieldError}</p>}
                <div className="flex gap-2 justify-center">
                  <Button size="sm" onClick={handleConfirm} className="bg-[hsl(142,76%,36%)] hover:bg-[hsl(142,76%,30%)] text-white gap-1.5 rounded-xl px-5">
                    <Check className="w-4 h-4" /> {t('Save', 'حفظ')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleRetry} className={`gap-1.5 rounded-xl ${isDark ? 'text-[#858384] hover:text-[#f2f2f2]' : 'text-[#060541]/50 hover:text-[#060541]'}`}>
                    <Mic className="w-4 h-4" /> {t('Voice again', 'صوت مرة أخرى')}
                  </Button>
                </div>
              </div>
            )}

            {/* ── Password step ── */}
            {currentStep.id === 'password' && (
              <div className="space-y-3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder={t('Create a password', 'إنشاء كلمة مرور')}
                    className={`pl-10 pr-10 py-5 text-base rounded-xl ${isDark ? 'bg-white/5 border-white/10 text-[#f2f2f2] placeholder:text-[#858384]/60' : 'bg-[#060541]/[0.03] border-[#060541]/10 text-[#060541] placeholder:text-[#060541]/40'}`}
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3" aria-label="Toggle password visibility">
                    {showPassword ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                  </button>
                </div>
                <p className={`text-[11px] ${textMuted}`}>{t('At least 6 characters', 'على الأقل 6 أحرف')}</p>
                {fieldError && <p className="text-[13px] text-red-500">{fieldError}</p>}
                <Button onClick={handlePasswordSubmit} className={`w-full rounded-xl ${isDark ? 'bg-[hsl(210,100%,65%)] hover:bg-[hsl(210,100%,55%)]' : 'bg-[#060541] hover:bg-[#060541]/90 text-white'}`} disabled={!formData.password}>
                  {t('Next', 'التالي')}
                </Button>
              </div>
            )}

            {/* ── Confirm password step ── */}
            {currentStep.id === 'confirm_password' && (
              <div className="space-y-3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder={t('Confirm your password', 'تأكيد كلمة المرور')}
                    className={`pl-10 pr-10 py-5 text-base rounded-xl ${isDark ? 'bg-white/5 border-white/10 text-[#f2f2f2] placeholder:text-[#858384]/60' : 'bg-[#060541]/[0.03] border-[#060541]/10 text-[#060541] placeholder:text-[#060541]/40'}`}
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3" aria-label="Toggle confirm password visibility">
                    {showConfirmPassword ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                  </button>
                </div>
                {fieldError && <p className="text-[13px] text-red-500">{fieldError}</p>}
                <Button onClick={handlePasswordSubmit} className={`w-full rounded-xl ${isDark ? 'bg-[hsl(210,100%,65%)] hover:bg-[hsl(210,100%,55%)]' : 'bg-[#060541] hover:bg-[#060541]/90 text-white'}`} disabled={!formData.confirmPassword}>
                  {t('Next', 'التالي')}
                </Button>
              </div>
            )}

            {/* ── Terms step ── */}
            {currentStep.id === 'terms' && (
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="voice-terms"
                    checked={formData.agreedToTerms}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, agreedToTerms: checked as boolean }))}
                    className="mt-1"
                  />
                  <label htmlFor="voice-terms" className={`text-[13px] leading-relaxed cursor-pointer ${textColor}`}>
                    {t('I agree to the Privacy Policy and Terms of Service', 'أوافق على سياسة الخصوصية وشروط الخدمة')}
                  </label>
                </div>
                <Button onClick={handleTermsAgree} className={`w-full rounded-xl ${isDark ? 'bg-[hsl(210,100%,65%)] hover:bg-[hsl(210,100%,55%)]' : 'bg-[#060541] hover:bg-[#060541]/90 text-white'}`} disabled={!formData.agreedToTerms}>
                  {t('Create Account', 'إنشاء حساب')}
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Creating state ─── */}
      {currentStep?.id === 'creating' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-5 z-10"
        >
          <Loader2 className={`w-7 h-7 animate-spin ${isDark ? 'text-white/40' : 'text-[#060541]/40'}`} />
          <span className={`text-[13px] font-extralight tracking-[0.15em] uppercase ${isDark ? 'text-white/50' : 'text-[#060541]/50'}`}>{t('Creating your account...', 'جارٍ إنشاء حسابك...')}</span>
        </motion.div>
      )}

      {/* ─── Welcome state ─── */}
      {currentStep?.id === 'welcome' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center gap-4 text-center z-10"
        >
          <div className="text-3xl">✨</div>
          <h2 className={`text-lg font-light tracking-[0.08em] ${isDark ? 'text-white/90' : 'text-[#060541]'}`}>{t('Welcome to Wakti!', 'مرحبًا بك في وقتي!')}</h2>
          <p className={`text-[12px] font-extralight leading-relaxed max-w-[280px] ${isDark ? 'text-white/40' : 'text-[#060541]/50'}`}>
            {t("You have free access for 24 hours. Don't forget to subscribe!", 'لديك وصول مجاني لمدة 24 ساعة. لا تنسَ الاشتراك!')}
          </p>
        </motion.div>
      )}

      {/* ─── Filled fields summary ─── */}
      {stepIndex > 1 && currentStep?.id !== 'welcome' && currentStep?.id !== 'creating' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`w-full max-w-sm mt-4 rounded-xl p-3 text-[10px] space-y-0.5 z-10 ${isDark ? 'text-white/30' : 'text-[#060541]/35'}`}
          style={{
            background: isDark
              ? 'linear-gradient(170deg, hsla(220,30%,12%,0.5) 0%, hsla(225,25%,8%,0.5) 100%)'
              : 'linear-gradient(170deg, rgba(255,255,255,0.5) 0%, rgba(245,248,255,0.5) 100%)',
            border: isDark ? '1px solid hsla(220,50%,50%,0.04)' : '1px solid hsla(220,50%,70%,0.12)'
          }}
        >
          {formData.name && <div><span className={`font-medium ${isDark ? 'text-white/40' : 'text-[#060541]/45'}`}>{t('Name:', 'الاسم:')}</span> {formData.name}</div>}
          {formData.username && <div><span className={`font-medium ${isDark ? 'text-white/40' : 'text-[#060541]/45'}`}>{t('Username:', 'المستخدم:')}</span> {formData.username}</div>}
          {formData.email && <div><span className={`font-medium ${isDark ? 'text-white/40' : 'text-[#060541]/45'}`}>{t('Email:', 'البريد:')}</span> {formData.email}</div>}
          {formData.password && <div><span className={`font-medium ${isDark ? 'text-white/40' : 'text-[#060541]/45'}`}>{t('Password:', 'كلمة المرور:')}</span> ••••••</div>}
          {formData.dob && <div><span className={`font-medium ${isDark ? 'text-white/40' : 'text-[#060541]/45'}`}>{t('DOB:', 'الميلاد:')}</span> {formData.dob}</div>}
          {formData.country && <div><span className={`font-medium ${isDark ? 'text-white/40' : 'text-[#060541]/45'}`}>{t('Country:', 'البلد:')}</span> {formData.country}</div>}
          {formData.city && <div><span className={`font-medium ${isDark ? 'text-white/40' : 'text-[#060541]/45'}`}>{t('City:', 'المدينة:')}</span> {formData.city}</div>}
        </motion.div>
      )}
    </div>
  );
}
