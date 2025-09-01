import React, { useEffect, useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';

// LocalStorage keys
const LS_AR = 'wakti_tts_voice_ar';
const LS_EN = 'wakti_tts_voice_en';
const LS_AUTOPLAY = 'wakti_tts_autoplay';

// Default voice IDs (provided by user)
export const DEFAULT_VOICES = {
  ar: {
    male: 'G1QUjBCuRBbLbAmYlTgl' as const,
    female: 'tavIIPLplRB883FzWU0V' as const,
  },
  en: {
    male: 'TX3LPaxmHKxFdv7VOQHJ' as const,
    female: 'gh8WokH7VR2QkmMmwWHS' as const,
  },
};

type VoiceId = typeof DEFAULT_VOICES.ar.male | typeof DEFAULT_VOICES.ar.female | typeof DEFAULT_VOICES.en.male | typeof DEFAULT_VOICES.en.female;

export function getSelectedVoices() {
  // Read selections with safe fallbacks
  let ar: VoiceId = DEFAULT_VOICES.ar.male;
  let en: VoiceId = DEFAULT_VOICES.en.male;
  try {
    const arSaved = localStorage.getItem(LS_AR);
    if (arSaved && (arSaved === DEFAULT_VOICES.ar.male || arSaved === DEFAULT_VOICES.ar.female)) {
      ar = arSaved as VoiceId;
    }
  } catch {}
  try {
    const enSaved = localStorage.getItem(LS_EN);
    if (enSaved && (enSaved === DEFAULT_VOICES.en.male || enSaved === DEFAULT_VOICES.en.female)) {
      en = enSaved as VoiceId;
    }
  } catch {}
  return { ar, en };
}

export const TalkBackSettings: React.FC = () => {
  const { language } = useTheme();
  const [arVoice, setArVoice] = useState<VoiceId>(DEFAULT_VOICES.ar.male);
  const [enVoice, setEnVoice] = useState<VoiceId>(DEFAULT_VOICES.en.male);
  const [autoPlay, setAutoPlay] = useState<boolean>(false);

  // Load saved selections on mount
  useEffect(() => {
    const { ar, en } = getSelectedVoices();
    setArVoice(ar);
    setEnVoice(en);
    try { setAutoPlay(localStorage.getItem(LS_AUTOPLAY) === '1'); } catch {}
  }, []);

  const saveAr = (val: VoiceId) => {
    setArVoice(val);
    try { localStorage.setItem(LS_AR, val); } catch {}
    // Notify listeners so caches can invalidate
    try { window.dispatchEvent(new CustomEvent('wakti-tts-voice-changed', { detail: { lang: 'ar', voiceId: val } })); } catch {}
  };
  const saveEn = (val: VoiceId) => {
    setEnVoice(val);
    try { localStorage.setItem(LS_EN, val); } catch {}
    try { window.dispatchEvent(new CustomEvent('wakti-tts-voice-changed', { detail: { lang: 'en', voiceId: val } })); } catch {}
  };

  return (
    <div className="bg-muted/30 border border-border/50 rounded-lg p-2">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[11px] font-semibold opacity-80">
        {language === 'ar' ? 'الاستجابة الصوتية' : 'Talk Back'}
        </div>
        <button
          type="button"
          onClick={() => {
            setAutoPlay(prev => {
              const next = !prev;
              try { localStorage.setItem(LS_AUTOPLAY, next ? '1' : '0'); } catch {}
              // Broadcast change so other components (e.g., ChatInput/ChatDrawers listeners) stay in sync
              try { window.dispatchEvent(new CustomEvent('wakti-tts-autoplay-changed', { detail: { value: next } })); } catch {}
              return next;
            });
          }}
          className={`h-6 px-2 rounded-md text-[10px] leading-none flex items-center gap-1 border transition-colors
            ${autoPlay
              ? 'bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-900/40 dark:text-sky-200 dark:border-sky-700/50'
              : 'bg-white/60 text-foreground/80 border-white/60 dark:bg-white/10 dark:text-white/80 dark:border-white/10'}`}
          aria-pressed={autoPlay}
          aria-label={language === 'ar' ? 'تشغيل تلقائي للصوت' : 'Auto Play voice'}
          title={language === 'ar' ? 'تشغيل صوت الرد التالي تلقائيًا' : 'Auto play next assistant reply'}
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: autoPlay ? '#0ea5e9' : '#9ca3af' }}
            aria-hidden="true"
          />
          <span>{language === 'ar' ? 'تشغيل تلقائي' : 'Auto Play'}</span>
        </button>
      </div>

      {/* Arabic */}
      <div className="mb-2">
        <div className="text-[11px] mb-1 opacity-70">{language === 'ar' ? 'العربية' : 'Arabic'}</div>
        <div className="flex gap-1.5 text-[11px]">
          <label className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border ${arVoice === DEFAULT_VOICES.ar.male ? 'border-primary text-primary bg-primary/5' : 'border-border/50'}`}>
            <input
              type="radio"
              name="ar-voice"
              value={DEFAULT_VOICES.ar.male}
              checked={arVoice === DEFAULT_VOICES.ar.male}
              onChange={(e) => saveAr(e.target.value as VoiceId)}
            />
            <span>{language === 'ar' ? 'ذكر' : 'Male'}</span>
          </label>
          <label className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border ${arVoice === DEFAULT_VOICES.ar.female ? 'border-primary text-primary bg-primary/5' : 'border-border/50'}`}>
            <input
              type="radio"
              name="ar-voice"
              value={DEFAULT_VOICES.ar.female}
              checked={arVoice === DEFAULT_VOICES.ar.female}
              onChange={(e) => saveAr(e.target.value as VoiceId)}
            />
            <span>{language === 'ar' ? 'أنثى' : 'Female'}</span>
          </label>
        </div>
      </div>

      {/* English */}
      <div>
        <div className="text-[11px] mb-1 opacity-70">{language === 'ar' ? 'الإنجليزية' : 'English'}</div>
        <div className="flex gap-1.5 text-[11px]">
          <label className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border ${enVoice === DEFAULT_VOICES.en.male ? 'border-primary text-primary bg-primary/5' : 'border-border/50'}`}>
            <input
              type="radio"
              name="en-voice"
              value={DEFAULT_VOICES.en.male}
              checked={enVoice === DEFAULT_VOICES.en.male}
              onChange={(e) => saveEn(e.target.value as VoiceId)}
            />
            <span>{language === 'ar' ? 'ذكر' : 'Male'}</span>
          </label>
          <label className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border ${enVoice === DEFAULT_VOICES.en.female ? 'border-primary text-primary bg-primary/5' : 'border-border/50'}`}>
            <input
              type="radio"
              name="en-voice"
              value={DEFAULT_VOICES.en.female}
              checked={enVoice === DEFAULT_VOICES.en.female}
              onChange={(e) => saveEn(e.target.value as VoiceId)}
            />
            <span>{language === 'ar' ? 'أنثى' : 'Female'}</span>
          </label>
        </div>
      </div>
    </div>
  );
};
