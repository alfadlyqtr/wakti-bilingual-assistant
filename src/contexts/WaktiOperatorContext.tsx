import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, Loader2, Sparkles, X, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { callEdgeFunctionWithRetry } from '@/integrations/supabase/edgeFunctions';
import { buildVoiceOperatorPlan, createWaktiOperatorInteractionExecutionPlan, editWaktiOperatorInteraction, updateWaktiOperatorInteraction, type WaktiOperatorMusicRequest, type WaktiOperatorPlan, type WaktiOperatorStep } from '@/utils/waktiOperator';
import type { WaktiExecutionFieldValue } from '@/utils/waktiExecutionSchemas';
import { getWaktiMusicStyleGroups } from '@/utils/musicStyleCatalog';
import { analyzeWaktiOperatorSemantics } from '@/utils/waktiOperatorSemantic';
import { onEvent } from '@/utils/eventBus';
import { toast } from '@/components/ui/toast-helper';

interface WaktiOperatorContextValue {
  isOpen: boolean;
  stage: 'idle' | 'recording' | 'transcribing' | 'planning' | 'executing' | 'error';
  showIntro: boolean;
  transcript: string;
  plan: WaktiOperatorPlan | null;
  error: string | null;
  open: () => void;
  close: () => void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  runTextRequest: (request: string) => Promise<void>;
  updateInteraction: (values: Record<string, WaktiExecutionFieldValue>) => void;
  continueInteraction: (allowFeatureCollection?: boolean) => Promise<void>;
  editInteraction: (fieldKey?: string) => void;
}

const WaktiOperatorContext = createContext<WaktiOperatorContextValue | null>(null);
const WAKTI_OPERATOR_INTRO_OPENS = 3;

function getOperatorIntroStorageKey(userId?: string) {
  return `wakti_operator_intro_count_${userId || 'guest'}`;
}

function formatStage(stage: WaktiOperatorContextValue['stage'], language: string) {
  if (stage === 'recording') return language === 'ar' ? 'أستمع الآن' : 'Listening now';
  if (stage === 'transcribing') return language === 'ar' ? 'أحوّل الصوت إلى نص' : 'Transcribing voice';
  if (stage === 'planning') return language === 'ar' ? 'أبني خطة التنفيذ' : 'Building the operator plan';
  if (stage === 'executing') return language === 'ar' ? 'أنفذ الخطوات الآمنة' : 'Running the safe steps';
  if (stage === 'error') return language === 'ar' ? 'حدث خطأ' : 'Something went wrong';
  return language === 'ar' ? 'جاهز' : 'Ready';
}

