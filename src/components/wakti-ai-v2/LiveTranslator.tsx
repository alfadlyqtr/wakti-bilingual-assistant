import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeftRight, Mic, X, Volume2, Languages, Loader2 } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';
import TrialGateOverlay from '@/components/TrialGateOverlay';
import { emitEvent } from '@/utils/eventBus';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface LiveTranslatorProps {
  onBack?: () => void;
}

type LiveTranslatorStatus = 'idle' | 'listening' | 'processing' | 'speaking';

const MIN_USER_RECORD_MS = 500;
const MAX_USER_RECORD_SECONDS = 20;

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

const LANGUAGE_CODES = new Set(TRANSLATION_LANGUAGES.map((lang) => lang.code));
const getValidLanguageCode = (value: string | null | undefined, fallback: string) => {
  if (value && LANGUAGE_CODES.has(value)) return value;
  return fallback;
};


export function LiveTranslator({ onBack }: LiveTranslatorProps) {
  const { language, theme } = useTheme();
  const t = useCallback((en: string, ar: string) => (language === 'ar' ? ar : en), [language]);

  const getValidVoice = (v: string | null): 'cedar' | 'marin' =>
    v === 'cedar' || v === 'marin' ? v : 'cedar';

  const getValidLang = (v: string | null, fallback: string) => {
    if (v && TRANSLATION_LANGUAGES.some(l => l.code === v)) return v;
    return fallback;
  };

  // ── State ──────────────────────────────────────────────────────────────────
  const [targetLanguage, setTargetLanguage] = useState(() =>
    getValidLang(localStorage.getItem('wakti_live_translator_target'), 'ar')
  );
  const [spokenLanguage, setSpokenLanguage] = useState(() =>
    getValidLang(localStorage.getItem('wakti_live_translator_spoken'), language === 'ar' ? 'ar' : 'en')
  );
  const [voice, setVoice] = useState(() => getValidVoice(localStorage.getItem('wakti_live_translator_voice')));
  const [status, setStatus] = useState<LiveTranslatorStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [countdown, setCountdown] = useState(MAX_USER_RECORD_SECONDS);
  const [userTranscript, setUserTranscript] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [replayUrl, setReplayUrl] = useState<string | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const holdStartRef = useRef<number>(0);
  const activePointerIdRef = useRef<number | null>(null);
  const isHoldingRef = useRef(false);
  const targetLangRef = useRef(targetLanguage);
  const spokenLangRef = useRef(spokenLanguage);
  const voiceRef = useRef(voice);
  const abortRef = useRef<AbortController | null>(null);

  // Keep refs synced + persist
  useEffect(() => { targetLangRef.current = targetLanguage; localStorage.setItem('wakti_live_translator_target', targetLanguage); }, [targetLanguage]);
  useEffect(() => { spokenLangRef.current = spokenLanguage; localStorage.setItem('wakti_live_translator_spoken', spokenLanguage); }, [spokenLanguage]);
  useEffect(() => { voiceRef.current = voice; localStorage.setItem('wakti_live_translator_voice', voice); }, [voice]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (audioRef.current) { try { audioRef.current.pause(); } catch {} }
    };
  }, []);

  // ── Core: send audio to edge function ─────────────────────────────────────
  const processAudio = useCallback(async (audioBlob: Blob) => {
    setStatus('processing');
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error(t('Please sign in to use Live Translator.', 'يرجى تسجيل الدخول لاستخدام المترجم الفوري.'));

      const form = new FormData();
      form.append('audio', audioBlob, 'audio.webm');
      form.append('target_language', targetLangRef.current);
      form.append('spoken_language', spokenLangRef.current);
      form.append('voice', voiceRef.current);

      abortRef.current = new AbortController();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/live-translate`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: form,
          signal: abortRef.current.signal,
        }
      );

      const json = await res.json();

      // Trial gate
      if (json.error === 'TRIAL_LIMIT_REACHED' || res.status === 403) {
        emitEvent('wakti-trial-limit-reached', {
          feature: json.feature || 'interpreter',
          reason: json.reason,
          code: json.code,
          consumed: json.consumed,
          limit: json.limit,
          remaining: json.remaining,
        });
        setStatus('idle');
        return;
      }

      if (!res.ok || json.error) {
        throw new Error(json.error || t('Translation failed. Please try again.', 'فشلت الترجمة. حاول مرة أخرى.'));
      }

      const { transcript, translation, audio_base64, audio_mime } = json;

      setUserTranscript(transcript || '');
      setTranslatedText(translation || '');

      // Trial quota finished notification
      if (json.trial?.justExhausted || json.trial?.remaining === 0) {
        emitEvent('wakti-trial-quota-finished', {
          feature: 'interpreter',
          consumed: json.trial?.consumed,
          limit: json.trial?.limit,
          remaining: json.trial?.remaining,
        });
      }

      // Play audio + enable replay
      if (audio_base64) {
        const byteArr = Uint8Array.from(atob(audio_base64), c => c.charCodeAt(0));
        const blob = new Blob([byteArr], { type: audio_mime || 'audio/mp3' });
        const url = URL.createObjectURL(blob);

        // revoke previous replay URL
        setReplayUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });

        if (audioRef.current) {
          setStatus('speaking');
          audioRef.current.src = url;
          audioRef.current.load();
          audioRef.current.onended = () => setStatus('idle');
          audioRef.current.onerror = () => {
            setError(t('Could not play the translated voice.', 'تعذر تشغيل صوت الترجمة.'));
            setStatus('idle');
          };
          try { await audioRef.current.play(); } catch {
            setStatus('idle');
          }
        } else {
          setStatus('idle');
        }
      } else {
        setStatus('idle');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setError(err?.message || t('Something went wrong. Please try again.', 'حدث خطأ. حاول مرة أخرى.'));
      setStatus('idle');
    }
  }, [t]);

  // ── Hold / Release logic ───────────────────────────────────────────────────
  const stopHold = useCallback(() => {
    if (!isHoldingRef.current) return;
    isHoldingRef.current = false;
    setIsHolding(false);

    if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }

    const holdMs = Date.now() - holdStartRef.current;
    if (holdMs < MIN_USER_RECORD_MS) {
      setError(t('Hold a little longer, then release to translate.', 'استمر بالضغط قليلاً ثم ارفع إصبعك للترجمة.'));
      setStatus('idle');
      if (mediaRecorderRef.current?.state !== 'inactive') { try { mediaRecorderRef.current?.stop(); } catch {} }
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      return;
    }

    // stop recording → ondataavailable fires → processAudio
    if (mediaRecorderRef.current?.state !== 'inactive') {
      try { mediaRecorderRef.current?.stop(); } catch {}
    }
  }, [t]);

  const startHold = useCallback(async () => {
    if (status === 'processing' || status === 'speaking') return;

    setError(null);
    setUserTranscript('');
    setTranslatedText('');
    setCountdown(MAX_USER_RECORD_SECONDS);

    try {
      if (!streamRef.current || streamRef.current.getTracks().every(t => t.readyState === 'ended')) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch {
      setError(t('Microphone access denied. Please allow microphone.', 'تم رفض الوصول إلى الميكروفون. يرجى السماح به.'));
      return;
    }

    audioChunksRef.current = [];
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', ''].find(m => !m || MediaRecorder.isTypeSupported(m)) || '';
    const recorder = mimeType ? new MediaRecorder(streamRef.current, { mimeType }) : new MediaRecorder(streamRef.current);

    recorder.ondataavailable = (e) => { if (e.data?.size > 0) audioChunksRef.current.push(e.data); };
    recorder.onstop = () => {
      if (audioChunksRef.current.length === 0) {
        setError(t('No audio captured. Please try again.', 'لم يتم التقاط صوت. حاول مرة أخرى.'));
        setStatus('idle');
        return;
      }
      const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      audioChunksRef.current = [];
      processAudio(blob);
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    isHoldingRef.current = true;
    setIsHolding(true);
    setStatus('listening');
    holdStartRef.current = Date.now();

    countdownIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - holdStartRef.current) / 1000);
      const remaining = Math.max(0, MAX_USER_RECORD_SECONDS - elapsed);
      setCountdown(remaining);
      if (remaining <= 0) stopHold();
    }, 250);
  }, [status, processAudio, stopHold, t]);

  // ── Pointer events ─────────────────────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (activePointerIdRef.current !== null) return;
    activePointerIdRef.current = e.pointerId;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    startHold();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    if (activePointerIdRef.current !== e.pointerId) return;
    activePointerIdRef.current = null;
    try { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    stopHold();
  };

  // ── Replay ─────────────────────────────────────────────────────────────────
  const handleReplay = useCallback(() => {
    if (!replayUrl || !audioRef.current || status === 'speaking' || status === 'processing') return;
    setStatus('speaking');
    audioRef.current.src = replayUrl;
    audioRef.current.load();
    audioRef.current.onended = () => setStatus('idle');
    audioRef.current.onerror = () => setStatus('idle');
    audioRef.current.play().catch(() => setStatus('idle'));
  }, [replayUrl, status]);

  const isBusy = status === 'listening' || status === 'processing' || status === 'speaking';
  const currentTargetLangName = TRANSLATION_LANGUAGES.find(l => l.code === targetLanguage)?.name[language] || targetLanguage;

  const statusText: Record<LiveTranslatorStatus, string> = {
    idle: t('Hold to speak', 'اضغط مع الاستمرار للتحدث'),
    listening: t('Listening...', 'أسمعك...'),
    processing: t('Translating...', 'جارٍ الترجمة...'),
    speaking: t('Speaking...', 'يتحدث...'),
  };

  return (
    <div
      className="live-translator-nocopy space-y-4 select-none [-webkit-user-select:none] [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent]"
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <TrialGateOverlay featureKey="interpreter" limit={5} featureLabel={{ en: 'Interpreter', ar: 'المترجم الفوري' }} />
      <style>{`
        .live-translator-nocopy, .live-translator-nocopy * {
          -webkit-user-select: none; user-select: none;
          -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent;
        }
        .translator-orb {
          position: relative; width: 120px; height: 120px; border-radius: 50%;
          background: linear-gradient(135deg, hsl(180 85% 60%) 0%, hsl(280 70% 65%) 50%, hsl(25 95% 60%) 100%);
          background-size: 300% 300%; display: flex; align-items: center; justify-content: center;
          cursor: pointer; border: none; outline: none; transition: all 0.3s ease;
          animation: tGrad 6s ease infinite;
          box-shadow: 0 0 25px hsla(210,100%,65%,0.35), 0 0 45px hsla(280,70%,65%,0.20);
        }
        .translator-orb.listening {
          transform: scale(1.1); animation: tGrad 2.2s ease infinite, tPulse 0.8s ease-in-out infinite;
          box-shadow: 0 0 30px hsla(210,100%,65%,0.9), 0 0 70px hsla(280,70%,65%,0.6);
        }
        .translator-orb.speaking { animation: tGrad 3.5s ease infinite, tBreathe 1.6s ease-in-out infinite; }
        .translator-orb.processing { animation: tGrad 1.8s ease infinite, tSpin 1.5s linear infinite; }
        .translator-orb:disabled { opacity: 0.6; cursor: not-allowed; }
        @keyframes tGrad { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        @keyframes tPulse { 0%,100% { transform: scale(1.1); } 50% { transform: scale(1.17); } }
        @keyframes tBreathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        @keyframes tSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <audio ref={audioRef} playsInline className="hidden" />

      {/* Header */}
      <div className="text-center pb-1">
        <h2 className="text-lg font-semibold flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
          <Languages className="w-5 h-5 text-cyan-400" />
          {t('Live Translator', 'المترجم الفوري')}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t('Hold to speak • release to hear the translation', 'اضغط مع الاستمرار • ارفع إصبعك لسماع الترجمة')}
        </p>
      </div>

      {/* Language + Voice selectors */}
      <div className="grid grid-cols-12 gap-3 p-3 rounded-xl border border-white/10 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10">
        <div className="col-span-5">
          <Label className="text-xs font-medium text-muted-foreground mb-1 block">{t('Spoken', 'المتحدث')}</Label>
          <Select value={spokenLanguage} onValueChange={v => { setSpokenLanguage(v); setUserTranscript(''); setTranslatedText(''); }} disabled={isBusy}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-60">
              {TRANSLATION_LANGUAGES.map(l => <SelectItem key={l.code} value={l.code}>{l.name[language]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2 flex items-end justify-center">
          <button
            type="button"
            title={t('Swap languages', 'تبديل اللغات')}
            disabled={isBusy}
            onClick={() => {
              const ns = targetLanguage; const nt = spokenLanguage;
              setSpokenLanguage(ns); setTargetLanguage(nt);
              setUserTranscript(''); setTranslatedText('');
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/60 dark:bg-white/10 transition-all active:scale-95"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
        </div>

        <div className="col-span-5">
          <Label className="text-xs font-medium text-muted-foreground mb-1 block">{t('To', 'إلى')}</Label>
          <Select value={targetLanguage} onValueChange={v => { setTargetLanguage(v); setUserTranscript(''); setTranslatedText(''); }} disabled={isBusy}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-60">
              {TRANSLATION_LANGUAGES.map(l => <SelectItem key={l.code} value={l.code}>{l.name[language]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-12">
          <Label className="text-xs font-medium text-muted-foreground mb-1 block">{t('AI Voice', 'صوت الذكاء الاصطناعي')}</Label>
          <Select value={voice} onValueChange={v => setVoice(getValidVoice(v))} disabled={isBusy}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cedar">{t('Male', 'ذكر')}</SelectItem>
              <SelectItem value="marin">{t('Female', 'أنثى')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Hold orb */}
      <div className="flex flex-col items-center gap-3 py-4 select-none">
        <button
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          disabled={status === 'processing' || status === 'speaking'}
          className={`translator-orb touch-none ${status === 'listening' ? 'listening' : ''} ${status === 'speaking' ? 'speaking' : ''} ${status === 'processing' ? 'processing' : ''}`}
        >
          {status === 'processing'
            ? <Loader2 className="w-10 h-10 text-white animate-spin" />
            : status === 'speaking'
            ? <Volume2 className="w-10 h-10 text-white" />
            : <Mic className="w-10 h-10 text-white" />}
        </button>
        <div className="text-center">
          <div className={`text-base font-semibold ${theme === 'dark' ? 'text-white' : 'text-[#060541]'}`}>
            {statusText[status]}{isHolding && <span className="ml-2 text-purple-400 font-bold">{countdown}s</span>}
          </div>
          <div className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-white/50' : 'text-[#060541]/50'}`}>
            → {currentTargetLangName}
          </div>
        </div>
      </div>

      {/* Transcripts */}
      {(userTranscript || translatedText) && (
        <div className="space-y-2">
          {userTranscript && (
            <div className={`px-3 py-2 rounded-lg border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5 font-bold">
                {TRANSLATION_LANGUAGES.find(l => l.code === spokenLanguage)?.name[language]} — {t('You said', 'قلت')}
              </div>
              <div className="text-sm" dir="auto">{userTranscript}</div>
            </div>
          )}
          {translatedText && (
            <div className="px-3 py-2 rounded-lg border border-white/10 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="text-[10px] uppercase tracking-wider bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 bg-clip-text text-transparent font-bold">
                  {TRANSLATION_LANGUAGES.find(l => l.code === targetLanguage)?.name[language]} — {t('Translation', 'الترجمة')}
                </div>
                {replayUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleReplay}
                    disabled={status === 'speaking' || status === 'processing'}
                    className="h-7 px-2 text-[11px] text-cyan-500 hover:text-cyan-400"
                  >
                    <Volume2 className="mr-1 h-3.5 w-3.5" /> {t('Replay', 'إعادة')}
                  </Button>
                )}
              </div>
              <div className="text-sm font-medium" dir="auto">{translatedText}</div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-500 text-xs text-center">{error}</div>
      )}
    </div>
  );
}

export default LiveTranslator;
