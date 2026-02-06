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

// ─── Email cleanup helper ────────────────────────────────────────────────────

function cleanEmail(raw: string): string {
  let e = raw.trim().toLowerCase();
  // Common speech-to-text patterns
  e = e.replace(/\s+at\s+/gi, '@');
  e = e.replace(/\s+آت\s+/gi, '@');
  e = e.replace(/\s+dot\s+/gi, '.');
  e = e.replace(/\s+دوت\s+/gi, '.');
  e = e.replace(/\s+نقطة\s+/gi, '.');
  e = e.replace(/\s+point\s+/gi, '.');
  // Remove all remaining spaces
  e = e.replace(/\s+/g, '');
  return e;
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
  const stepIndexRef = useRef(stepIndex);
  stepIndexRef.current = stepIndex;
  const greetingDoneRef = useRef(false);
  const questionSpokenForStepRef = useRef(-1);

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
        console.log('[VoiceSignup] Data channel open');
        const instructions = t(
          `You are WAKTI, a friendly AI assistant helping a new user create their account. You will ask signup questions one at a time. Keep responses SHORT (1-2 sentences max). Be warm and welcoming. Speak naturally like a friend helping someone sign up. When the user answers, just acknowledge briefly and move on. Do NOT ask follow-up questions - just confirm what you heard.`,
          `أنت مساعد WAKTI الودود، تساعد مستخدمًا جديدًا في إنشاء حسابه. ستسأل أسئلة التسجيل واحدًا تلو الآخر. اجعل ردودك قصيرة (جملة أو جملتين كحد أقصى). كن دافئًا ومرحبًا. تحدث بشكل طبيعي كصديق يساعد شخصًا في التسجيل. عندما يجيب المستخدم، أكد بإيجاز فقط وانتقل للسؤال التالي. لا تسأل أسئلة متابعة.`
        );

        const openaiVoice = 'shimmer';
        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            instructions,
            voice: openaiVoice,
            input_audio_transcription: { model: 'whisper-1' },
            turn_detection: null,
          }
        }));

        isConnectionReadyRef.current = true;
        setConnectionStatus('ready');
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
    }
  }, [language, t]);

  // ─── Handle realtime events ────────────────────────────────────────────────
  const handleRealtimeEvent = useCallback((msg: any) => {
    switch (msg.type) {
      case 'conversation.item.input_audio_transcription.completed': {
        const transcript = msg.transcript?.trim() || '';
        if (transcript.length > 0) {
          setConnectionStatus('ready');
          // Process the transcript based on current step
          processVoiceAnswer(transcript);
        } else {
          setConnectionStatus('ready');
        }
        break;
      }
      case 'response.audio_transcript.delta':
        setConnectionStatus('speaking');
        if (msg.delta) setAiTranscript(prev => prev + msg.delta);
        break;
      case 'response.audio_transcript.done':
        if (msg.transcript) setAiTranscript(msg.transcript);
        break;
      case 'response.done':
        setConnectionStatus('ready');
        break;
      case 'error':
        if (!msg.error?.message?.includes('buffer too small')) {
          console.error('[VoiceSignup] Realtime error:', msg.error);
          setConnectionStatus('ready');
        }
        break;
      default:
        break;
    }
  }, []);

  // ─── Process voice answer for current step ─────────────────────────────────
  const processVoiceAnswer = useCallback((transcript: string) => {
    const step = STEPS[stepIndexRef.current];
    if (!step) return;

    let cleaned = transcript;
    if (step.id === 'email') {
      cleaned = cleanEmail(transcript);
    }

    setCapturedValue(cleaned);
    setEditValue(cleaned);
    setPhase('confirming');
  }, []);

  // ─── Make AI speak a question ──────────────────────────────────────────────
  const speakQuestion = useCallback((text: string) => {
    if (!dcRef.current || dcRef.current.readyState !== 'open') {
      console.warn('[VoiceSignup] Cannot speak - data channel not open');
      return;
    }
    setAiTranscript('');
    setConnectionStatus('speaking');

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

  // ─── When connection becomes ready and we're at greeting, speak welcome ────
  useEffect(() => {
    if (connectionStatus === 'ready' && currentStep?.id === 'greeting' && !greetingDoneRef.current) {
      greetingDoneRef.current = true;
      const greeting = t(
        "Hi there! I'm Wakti. Let's set up your account together. I'll ask you a few questions.",
        'مرحبًا! أنا وقتي. دعنا ننشئ حسابك معًا. سأسألك بعض الأسئلة.'
      );
      speakQuestion(greeting);
      // Auto-advance after greeting speech finishes
      const timer = setTimeout(() => {
        setStepIndex(1);
        setPhase('asking');
        setAiTranscript('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [connectionStatus, currentStep?.id, speakQuestion, t]);

  // ─── When step changes, speak the question (only once per step) ────────────
  useEffect(() => {
    if (!currentStep || currentStep.id === 'greeting' || currentStep.id === 'creating' || currentStep.id === 'welcome') return;
    if (phase !== 'asking') return;
    if (questionSpokenForStepRef.current === stepIndex) return;
    if (connectionStatus !== 'ready') return;

    questionSpokenForStepRef.current = stepIndex;
    const question = language === 'ar' ? currentStep.questionAr : currentStep.questionEn;
    if (question) {
      const timer = setTimeout(() => {
        speakQuestion(question);
      }, 600);
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
      console.log('[VoiceSignup] Committing audio buffer');
      dcRef.current.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
      // Trigger response to get transcription back
      dcRef.current.send(JSON.stringify({ type: 'response.create' }));
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

    // Advance to next step
    setStepIndex(prev => prev + 1);
    setPhase('asking');
    setCapturedValue('');
    setEditValue('');
    setAiTranscript('');
  }, [currentStep, editValue, t]);

  // ─── Skip optional step ────────────────────────────────────────────────────
  const handleSkip = useCallback(() => {
    setStepIndex(prev => prev + 1);
    setPhase('asking');
    setCapturedValue('');
    setEditValue('');
    setAiTranscript('');
    setFieldError(null);
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
      setStepIndex(prev => prev + 1);
      setPhase('asking');
    } else if (currentStep?.id === 'confirm_password') {
      const err = validateConfirmPassword(formData.password, formData.confirmPassword);
      if (err) { setFieldError(err); return; }
      setStepIndex(prev => prev + 1);
      setPhase('asking');
    }
  }, [currentStep, formData.password, formData.confirmPassword]);

  // ─── Terms agree ───────────────────────────────────────────────────────────
  const handleTermsAgree = useCallback(() => {
    if (!formData.agreedToTerms) return;
    setStepIndex(prev => prev + 1);
    setPhase('asking');
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
  const cardBg = isDark
    ? 'bg-[#0c0f14]/90 border-[hsl(210,100%,65%)]/15 shadow-[0_0_30px_hsla(210,100%,65%,0.06)]'
    : 'bg-white/90 border-[#060541]/10 shadow-[0_4px_24px_rgba(6,5,65,0.06)]';

  const orbStatusClass = connectionStatus === 'listening' ? 'listening'
    : connectionStatus === 'speaking' ? 'speaking'
    : connectionStatus === 'processing' ? 'processing'
    : '';

  // Progress bar
  const totalVoiceSteps = STEPS.filter(s => s.id !== 'greeting' && s.id !== 'creating' && s.id !== 'welcome').length;
  const currentVoiceStep = Math.min(stepIndex - 1, totalVoiceSteps);
  const progressPercent = Math.max(0, Math.min(100, (currentVoiceStep / totalVoiceSteps) * 100));

  return (
    <div
      className="flex flex-col items-center gap-4 py-6 px-4 max-w-md mx-auto select-none"
      onPointerDown={() => { unlockAudio(); }}
    >
      {/* Hidden audio element */}
      <audio ref={audioRef} autoPlay playsInline className="hidden" />

      {/* WAKTI-branded orb CSS */}
      <style>{`
        .vs-orb-wrap {
          position: relative; width: 200px; height: 200px;
          display: flex; align-items: center; justify-content: center;
        }
        .vs-orb {
          position: relative; width: 150px; height: 150px; border-radius: 50%;
          background: ${isDark
            ? 'linear-gradient(145deg, hsl(210,100%,65%) 0%, hsl(180,85%,60%) 40%, hsl(210,100%,55%) 70%, hsl(142,76%,55%) 100%)'
            : 'linear-gradient(145deg, #060541 0%, hsl(210,100%,45%) 40%, hsl(260,70%,25%) 70%, #060541 100%)'
          };
          background-size: 300% 300%;
          animation: vsGrad 10s ease infinite;
          display: flex; align-items: center; justify-content: center;
          box-shadow: ${isDark
            ? '0 0 40px hsla(210,100%,65%,0.5), 0 0 80px hsla(180,85%,60%,0.3), inset 0 0 30px rgba(255,255,255,0.08)'
            : '0 8px 40px rgba(6,5,65,0.25), inset 0 0 30px rgba(255,255,255,0.15)'
          };
          transition: box-shadow 0.4s ease-out, transform 0.4s cubic-bezier(0.34,1.56,0.64,1);
        }
        .vs-glass {
          position: absolute; inset: 6px; border-radius: 50%;
          background: radial-gradient(ellipse 70% 45% at 35% 25%, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.05) 50%, transparent 70%);
          pointer-events: none;
        }
        .vs-ring {
          position: absolute; inset: -25px; border-radius: 50%;
          border: 1.5px solid ${isDark ? 'hsla(210,100%,65%,0.3)' : 'hsla(243,84%,14%,0.15)'};
          pointer-events: none; opacity: 0; display: none;
        }
        .vs-orb-wrap.listening .vs-ring,
        .vs-orb-wrap.speaking .vs-ring,
        .vs-orb-wrap.processing .vs-ring { opacity: 1; display: block; animation: vsRingPulse 2s ease-out infinite; }
        .vs-ring-2 { animation-delay: 0.6s !important; }
        .vs-ring-3 { animation-delay: 1.2s !important; }

        .vs-orb-wrap.listening .vs-orb {
          transform: scale(1.1);
          animation: vsGrad 2s ease infinite, vsListenPulse 0.6s ease-in-out infinite;
          box-shadow: ${isDark
            ? '0 0 60px hsla(210,100%,65%,0.7), 0 0 120px hsla(180,85%,60%,0.5), 0 0 180px hsla(142,76%,55%,0.3), inset 0 0 50px rgba(255,255,255,0.12)'
            : '0 0 50px rgba(6,5,65,0.35), 0 0 100px hsla(210,100%,75%,0.3), inset 0 0 40px rgba(255,255,255,0.2)'
          };
        }
        .vs-orb-wrap.listening .vs-ring {
          border-color: ${isDark ? 'hsla(180,85%,60%,0.5)' : 'hsla(210,100%,75%,0.4)'};
          animation: vsRingFast 0.9s ease-out infinite;
        }
        .vs-orb-wrap.speaking .vs-orb {
          animation: vsGrad 5s ease infinite, vsBreath 2s ease-in-out infinite;
          box-shadow: ${isDark
            ? '0 0 50px hsla(210,100%,65%,0.5), 0 0 100px hsla(142,76%,55%,0.3), inset 0 0 40px rgba(255,255,255,0.1)'
            : '0 0 40px rgba(6,5,65,0.3), 0 0 80px hsla(210,100%,75%,0.25), inset 0 0 30px rgba(255,255,255,0.15)'
          };
        }
        .vs-orb-wrap.speaking .vs-ring {
          border-color: ${isDark ? 'hsla(142,76%,55%,0.3)' : 'hsla(243,84%,14%,0.15)'};
          animation: vsRingSlow 3s ease-out infinite;
        }
        .vs-orb-wrap.processing .vs-orb {
          animation: vsGrad 3s ease infinite, vsProcess 1.2s ease-in-out infinite;
          box-shadow: ${isDark
            ? '0 0 40px hsla(210,100%,65%,0.5), 0 0 80px hsla(180,85%,60%,0.3)'
            : '0 0 30px rgba(6,5,65,0.25), 0 0 60px hsla(210,100%,75%,0.2)'
          };
        }

        @keyframes vsGrad { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes vsListenPulse { 0%,100% { transform: scale(1.1); } 50% { transform: scale(1.16); } }
        @keyframes vsBreath { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes vsProcess { 0%,100% { opacity: 0.85; filter: brightness(1); } 50% { opacity: 1; filter: brightness(1.15); } }
        @keyframes vsRingPulse { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(1.7); opacity: 0; } }
        @keyframes vsRingFast { 0% { transform: scale(1); opacity: 0.7; } 100% { transform: scale(1.9); opacity: 0; } }
        @keyframes vsRingSlow { 0% { transform: scale(1); opacity: 0.4; } 100% { transform: scale(2); opacity: 0; } }
      `}</style>

      {/* Progress bar — WAKTI branded */}
      {currentStep?.id !== 'greeting' && currentStep?.id !== 'welcome' && (
        <div className="w-full max-w-xs">
          <div className={`h-1 rounded-full overflow-hidden ${isDark ? 'bg-white/8' : 'bg-[#060541]/8'}`}>
            <motion.div
              className={`h-full rounded-full ${isDark
                ? 'bg-gradient-to-r from-[hsl(210,100%,65%)] via-[hsl(180,85%,60%)] to-[hsl(142,76%,55%)]'
                : 'bg-gradient-to-r from-[#060541] via-[hsl(210,100%,45%)] to-[hsl(260,70%,25%)]'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          <p className={`text-[10px] mt-1.5 text-center tracking-widest uppercase ${textMuted}`}>
            {t(`Step ${Math.max(1, currentVoiceStep + 1)} of ${totalVoiceSteps}`, `خطوة ${Math.max(1, currentVoiceStep + 1)} من ${totalVoiceSteps}`)}
          </p>
        </div>
      )}

      {/* Logo + Orb */}
      <div className={`vs-orb-wrap ${orbStatusClass}`}>
        <div className="vs-ring" />
        <div className="vs-ring vs-ring-2" />
        <div className="vs-ring vs-ring-3" />
        <div className="vs-orb">
          <div className="vs-glass" />
          <div className="relative z-10 pointer-events-none">
            <Logo3D size="md" />
          </div>
        </div>
      </div>

      {/* Status indicator */}
      <div className={`text-xs tracking-wider uppercase font-medium ${
        connectionStatus === 'listening' ? (isDark ? 'text-[hsl(180,85%,60%)]' : 'text-[hsl(210,100%,45%)]') :
        connectionStatus === 'speaking' ? (isDark ? 'text-[hsl(142,76%,55%)]' : 'text-[#060541]') :
        connectionStatus === 'processing' ? (isDark ? 'text-[hsl(210,100%,65%)]' : 'text-[hsl(260,70%,25%)]') :
        textMuted
      }`}>
        {connectionStatus === 'connecting' && (
          <span className="flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {t('Connecting...', 'جارٍ الاتصال...')}
          </span>
        )}
        {connectionStatus === 'listening' && t('Listening...', 'أسمعك...')}
        {connectionStatus === 'speaking' && t('Wakti is speaking...', 'وقتي يتحدث...')}
        {connectionStatus === 'processing' && t('Thinking...', 'جارٍ التفكير...')}
        {connectionStatus === 'ready' && currentStep?.id === 'greeting' && t('Getting ready...', 'جارٍ التحضير...')}
      </div>

      {/* AI transcript (what AI is saying) */}
      <AnimatePresence mode="wait">
        {aiTranscript && (
          <motion.div
            key="ai-transcript"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`text-center text-sm max-w-xs leading-relaxed italic ${isDark ? 'text-[hsl(210,100%,80%)]' : 'text-[#060541]/70'}`}
          >
            "{aiTranscript}"
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Question Card ─────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {currentStep && currentStep.id !== 'greeting' && currentStep.id !== 'creating' && currentStep.id !== 'welcome' && (
          <motion.div
            key={currentStep.id}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className={`w-full max-w-sm rounded-2xl border p-5 backdrop-blur-sm ${cardBg}`}
          >
            {/* Question label */}
            <div className={`text-base font-semibold mb-3 ${textColor}`}>
              {language === 'ar' ? currentStep.questionAr : currentStep.questionEn}
              {!currentStep.required && (
                <span className={`text-xs font-normal ml-2 ${textMuted}`}>
                  {t('(optional)', '(اختياري)')}
                </span>
              )}
            </div>

            {/* ── Voice steps: hold-to-talk + confirm ── */}
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
                  aria-label="Hold to speak"
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                    isDark
                      ? 'bg-[hsl(210,100%,65%)]/15 hover:bg-[hsl(210,100%,65%)]/25 shadow-[0_0_20px_hsla(210,100%,65%,0.15)]'
                      : 'bg-[#060541]/8 hover:bg-[#060541]/15'
                  } ${connectionStatus !== 'ready' ? 'opacity-40' : ''}`}
                >
                  <Mic className={`w-7 h-7 ${textColor}`} />
                </button>
                <span className={`text-xs ${textMuted}`}>
                  {isHolding
                    ? `${countdown}s`
                    : connectionStatus === 'processing'
                    ? t('Processing...', 'جارٍ المعالجة...')
                    : t('Hold to speak', 'اضغط مع الاستمرار للتحدث')
                  }
                </span>
                {!currentStep.required && (
                  <Button variant="ghost" size="sm" onClick={handleSkip} className={`text-xs ${textMuted}`}>
                    <SkipForward className="w-3 h-3 mr-1" />
                    {t('Skip', 'تخطي')}
                  </Button>
                )}
              </div>
            )}

            {/* ── Confirming captured value ── */}
            {currentStep.voice && phase === 'confirming' && (
              <div className="space-y-3">
                <div className={`text-center text-lg font-medium py-3 px-4 rounded-xl ${isDark ? 'bg-white/10' : 'bg-[#060541]/5'} ${textColor}`}>
                  {capturedValue}
                </div>
                {fieldError && <p className="text-sm text-red-500 text-center">{fieldError}</p>}
                <div className="flex gap-2 justify-center">
                  <Button size="sm" onClick={handleConfirm} className="bg-[hsl(142,76%,36%)] hover:bg-[hsl(142,76%,30%)] text-white gap-1">
                    <Check className="w-4 h-4" /> {t('Confirm', 'تأكيد')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleEdit} className={`gap-1 ${isDark ? 'border-white/20' : 'border-[#060541]/20'}`}>
                    <Pencil className="w-4 h-4" /> {t('Edit', 'تعديل')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleRetry} className={`gap-1 ${textMuted}`}>
                    <RotateCcw className="w-4 h-4" /> {t('Retry', 'إعادة')}
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
                  className="text-center text-base py-5"
                  autoFocus
                />
                {fieldError && <p className="text-sm text-red-500 text-center">{fieldError}</p>}
                <div className="flex gap-2 justify-center">
                  <Button size="sm" onClick={handleConfirm} className="bg-[hsl(142,76%,36%)] hover:bg-[hsl(142,76%,30%)] text-white gap-1">
                    <Check className="w-4 h-4" /> {t('Save', 'حفظ')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleRetry} className="gap-1">
                    <Mic className="w-4 h-4" /> {t('Voice again', 'صوت مرة أخرى')}
                  </Button>
                </div>
              </div>
            )}

            {/* ── Password step (typed) ── */}
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
                    className="pl-10 pr-10 py-5 text-base"
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3" aria-label="Toggle password visibility">
                    {showPassword ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                  </button>
                </div>
                <p className={`text-xs ${textMuted}`}>{t('At least 6 characters', 'على الأقل 6 أحرف')}</p>
                {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
                <Button onClick={handlePasswordSubmit} className="w-full" disabled={!formData.password}>
                  {t('Next', 'التالي')}
                </Button>
              </div>
            )}

            {/* ── Confirm password step (typed) ── */}
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
                    className="pl-10 pr-10 py-5 text-base"
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3" aria-label="Toggle confirm password visibility">
                    {showConfirmPassword ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                  </button>
                </div>
                {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
                <Button onClick={handlePasswordSubmit} className="w-full" disabled={!formData.confirmPassword}>
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
                  <label htmlFor="voice-terms" className={`text-sm leading-relaxed cursor-pointer ${textColor}`}>
                    {t('I agree to the Privacy Policy and Terms of Service', 'أوافق على سياسة الخصوصية وشروط الخدمة')}
                  </label>
                </div>
                <Button onClick={handleTermsAgree} className="w-full" disabled={!formData.agreedToTerms}>
                  {t('Create Account', 'إنشاء حساب')}
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Creating state ─────────────────────────────────────────────────── */}
      {currentStep?.id === 'creating' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`flex flex-col items-center gap-3 ${textColor}`}
        >
          <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-[hsl(210,100%,65%)]' : 'text-[#060541]'}`} />
          <span className="text-lg font-medium">{t('Creating your account...', 'جارٍ إنشاء حسابك...')}</span>
        </motion.div>
      )}

      {/* ─── Welcome state ──────────────────────────────────────────────────── */}
      {currentStep?.id === 'welcome' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className={`flex flex-col items-center gap-3 text-center ${textColor}`}
        >
          <div className="text-4xl">🎉</div>
          <h2 className="text-xl font-bold">{t('Welcome to Wakti!', 'مرحبًا بك في وقتي!')}</h2>
          <p className={`text-sm ${textMuted}`}>
            {t("You have free access for 24 hours. Don't forget to subscribe!", 'لديك وصول مجاني لمدة 24 ساعة. لا تنسَ الاشتراك!')}
          </p>
        </motion.div>
      )}

      {/* ─── Filled fields summary (small, at bottom) ─────────────────────── */}
      {stepIndex > 1 && currentStep?.id !== 'welcome' && currentStep?.id !== 'creating' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`w-full max-w-sm mt-2 rounded-xl border p-3 text-xs space-y-1 ${cardBg} ${textMuted}`}
        >
          {formData.name && <div><span className="font-medium">{t('Name:', 'الاسم:')}</span> {formData.name}</div>}
          {formData.username && <div><span className="font-medium">{t('Username:', 'المستخدم:')}</span> {formData.username}</div>}
          {formData.email && <div><span className="font-medium">{t('Email:', 'البريد:')}</span> {formData.email}</div>}
          {formData.password && <div><span className="font-medium">{t('Password:', 'كلمة المرور:')}</span> ••••••</div>}
          {formData.dob && <div><span className="font-medium">{t('DOB:', 'الميلاد:')}</span> {formData.dob}</div>}
          {formData.country && <div><span className="font-medium">{t('Country:', 'البلد:')}</span> {formData.country}</div>}
          {formData.city && <div><span className="font-medium">{t('City:', 'المدينة:')}</span> {formData.city}</div>}
        </motion.div>
      )}
    </div>
  );
}