async function uploadOperatorAudio(userId: string, blob: Blob) {
  const extension = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm';
  const path = `${userId}/voice-operator-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from('tasjeel_recordings').upload(path, blob, {
    contentType: blob.type || 'audio/webm',
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export function WaktiOperatorProvider({ children }: { children: React.ReactNode }) {
  const { language } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [stage, setStage] = useState<WaktiOperatorContextValue['stage']>('idle');
  const [transcript, setTranscript] = useState('');
  const [plan, setPlan] = useState<WaktiOperatorPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [introOpenCount, setIntroOpenCount] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const planRef = useRef<WaktiOperatorPlan | null>(null);
  const pendingMusicRef = useRef<WaktiOperatorMusicRequest | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const rawCount = window.localStorage.getItem(getOperatorIntroStorageKey(user?.id));
    const parsedCount = Number.parseInt(rawCount || '0', 10);
    setIntroOpenCount(Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 0);
  }, [user?.id]);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const close = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    } else {
      cleanupStream();
      setStage('idle');
    }
    pendingMusicRef.current = null;
    setIsOpen(false);
  }, [cleanupStream]);

  const open = useCallback(() => {
    setError(null);
    setPlan(null);
    setTranscript('');
    setStage('idle');
    setIsOpen(true);
    if (typeof window === 'undefined') return;
    const nextCount = introOpenCount + 1;
    window.localStorage.setItem(getOperatorIntroStorageKey(user?.id), String(nextCount));
    setIntroOpenCount(nextCount);
  }, [introOpenCount, user?.id]);

  const updateStep = useCallback((stepId: string, updater: (step: WaktiOperatorStep) => WaktiOperatorStep) => {
    setPlan((current) => {
      if (!current) return current;
      const nextPlan = {
        ...current,
        steps: current.steps.map((step) => step.id === stepId ? updater(step) : step),
      };
      planRef.current = nextPlan;
      return nextPlan;
    });
  }, []);

  useEffect(() => {
    planRef.current = plan;
  }, [plan]);

  useEffect(() => {
    return onEvent('wakti-operator-status', ({ runId, stepId, status, error: nextError }) => {
      const currentPlan = planRef.current;
      if (!currentPlan || currentPlan.id !== runId) return;
      const nextPlan = {
        ...currentPlan,
        steps: currentPlan.steps.map((step) => step.id === stepId ? { ...step, status } : step),
      };
      planRef.current = nextPlan;
      setPlan(nextPlan);
      if (status === 'failed') {
        setError(nextError || (language === 'ar' ? 'فشل تنفيذ الطلب.' : 'The operator failed to finish the request.'));
        setStage('error');
        return;
      }
      // A paused step means the operator is waiting on the user (e.g. pick a
      // contact). Drop out of the busy/executing state so the overlay does not
      // look stuck on a spinner.
      if (status === 'paused') {
        setError(null);
        setStage('idle');
        return;
      }
      const hasRemainingSafeSteps = nextPlan.steps.some((step) => step.risk === 'safe' && step.status !== 'completed' && step.status !== 'paused');
      setError(null);
      setStage(hasRemainingSafeSteps ? 'executing' : 'idle');
    });
  }, [language]);

  const executePlan = useCallback(async (nextPlan: WaktiOperatorPlan) => {
    if (nextPlan.mode === 'guidance' || nextPlan.mode === 'interaction') {
      setStage('idle');
      return;
    }
    setStage('executing');
    const firstStep = nextPlan.steps.find((step) => step.risk === 'safe' && step.href);
    if (!firstStep?.href) {
      setStage('idle');
      return;
    }
    updateStep(firstStep.id, (current) => ({ ...current, status: 'running' }));
    navigate(firstStep.href);
    if (nextPlan.steps.length === 1) {
      window.setTimeout(() => {
        updateStep(firstStep.id, (current) => ({ ...current, status: 'completed' }));
        setStage('idle');
      }, 120);
      return;
    }
    const handoffStep = nextPlan.steps.find((step) => step.kind === 'handoff_action');
    if (handoffStep) {
      window.setTimeout(() => {
        updateStep(firstStep.id, (current) => ({ ...current, status: 'completed' }));
        updateStep(handoffStep.id, (current) => ({ ...current, status: 'paused' }));
        setStage('idle');
      }, 120);
    }
  }, [navigate, updateStep]);

  const runTextRequest = useCallback(async (request: string) => {
    if (!user?.id) {
      throw new Error(language === 'ar' ? 'يجب تسجيل الدخول أولاً.' : 'You need to sign in first.');
    }
    const nextTranscript = request.trim();
    if (!nextTranscript) {
      throw new Error(language === 'ar' ? 'اكتب أو قل طلباً واضحاً أولاً.' : 'Please provide a clear request first.');
    }
    setIsOpen(true);
    setError(null);
    setPlan(null);
    setTranscript(nextTranscript);
    setStage('planning');
    const nextLanguage = language === 'ar' ? 'ar' : 'en';
    const semantic = await analyzeWaktiOperatorSemantics(nextTranscript, nextLanguage, pendingMusicRef.current);
    const nextPlan = buildVoiceOperatorPlan(nextTranscript, nextLanguage, semantic);
    if (semantic?.capability === 'music' && semantic.intent !== 'cancel') {
      pendingMusicRef.current = {
        title: semantic.title || '',
        lyrics: semantic.lyrics || '',
        topic: semantic.topic || '',
        style: semantic.style || '',
        mode: semantic.mode || undefined,
        vocalType: semantic.vocalType || undefined,
        intent: semantic.intent,
        autoGenerate: false,
      };
    } else if (semantic?.intent === 'cancel' || semantic?.capability === 'other') {
      pendingMusicRef.current = null;
    }
    planRef.current = nextPlan;
    setPlan(nextPlan);
    await executePlan(nextPlan);
  }, [executePlan, language, user?.id]);

  const updateInteraction = useCallback((values: Record<string, WaktiExecutionFieldValue>) => {
    setPlan((current) => {
      if (!current?.interaction) return current;
      const nextPlan = updateWaktiOperatorInteraction(current, values, language === 'ar' ? 'ar' : 'en');
      planRef.current = nextPlan;
      return nextPlan;
    });
    setError(null);
    setStage('idle');
  }, [language]);

  const continueInteraction = useCallback(async (allowFeatureCollection = false) => {
    const currentPlan = planRef.current;
    if (!currentPlan?.interaction) return;
    const nextPlan = createWaktiOperatorInteractionExecutionPlan(currentPlan, language === 'ar' ? 'ar' : 'en', allowFeatureCollection);
    if (!nextPlan) return;
    planRef.current = nextPlan;
    setPlan(nextPlan);
    await executePlan(nextPlan);
  }, [executePlan, language]);

  const editInteraction = useCallback((fieldKey?: string) => {
    setPlan((current) => {
      if (!current?.interaction) return current;
      const nextPlan = editWaktiOperatorInteraction(current, fieldKey, language === 'ar' ? 'ar' : 'en');
      planRef.current = nextPlan;
      return nextPlan;
    });
    setError(null);
    setStage('idle');
  }, [language]);

  const handleRecordedBlob = useCallback(async (blob: Blob) => {
    if (!user?.id) {
      throw new Error(language === 'ar' ? 'يجب تسجيل الدخول أولاً.' : 'You need to sign in first.');
    }
    setStage('transcribing');
    const storagePath = await uploadOperatorAudio(user.id, blob);
    const response = await callEdgeFunctionWithRetry<{ transcript: string }>('transcribe-audio', {
      body: {
        storagePath,
        language: language === 'ar' ? 'ar' : 'en',
      },
      headers: { 'Content-Type': 'application/json' },
    });
    const nextTranscript = (response?.transcript || '').trim();
    if (!nextTranscript) {
      throw new Error(language === 'ar' ? 'لم أسمع نصاً واضحاً.' : 'I did not get a clear transcript.');
    }
    await runTextRequest(nextTranscript);
  }, [language, runTextRequest, user?.id]);

  const startRecording = useCallback(async () => {
    if (!user) {
      toast.error(language === 'ar' ? 'سجّل الدخول أولاً.' : 'Please sign in first.');
      return;
    }
    setIsOpen(true);
    setError(null);
    setPlan(null);
    setTranscript('');
    setStage('recording');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setStage('error');
        setError(language === 'ar' ? 'فشل تسجيل الصوت.' : 'Voice recording failed.');
        cleanupStream();
      };
      recorder.onstop = async () => {
        const recordedBlob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        cleanupStream();
        if (recordedBlob.size < 800) {
          setStage('idle');
          setError(language === 'ar' ? 'التسجيل قصير جداً.' : 'The recording was too short.');
          return;
        }
        try {
          await handleRecordedBlob(recordedBlob);
        } catch (recordingError) {
          console.error('Wakti Operator voice flow failed:', recordingError);
          setStage('error');
          setError(recordingError instanceof Error ? recordingError.message : (language === 'ar' ? 'فشل تشغيل وكتي.' : 'Wakti Operator failed.'));
        }
      };
      recorder.start();
    } catch (recordingError) {
      console.error('Wakti Operator recording failed:', recordingError);
      cleanupStream();
      setStage('error');
      setError(recordingError instanceof Error ? recordingError.message : (language === 'ar' ? 'تعذر الوصول إلى الميكروفون.' : 'Could not access the microphone.'));
    }
  }, [cleanupStream, handleRecordedBlob, language, user]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      return;
    }
    cleanupStream();
    setStage('idle');
  }, [cleanupStream]);

  const showIntro = isOpen
    && stage === 'idle'
    && !plan?.steps?.length
    && !transcript
    && !error
    && introOpenCount > 0
    && introOpenCount <= WAKTI_OPERATOR_INTRO_OPENS;

  const value = useMemo<WaktiOperatorContextValue>(() => ({
    isOpen,
    stage,
    showIntro,
    transcript,
    plan,
    error,
    open,
    close,
    startRecording,
    stopRecording,
    runTextRequest,
    updateInteraction,
    continueInteraction,
    editInteraction,
  }), [close, continueInteraction, editInteraction, error, isOpen, open, plan, runTextRequest, showIntro, stage, startRecording, stopRecording, transcript, updateInteraction]);

  return <WaktiOperatorContext.Provider value={value}>{children}</WaktiOperatorContext.Provider>;
}

export function useWaktiOperator() {
  const context = useContext(WaktiOperatorContext);
  if (!context) {
    throw new Error('useWaktiOperator must be used inside WaktiOperatorProvider');
  }
  return context;
}

export function WaktiOperatorOverlay() {
  const { language, theme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isOpen, stage, showIntro, transcript, plan, error, close, startRecording, stopRecording, updateInteraction, continueInteraction, editInteraction } = useWaktiOperator();
  const [isExpanded, setIsExpanded] = useState(false);
  const [openChoiceGroupId, setOpenChoiceGroupId] = useState<string | null>(null);
  const [interactionDraftText, setInteractionDraftText] = useState('');
  const [visualMode, setVisualMode] = useState<'default' | 'subtle'>('default');
  const statusLabel = formatStage(stage, language);
  const isBusy = stage === 'transcribing' || stage === 'planning' || stage === 'executing';
  const isRecording = stage === 'recording';
  const isDark = theme === 'dark';
  const isArabic = language === 'ar';
  const hasPlanSteps = Boolean(plan?.steps?.length);
  const isGuidancePlan = plan?.mode === 'guidance';
  const isInteractionPlan = plan?.mode === 'interaction' && Boolean(plan?.interaction);
  const guidanceSteps = isGuidancePlan ? (plan?.steps || []) : [];
  const interaction = isInteractionPlan ? plan?.interaction : undefined;
  const activeInteractionField = interaction?.phase === 'collect'
    ? interaction.action.fields.find((field) => field.key === interaction.focusFieldKey) || interaction.action.fields[0]
    : undefined;
  const activeMusicStyleGroups = activeInteractionField?.choiceSource === 'music_style'
    ? getWaktiMusicStyleGroups(language === 'ar' ? 'ar' : 'en')
    : [];
  const runningStep = plan?.steps.find((step) => step.status === 'running') || null;
  const pausedStep = plan?.steps.find((step) => step.status === 'paused') || null;
  const nextStep = plan?.steps.find((step) => step.status === 'pending') || null;
  const hasIncompleteSteps = Boolean(plan?.steps?.some((step) => step.status !== 'completed'));
  const currentStep = runningStep || pausedStep || nextStep || plan?.steps[plan.steps.length - 1] || null;
  const completedSteps = plan?.steps.filter((step) => step.status === 'completed').length || 0;
  const showReadyState = stage === 'idle' && !isRecording && !isBusy && !error && (!hasPlanSteps || !hasIncompleteSteps);
  const showCompactReadyBar = showReadyState && !showIntro;
  const showCollapsedStepCard = !isExpanded && currentStep && (isBusy || (hasPlanSteps && hasIncompleteSteps && !isGuidancePlan));
  const shouldUseCompactBusyShell = isBusy && !isExpanded;
  const isSubtle = visualMode === 'subtle' && !isExpanded;
  const shellClass = isDark
    ? 'border-cyan-400/18 bg-[linear-gradient(180deg,rgba(19,24,35,0.96)_0%,rgba(13,18,28,0.94)_100%)] text-white shadow-[0_26px_90px_rgba(0,0,0,0.52),0_0_32px_rgba(56,189,248,0.12)]'
    : 'border-[#060541]/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(248,250,255,0.94)_100%)] text-[#060541] shadow-[0_18px_48px_rgba(6,5,65,0.12),0_8px_24px_rgba(6,5,65,0.08)]';
  const badgeClass = isDark
    ? 'border-cyan-300/20 bg-cyan-400/10 text-cyan-100'
    : 'border-cyan-500/20 bg-cyan-500/8 text-cyan-700';
  const closeButtonClass = isDark
    ? 'border-white/10 bg-white/5 text-white/72 hover:bg-white/10 hover:text-white'
    : 'border-[#060541]/10 bg-[#060541]/[0.04] text-[#060541]/60 hover:bg-[#060541]/[0.08] hover:text-[#060541]';
  const supportingTextClass = isDark ? 'text-white/62' : 'text-[#060541]/58';
  const mutedTextClass = isDark ? 'text-white/70' : 'text-[#060541]/68';
  const secondarySurfaceClass = isDark
    ? 'border-white/10 bg-black/20'
    : 'border-[#060541]/10 bg-white/70';
  const primaryButtonClass = isDark
    ? 'bg-[linear-gradient(135deg,#060541_0%,#172a7c_100%)] text-white shadow-[0_16px_38px_rgba(6,5,65,0.34),inset_0_1px_0_rgba(255,255,255,0.12)]'
    : 'bg-[linear-gradient(135deg,#060541_0%,#20369b_100%)] text-white shadow-[0_16px_38px_rgba(6,5,65,0.24),inset_0_1px_0_rgba(255,255,255,0.18)]';
  const transcriptClass = isDark ? 'text-white/80' : 'text-[#060541]/78';

  useEffect(() => {
    if (showIntro || isRecording || stage === 'error') {
      setIsExpanded(true);
      return;
    }
    if ((isGuidancePlan || isInteractionPlan) && hasPlanSteps) {
      setIsExpanded(true);
      return;
    }
    if (isBusy) {
      setIsExpanded(false);
    }
  }, [hasPlanSteps, isBusy, isGuidancePlan, isInteractionPlan, isRecording, showIntro, stage]);

  useEffect(() => {
    const value = activeInteractionField && typeof interaction?.values[activeInteractionField.key] === 'string'
      ? interaction.values[activeInteractionField.key] as string
      : '';
    setInteractionDraftText(value);
    setOpenChoiceGroupId(null);
  }, [activeInteractionField?.key, interaction?.values]);

  useEffect(() => {
    return onEvent('wakti-operator-visual-mode', ({ mode }) => {
      setVisualMode(mode === 'subtle' ? 'subtle' : 'default');
    });
  }, []);

  if (!user || !isOpen) return null;

  return (
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
      className={`fixed right-3 top-[4.55rem] z-[85] max-h-[calc(100dvh-5.5rem)] overflow-x-hidden overflow-y-auto rounded-[1.7rem] border backdrop-blur-2xl transition-all duration-300 ${shellClass} ${showIntro || isExpanded ? 'w-[min(24.5rem,calc(100vw-1.5rem))] p-4' : shouldUseCompactBusyShell ? 'w-[min(18.75rem,calc(100vw-1.5rem))] p-3' : 'w-[min(22.5rem,calc(100vw-1.5rem))] p-3.5'} ${isSubtle ? 'scale-[0.9] opacity-12 pointer-events-none saturate-50' : 'opacity-100'}`}
    >
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-px ${isDark ? 'bg-white/14' : 'bg-white/75'}`} />
      <div className="relative flex items-start justify-between gap-3">
        <div className={`min-w-0 flex-1 ${isArabic ? 'text-right' : 'text-left'}`}>
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${badgeClass}`}>
            <Sparkles className={`h-3.5 w-3.5 ${isDark ? 'text-cyan-300' : 'text-cyan-600'}`} />
            {language === 'ar' ? 'مشغّل وكتي' : 'Wakti Operator'}
          </div>
          <p className={`mt-3 text-[1.02rem] font-extrabold leading-[1.35] tracking-[-0.015em] ${isDark ? 'text-white/96' : 'text-[#060541]'}`}>
            {showReadyState
              ? (language === 'ar' ? 'قل لي أين تريد الذهاب أو ماذا تريد إنجازه.' : 'Tell me where you want to go or what you want done.')
              : (isGuidancePlan || isInteractionPlan) && plan?.summary
                ? plan.summary
                : currentStep?.label || statusLabel}
          </p>
          {showIntro ? (
            <p className={`mt-2 max-w-[28ch] text-[0.92rem] leading-6 ${supportingTextClass} ${isArabic ? 'mr-0' : 'ml-0'}`}>
              {language === 'ar' ? 'يمكنني إرشادك داخل وقتي أو تنفيذ الخطوات لك.' : 'I can guide you through Wakti or handle the steps for you.'}
            </p>
          ) : null}
          {!showIntro && showCompactReadyBar ? (
            <p className={`mt-1.5 text-[0.88rem] leading-5 ${supportingTextClass}`}>
              {language === 'ar' ? 'جاهز للاستماع متى بدأت.' : 'Ready when you are.'}
            </p>
          ) : null}
          {!showReadyState && !isExpanded && currentStep ? (
            <p className={`mt-1.5 text-[0.84rem] leading-5 ${supportingTextClass}`}>
              {currentStep.label}
              {plan?.steps?.length ? ` • ${completedSteps}/${plan.steps.length}` : ''}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {isBusy || (hasPlanSteps && hasIncompleteSteps) ? (
            <button
              type="button"
              onClick={() => setIsExpanded((current) => !current)}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition-all active:scale-95 ${closeButtonClass}`}
              aria-label={isExpanded ? (language === 'ar' ? 'تصغير' : 'Collapse') : (language === 'ar' ? 'توسيع' : 'Expand')}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
          ) : null}
          <button
            type="button"
            onClick={close}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition-all active:scale-95 ${closeButtonClass}`}
            aria-label={language === 'ar' ? 'إغلاق' : 'Close'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showCollapsedStepCard ? (
        <div className={`mt-3 ${shouldUseCompactBusyShell ? 'rounded-[1.2rem] px-3 py-2.5' : 'rounded-[1.35rem] px-3.5 py-3.5'} border text-sm leading-6 ${secondarySurfaceClass}`}>
          <div className="flex items-start justify-between gap-3">
            <div className={`min-w-0 flex-1 ${isArabic ? 'text-right' : 'text-left'}`}>
              <p className={`font-bold ${isDark ? 'text-white' : 'text-[#060541]'}`}>{currentStep.label}</p>
              {!shouldUseCompactBusyShell ? (
                <p className={`mt-1 text-xs leading-5 ${supportingTextClass}`}>{currentStep.description}</p>
              ) : null}
            </div>
            {currentStep.status === 'completed' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : null}
            {currentStep.status === 'running' ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /> : null}
            {currentStep.status === 'paused' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : null}
          </div>
        </div>
      ) : null}

      {showIntro ? (
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => startRecording()}
            className={`inline-flex min-h-[3.35rem] flex-1 items-center justify-center gap-2 rounded-[1.25rem] px-4 py-3 text-[0.98rem] font-bold transition-all active:scale-[0.98] ${primaryButtonClass}`}
          >
            <Mic className="h-4 w-4" />
            <span>{language === 'ar' ? 'تحدث' : 'Talk'}</span>
          </button>
        </div>
      ) : null}

      {showCompactReadyBar ? (
        <div className={`mt-3.5 flex items-center gap-3 rounded-[1.3rem] border px-3.5 py-3 ${secondarySurfaceClass}`}>
          <div className={`min-w-0 flex-1 ${isArabic ? 'text-right' : 'text-left'}`}>
            <p className={`text-[0.94rem] font-bold ${isDark ? 'text-white/88' : 'text-[#060541]'}`}>{language === 'ar' ? 'جاهز عندما تكون جاهزاً' : 'Ready when you are'}</p>
            <p className={`mt-0.5 text-xs ${supportingTextClass}`}>{language === 'ar' ? 'ابدأ التحدث لبدء المهمة.' : 'Start talking to begin the task.'}</p>
          </div>
          <button
            type="button"
            onClick={() => startRecording()}
            className={`inline-flex min-h-[2.9rem] shrink-0 items-center justify-center gap-2 rounded-[1rem] px-4 py-2.5 text-sm font-bold transition-all active:scale-[0.98] ${primaryButtonClass}`}
          >
            <Mic className="h-4 w-4" />
            <span>{language === 'ar' ? 'تحدث' : 'Talk'}</span>
          </button>
        </div>
      ) : null}

      {isExpanded && transcript && !isGuidancePlan ? (
        <div className={`mt-4 rounded-[1.3rem] border px-3.5 py-3.5 text-sm leading-6 ${secondarySurfaceClass} ${transcriptClass}`}>
          {transcript}
        </div>
      ) : null}

      {isExpanded && isGuidancePlan ? (
        <div className="mt-4 space-y-3">
          {plan?.answer ? (
            <div className={`rounded-[1.3rem] border px-3.5 py-3.5 text-sm leading-6 ${secondarySurfaceClass} ${transcriptClass}`}>
              {plan.answer}
            </div>
          ) : null}

          {guidanceSteps.length ? (
            <div className={`rounded-[1.3rem] border px-3.5 py-3.5 ${secondarySurfaceClass}`}>
              <div className="space-y-2.5">
                {guidanceSteps.map((step, index) => (
                  <div key={step.id} className={`flex items-start gap-3 rounded-[1rem] border px-3 py-2.5 ${isDark ? 'border-white/8 bg-black/15' : 'border-[#060541]/8 bg-white/75'}`}>
                    <div className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${isDark ? 'bg-cyan-400/12 text-cyan-200' : 'bg-[#060541]/8 text-[#060541]'}`}>
                      {index + 1}
                    </div>
                    <p className={`text-sm leading-6 ${isDark ? 'text-white/88' : 'text-[#060541]/82'}`}>{step.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {plan?.primaryAction ? (
            <button
              type="button"
              onClick={() => {
                close();
                navigate(plan.primaryAction!.href);
              }}
              className={`inline-flex min-h-[3.1rem] w-full items-center justify-center rounded-[1.2rem] px-4 py-3 text-sm font-bold transition-all active:scale-[0.98] ${primaryButtonClass}`}
            >
              {plan.primaryAction.label}
            </button>
          ) : null}
        </div>
      ) : null}

      {isExpanded && isInteractionPlan && interaction ? (
        <div className="mt-4 space-y-3">
          {plan?.answer ? (
            <div className={`rounded-[1.3rem] border px-3.5 py-3.5 text-sm leading-6 ${secondarySurfaceClass} ${transcriptClass}`}>
              {plan.answer}
            </div>
          ) : null}

          {interaction.phase === 'collect' && activeInteractionField ? (
            <div className={`rounded-[1.3rem] border px-3.5 py-3.5 ${secondarySurfaceClass}`}>
              <div className={`flex items-start justify-between gap-3 ${isArabic ? 'text-right' : 'text-left'}`}>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-[#060541]'}`}>
                    {activeInteractionField.label}
                    {activeInteractionField.required ? <span className="ms-1 text-rose-400">*</span> : null}
                  </p>
                  <p className={`mt-1 text-xs leading-5 ${supportingTextClass}`}>{activeInteractionField.help}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${isDark ? 'bg-cyan-400/10 text-cyan-200' : 'bg-cyan-500/10 text-cyan-700'}`}>
                  {activeInteractionField.required ? (language === 'ar' ? 'مطلوب' : 'Needed') : (language === 'ar' ? 'اختياري' : 'Optional')}
                </span>
              </div>

              {(activeInteractionField.type === 'file' || activeInteractionField.type === 'contact') ? (
                <div className="mt-4 space-y-3">
                  <p className={`text-sm leading-6 ${mutedTextClass}`}>
                    {language === 'ar'
                      ? 'هذا العنصر موجود بالفعل داخل وكتي، لذلك سأفتح المكان الصحيح لتختاره بأمان.'
                      : 'This is an existing item inside Wakti, so I will open the right place for you to choose it safely.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => continueInteraction(true)}
                    className={`inline-flex min-h-[3rem] w-full items-center justify-center rounded-[1.1rem] px-4 py-3 text-sm font-bold transition-all active:scale-[0.98] ${primaryButtonClass}`}
                  >
                    {language === 'ar' ? `افتح لاختيار ${activeInteractionField.label}` : `Open to choose ${activeInteractionField.label}`}
                  </button>
                </div>
              ) : activeMusicStyleGroups.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <p className={`text-xs ${mutedTextClass}`}>{language === 'ar' ? 'اختر من مجموعات الأنماط الحقيقية في استوديو الموسيقى.' : 'Choose from the real style groups in Music Studio.'}</p>
                  <div className="grid grid-cols-1 gap-2">
                    {activeMusicStyleGroups.map((group) => {
                      const isOpen = openChoiceGroupId === group.id;
                      return (
                        <div key={group.id} className={`overflow-hidden rounded-[1rem] border ${isDark ? 'border-white/10 bg-black/15' : 'border-[#060541]/10 bg-white/75'}`}>
                          <button
                            type="button"
                            onClick={() => setOpenChoiceGroupId((current) => current === group.id ? null : group.id)}
                            className={`flex min-h-[2.8rem] w-full items-center justify-between gap-3 px-3 text-sm font-bold ${isArabic ? 'text-right' : 'text-left'}`}
                          >
                            <span>{group.title}</span>
                            {isOpen ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                          </button>
                          {isOpen ? (
                            <div className="flex flex-wrap gap-2 border-t border-current/10 p-3">
                              {group.items.map((choice) => (
                                <button
                                  key={choice}
                                  type="button"
                                  onClick={() => updateInteraction({ [activeInteractionField.key]: choice })}
                                  className={`min-h-[2.35rem] rounded-xl border px-3 py-2 text-xs font-semibold transition-all active:scale-95 ${isDark ? 'border-cyan-300/20 bg-cyan-400/10 text-cyan-50 hover:bg-cyan-400/18' : 'border-cyan-500/20 bg-cyan-500/8 text-cyan-800 hover:bg-cyan-500/14'}`}
                                >
                                  {choice}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : activeInteractionField.choices.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {activeInteractionField.choices.map((group) => (
                    <div key={group.id} className="space-y-2">
                      <p className={`text-xs font-bold uppercase tracking-[0.12em] ${mutedTextClass}`}>{group.label}</p>
                      <div className="flex flex-wrap gap-2">
                        {group.choices.map((choice) => (
                          <button
                            key={choice.value}
                            type="button"
                            onClick={() => updateInteraction({ [activeInteractionField.key]: choice.value })}
                            className={`min-h-[2.45rem] rounded-xl border px-3 py-2 text-sm font-semibold transition-all active:scale-95 ${isDark ? 'border-cyan-300/20 bg-cyan-400/10 text-cyan-50 hover:bg-cyan-400/18' : 'border-cyan-500/20 bg-cyan-500/8 text-cyan-800 hover:bg-cyan-500/14'}`}
                          >
                            {choice.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : activeInteractionField.type === 'toggle' ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {[true, false].map((value) => (
                    <button
                      key={String(value)}
                      type="button"
                      onClick={() => updateInteraction({ [activeInteractionField.key]: value })}
                      className={`min-h-[2.8rem] rounded-xl border px-3 py-2 text-sm font-bold transition-all active:scale-95 ${isDark ? 'border-cyan-300/20 bg-cyan-400/10 text-cyan-50 hover:bg-cyan-400/18' : 'border-cyan-500/20 bg-cyan-500/8 text-cyan-800 hover:bg-cyan-500/14'}`}
                    >
                      {value ? (language === 'ar' ? 'نعم' : 'Yes') : (language === 'ar' ? 'لا' : 'No')}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {activeInteractionField.type === 'long_text' ? (
                    <textarea
                      value={interactionDraftText}
                      onChange={(event) => setInteractionDraftText(event.target.value)}
                      rows={4}
                      className={`w-full resize-y rounded-[1rem] border px-3 py-2.5 text-sm outline-none transition-colors ${isDark ? 'border-white/12 bg-black/20 text-white placeholder:text-white/35 focus:border-cyan-300/50' : 'border-[#060541]/12 bg-white text-[#060541] placeholder:text-[#060541]/35 focus:border-cyan-600/40'}`}
                      placeholder={activeInteractionField.help}
                    />
                  ) : (
                    <input
                      type={activeInteractionField.type === 'date' ? 'date' : activeInteractionField.type === 'time' ? 'time' : 'text'}
                      value={interactionDraftText}
                      onChange={(event) => setInteractionDraftText(event.target.value)}
                      className={`min-h-[3rem] w-full rounded-[1rem] border px-3 py-2.5 text-sm outline-none transition-colors ${isDark ? 'border-white/12 bg-black/20 text-white placeholder:text-white/35 focus:border-cyan-300/50' : 'border-[#060541]/12 bg-white text-[#060541] placeholder:text-[#060541]/35 focus:border-cyan-600/40'}`}
                      placeholder={activeInteractionField.help}
                    />
                  )}
                  <button
                    type="button"
                    disabled={!interactionDraftText.trim() && activeInteractionField.required}
                    onClick={() => updateInteraction({ [activeInteractionField.key]: interactionDraftText.trim() })}
                    className={`inline-flex min-h-[2.85rem] w-full items-center justify-center rounded-[1rem] px-4 py-2.5 text-sm font-bold transition-all active:scale-[0.98] ${primaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {language === 'ar' ? 'احفظ وتابع' : 'Save and continue'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className={`rounded-[1.3rem] border px-3.5 py-3.5 ${secondarySurfaceClass}`}>
              <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-[#060541]'}`}>{language === 'ar' ? 'راجع التفاصيل' : 'Review the details'}</p>
              <div className="mt-3 space-y-2">
                {interaction.action.fields
                  .map((field) => {
                    const value = interaction.values[field.key];
                    const hasValue = value !== undefined && value !== '' && (!Array.isArray(value) || value.length > 0);
                    const displayValue = hasValue
                      ? (Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? (value ? (language === 'ar' ? 'نعم' : 'Yes') : (language === 'ar' ? 'لا' : 'No')) : value)
                      : (language === 'ar' ? 'اضغط لإضافة التفاصيل' : 'Tap to add details');
                    return (
                      <button
                        key={field.key}
                        type="button"
                        onClick={() => editInteraction(field.key)}
                        className={`w-full rounded-xl border px-3 py-2.5 transition-colors ${isArabic ? 'text-right' : 'text-left'} ${isDark ? 'border-white/8 bg-black/15 hover:bg-white/8' : 'border-[#060541]/8 bg-white/75 hover:bg-white'}`}
                      >
                        <p className={`text-[11px] font-black uppercase tracking-[0.12em] ${mutedTextClass}`}>{field.label}</p>
                        <p className={`mt-1 text-sm leading-5 ${isDark ? 'text-white/90' : 'text-[#060541]/85'}`}>{displayValue}</p>
                      </button>
                    );
                  })}
              </div>
              <button
                type="button"
                onClick={() => continueInteraction()}
                className={`mt-4 inline-flex min-h-[3rem] w-full items-center justify-center rounded-[1.1rem] px-4 py-3 text-sm font-bold transition-all active:scale-[0.98] ${primaryButtonClass}`}
              >
                {language === 'ar' ? `تابع إلى ${interaction.action.target}` : `Continue to ${interaction.action.target}`}
              </button>
            </div>
          )}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-3 py-3 text-sm text-rose-50">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {isExpanded && hasPlanSteps && !isGuidancePlan && !isInteractionPlan ? (
        <div className="mt-4 space-y-2">
          {plan?.steps.map((step) => (
            <div key={step.id} className={`rounded-[1.25rem] border px-3.5 py-3.5 text-sm ${step.status === 'completed' ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-50' : step.status === 'running' ? 'border-cyan-300/20 bg-cyan-400/10 text-cyan-50' : step.status === 'paused' ? 'border-amber-300/20 bg-amber-300/10 text-amber-50' : isDark ? 'border-white/10 bg-black/15 text-white/80' : 'border-[#060541]/10 bg-white/70 text-[#060541]/78'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className={`min-w-0 flex-1 ${isArabic ? 'text-right' : 'text-left'}`}>
                  <p className="font-bold">{step.label}</p>
                  <p className={`mt-1 text-xs leading-5 ${step.status === 'completed' || step.status === 'running' || step.status === 'paused' ? 'text-current/80' : mutedTextClass}`}>{step.description}</p>
                </div>
                {step.status === 'completed' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : null}
                {step.status === 'running' ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /> : null}
                {step.status === 'paused' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!showIntro && !showCompactReadyBar && !isInteractionPlan ? (
        <div className={`flex items-center gap-2 ${isExpanded ? 'mt-4' : 'mt-3'}`}>
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isBusy}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-[1.2rem] px-4 ${isExpanded ? 'min-h-[3.25rem] py-3 text-sm' : shouldUseCompactBusyShell ? 'min-h-[2.7rem] py-2 text-[12px]' : 'min-h-[3rem] py-2.5 text-[13px]'} font-bold transition-all active:scale-[0.98] ${isRecording ? 'bg-rose-500 text-white shadow-[0_10px_32px_rgba(244,63,94,0.32)]' : primaryButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            <span>
              {isRecording
                ? (language === 'ar' ? 'إيقاف' : 'Stop')
                : (language === 'ar' ? 'تحدث' : 'Talk')}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
