import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, Loader2, Sparkles, X, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { callEdgeFunctionWithRetry } from '@/integrations/supabase/edgeFunctions';
import { buildVoiceOperatorPlan, type WaktiOperatorPlan, type WaktiOperatorStep } from '@/utils/waktiOperator';
import { onEvent } from '@/utils/eventBus';
import { toast } from '@/components/ui/toast-helper';

interface WaktiOperatorContextValue {
  isOpen: boolean;
  stage: 'idle' | 'recording' | 'transcribing' | 'planning' | 'executing' | 'error';
  transcript: string;
  plan: WaktiOperatorPlan | null;
  error: string | null;
  open: () => void;
  close: () => void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

const WaktiOperatorContext = createContext<WaktiOperatorContextValue | null>(null);

function formatStage(stage: WaktiOperatorContextValue['stage'], language: string) {
  if (stage === 'recording') return language === 'ar' ? 'أستمع الآن' : 'Listening now';
  if (stage === 'transcribing') return language === 'ar' ? 'أحوّل الصوت إلى نص' : 'Transcribing voice';
  if (stage === 'planning') return language === 'ar' ? 'أبني خطة التنفيذ' : 'Building the operator plan';
  if (stage === 'executing') return language === 'ar' ? 'أنفذ الخطوات الآمنة' : 'Running the safe steps';
  if (stage === 'error') return language === 'ar' ? 'حدث خطأ' : 'Something went wrong';
  return language === 'ar' ? 'جاهز' : 'Ready';
}

async function blobToPublicAudioUrl(userId: string, blob: Blob) {
  const extension = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm';
  const path = `${userId}/voice-operator-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from('tasjeel_recordings').upload(path, blob, {
    contentType: blob.type || 'audio/webm',
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('tasjeel_recordings').getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error('Failed to create a public audio URL');
  }
  return data.publicUrl.trim();
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const planRef = useRef<WaktiOperatorPlan | null>(null);

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
    setIsOpen(false);
  }, [cleanupStream]);

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
      const hasRemainingSafeSteps = nextPlan.steps.some((step) => step.risk === 'safe' && step.status !== 'completed');
      setError(null);
      setStage(hasRemainingSafeSteps ? 'executing' : 'idle');
    });
  }, [language]);

  const executePlan = useCallback(async (nextPlan: WaktiOperatorPlan) => {
    setStage('executing');
    const firstStep = nextPlan.steps.find((step) => step.risk === 'safe' && step.href);
    if (!firstStep?.href) {
      setStage('idle');
      return;
    }
    updateStep(firstStep.id, (current) => ({ ...current, status: 'running' }));
    navigate(firstStep.href);
  }, [navigate, updateStep]);

  const handleRecordedBlob = useCallback(async (blob: Blob) => {
    if (!user?.id) {
      throw new Error(language === 'ar' ? 'يجب تسجيل الدخول أولاً.' : 'You need to sign in first.');
    }
    setStage('transcribing');
    const audioUrl = await blobToPublicAudioUrl(user.id, blob);
    const response = await callEdgeFunctionWithRetry<{ transcript: string }>('transcribe-audio', {
      body: {
        audioUrl,
        language: language === 'ar' ? 'ar' : 'en',
      },
      headers: { 'Content-Type': 'application/json' },
    });
    const nextTranscript = (response?.transcript || '').trim();
    if (!nextTranscript) {
      throw new Error(language === 'ar' ? 'لم أسمع نصاً واضحاً.' : 'I did not get a clear transcript.');
    }
    setTranscript(nextTranscript);
    setStage('planning');
    const nextPlan = buildVoiceOperatorPlan(nextTranscript, language === 'ar' ? 'ar' : 'en');
    planRef.current = nextPlan;
    setPlan(nextPlan);
    await executePlan(nextPlan);
  }, [executePlan, language, user?.id]);

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

  const value = useMemo<WaktiOperatorContextValue>(() => ({
    isOpen,
    stage,
    transcript,
    plan,
    error,
    open: () => setIsOpen(true),
    close,
    startRecording,
    stopRecording,
  }), [close, error, isOpen, plan, stage, startRecording, stopRecording, transcript]);

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
  const { language } = useTheme();
  const { user } = useAuth();
  const { isOpen, stage, transcript, plan, error, close, startRecording, stopRecording } = useWaktiOperator();
  const [isExpanded, setIsExpanded] = useState(false);
  const statusLabel = formatStage(stage, language);
  const isBusy = stage === 'transcribing' || stage === 'planning' || stage === 'executing';
  const isRecording = stage === 'recording';
  const runningStep = plan?.steps.find((step) => step.status === 'running') || null;
  const nextStep = plan?.steps.find((step) => step.status === 'pending') || null;
  const currentStep = runningStep || nextStep || plan?.steps[plan.steps.length - 1] || null;
  const completedSteps = plan?.steps.filter((step) => step.status === 'completed').length || 0;

  useEffect(() => {
    if (isBusy) {
      setIsExpanded(false);
      return;
    }
    if (isRecording || stage === 'error') {
      setIsExpanded(true);
    }
  }, [isBusy, isRecording, stage]);

  if (!user) return null;

  return (
    <>
      {isOpen ? (
        <div className={`fixed right-3 z-[85] rounded-[1.5rem] border border-cyan-400/20 bg-[linear-gradient(135deg,rgba(12,15,20,0.88)_0%,rgba(18,25,39,0.92)_48%,rgba(9,14,25,0.92)_100%)] text-white shadow-[0_24px_80px_rgba(0,0,0,0.52),0_0_30px_rgba(56,189,248,0.18)] backdrop-blur-xl transition-all duration-300 md:bottom-6 ${isExpanded ? 'bottom-[5.75rem] w-[min(24rem,calc(100vw-1.5rem))] p-4' : 'bottom-[5.9rem] w-[min(18rem,calc(100vw-1.5rem))] p-3'}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-100">
                <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                {language === 'ar' ? 'مشغّل وكتي' : 'Wakti Operator'}
              </div>
              <p className="mt-2 text-sm font-semibold text-white/90">{statusLabel}</p>
              {!isExpanded && currentStep ? (
                <p className="mt-1 text-xs leading-5 text-white/65">
                  {currentStep.label}
                  {plan?.steps?.length ? ` • ${completedSteps}/${plan.steps.length}` : ''}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {isBusy || plan?.steps?.length ? (
                <button
                  type="button"
                  onClick={() => setIsExpanded((current) => !current)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/75 transition-all hover:bg-white/10 hover:text-white active:scale-95"
                  aria-label={isExpanded ? (language === 'ar' ? 'تصغير' : 'Collapse') : (language === 'ar' ? 'توسيع' : 'Expand')}
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </button>
              ) : null}
              <button
                type="button"
                onClick={close}
                className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/75 transition-all hover:bg-white/10 hover:text-white active:scale-95"
                aria-label={language === 'ar' ? 'إغلاق' : 'Close'}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {!isExpanded && currentStep ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm leading-6 text-white/82">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-white">{currentStep.label}</p>
                  <p className="mt-1 text-xs leading-5 text-white/65">{currentStep.description}</p>
                </div>
                {currentStep.status === 'completed' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : null}
                {currentStep.status === 'running' ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /> : null}
              </div>
            </div>
          ) : null}

          {isExpanded && transcript ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm leading-6 text-white/80">
              {transcript}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-3 py-3 text-sm text-rose-50">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {isExpanded && plan?.steps?.length ? (
            <div className="mt-4 space-y-2">
              {plan.steps.map((step) => (
                <div key={step.id} className={`rounded-2xl border px-3 py-3 text-sm ${step.status === 'completed' ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-50' : step.status === 'running' ? 'border-cyan-300/20 bg-cyan-400/10 text-cyan-50' : step.status === 'paused' ? 'border-amber-300/20 bg-amber-300/10 text-amber-50' : 'border-white/10 bg-black/15 text-white/80'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{step.label}</p>
                      <p className="mt-1 text-xs leading-5 text-white/70">{step.description}</p>
                    </div>
                    {step.status === 'completed' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : null}
                    {step.status === 'running' ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className={`flex items-center gap-2 ${isExpanded ? 'mt-4' : 'mt-3'}`}>
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isBusy}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 ${isExpanded ? 'py-3 text-sm' : 'py-2.5 text-[13px]'} font-bold transition-all active:scale-[0.98] ${isRecording ? 'bg-rose-500 text-white shadow-[0_10px_32px_rgba(244,63,94,0.32)]' : 'bg-[linear-gradient(135deg,#060541_0%,#1b2b78_100%)] text-white shadow-[0_12px_36px_rgba(6,5,65,0.35)]'} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              <span>
                {isRecording
                  ? (language === 'ar' ? 'إيقاف' : 'Stop')
                  : (language === 'ar' ? 'تحدث الآن' : 'Speak now')}
              </span>
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
