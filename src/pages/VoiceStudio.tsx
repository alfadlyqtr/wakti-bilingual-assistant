import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PenLine, Loader2, Copy } from 'lucide-react';
import { VoiceCloneScreen1 } from '@/components/wakti-ai-v2/VoiceCloneScreen1';
import { VoiceCloneScreen2 } from '@/components/wakti-ai-v2/VoiceCloneScreen2';
import { VoiceCloneScreen3 } from '@/components/wakti-ai-v2/VoiceCloneScreen3';
import { VoiceTTSScreen } from '@/components/wakti-ai-v2/VoiceTTSScreen';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';

const TAB_MAP: Record<string, number> = {
  'tts': 4,
  'text-to-speech': 4,
  'clone': 2,
  'clone-my-voice': 2,
  'voice-translator': 3,
  'text-translator': 5,
};

export default function VoiceStudio() {
  const { language } = useTheme();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [currentScreen, setCurrentScreen] = useState(0); // 0 = Welcome
  const [hasExistingVoices, setHasExistingVoices] = useState(false);
  // Text translator states
  const [ttText, setTtText] = useState('');
  const [ttTarget, setTtTarget] = useState('ar');
  const [ttLoading, setTtLoading] = useState(false);
  const [ttResult, setTtResult] = useState('');
  const TT_MAX = 2500;
  const [ttHistory, setTtHistory] = useState<{ target:string; sourceLen:number; preview:string; ts:number }[]>(() => {
    try {
      const raw = localStorage.getItem('wakti-tt-history');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  const LANGS = [
    { code: 'en', nameEn: 'English', nameAr: 'الإنجليزية' },
    { code: 'ar', nameEn: 'Arabic', nameAr: 'العربية' },
    { code: 'es', nameEn: 'Spanish', nameAr: 'الإسبانية' },
    { code: 'fr', nameEn: 'French', nameAr: 'الفرنسية' },
    { code: 'de', nameEn: 'German', nameAr: 'الألمانية' },
    { code: 'it', nameEn: 'Italian', nameAr: 'الإيطالية' },
    { code: 'pt', nameEn: 'Portuguese', nameAr: 'البرتغالية' },
    { code: 'ru', nameEn: 'Russian', nameAr: 'الروسية' },
    { code: 'hi', nameEn: 'Hindi', nameAr: 'الهندية' },
    { code: 'bn', nameEn: 'Bengali', nameAr: 'البنغالية' },
    { code: 'zh', nameEn: 'Chinese', nameAr: 'الصينية' },
    { code: 'ja', nameEn: 'Japanese', nameAr: 'اليابانية' },
    { code: 'ko', nameEn: 'Korean', nameAr: 'الكورية' },
    { code: 'tr', nameEn: 'Turkish', nameAr: 'التركية' },
    { code: 'fa', nameEn: 'Persian (Farsi)', nameAr: 'الفارسية' },
    { code: 'ur', nameEn: 'Urdu', nameAr: 'الأردية' },
    { code: 'sv', nameEn: 'Swedish', nameAr: 'السويدية' },
    { code: 'no', nameEn: 'Norwegian', nameAr: 'النرويجية' },
    { code: 'da', nameEn: 'Danish', nameAr: 'الدنماركية' },
    { code: 'nl', nameEn: 'Dutch', nameAr: 'الهولندية' },
    { code: 'pl', nameEn: 'Polish', nameAr: 'البولندية' },
    { code: 'uk', nameEn: 'Ukrainian', nameAr: 'الأوكرانية' },
    { code: 'el', nameEn: 'Greek', nameAr: 'اليونانية' },
    { code: 'cs', nameEn: 'Czech', nameAr: 'التشيكية' },
    { code: 'sk', nameEn: 'Slovak', nameAr: 'السلوفاكية' },
    { code: 'ro', nameEn: 'Romanian', nameAr: 'الرومانية' },
    { code: 'hu', nameEn: 'Hungarian', nameAr: 'المجرية' },
    { code: 'id', nameEn: 'Indonesian', nameAr: 'الإندونيسية' },
    { code: 'ms', nameEn: 'Malaysian', nameAr: 'الماليزية' },
    { code: 'th', nameEn: 'Thai', nameAr: 'التايلاندية' },
    { code: 'vi', nameEn: 'Vietnamese', nameAr: 'الفيتنامية' },
    { code: 'he', nameEn: 'Hebrew', nameAr: 'العبرية' },
    { code: 'tl', nameEn: 'Filipino (Tagalog)', nameAr: 'الفلبينية (التاغالوغ)' },
  ];

  const doTextTranslate = async () => {
    if (!ttText.trim()) return;
    setTtLoading(true);
    setTtResult('');
    try {
      const { data: result, error } = await supabase.functions.invoke('voice-clone-translator', {
        body: { original_text: ttText.trim(), target_language: ttTarget }
      });
      if (error) throw new Error(error.message);
      if (!result || !result.success) throw new Error(result?.error || 'Translation failed');
      setTtResult(result.translated_text || '');
      // update last-two history
      const item = { target: ttTarget, sourceLen: ttText.trim().length, preview: (result.translated_text || '').slice(0, 80), ts: Date.now() };
      const next = [item, ...ttHistory].slice(0,2);
      setTtHistory(next);
      try { localStorage.setItem('wakti-tt-history', JSON.stringify(next)); } catch {}
    } catch (e:any) {
      setTtResult(language === 'ar' ? 'حدث خطأ في الترجمة' : 'Translation error');
      console.error(e);
    } finally {
      setTtLoading(false);
    }
  };

  useEffect(() => {
    // On page mount, mirror popup behavior: check if user already has voices
    checkExistingVoices();
    
    // Deep-link support: read ?tab= query param and open the correct tab
    const tabParam = searchParams.get('tab');
    if (tabParam && TAB_MAP[tabParam.toLowerCase()]) {
      setCurrentScreen(TAB_MAP[tabParam.toLowerCase()]);
    } else {
      setCurrentScreen(0);
    }
  }, [searchParams]);

  const checkExistingVoices = async () => {
    try {
      const { data, error } = await supabase
        .from('user_voice_clones')
        .select('id')
        .limit(1);

      if (error) {
        console.error('Error checking voices:', error);
        return;
      }

      setHasExistingVoices(!!(data && data.length > 0));
    } catch (error) {
      console.error('Error checking voices:', error);
    }
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 0:
        // Welcome screen
        return (
          <div className="w-full">
            <div className="rounded-2xl border border-border/60 bg-white/70 dark:bg-white/5 shadow-xl p-5 md:p-6">
              <div className="mb-2">
                <h2 className="text-xl md:text-2xl font-semibold">
                  {language === 'ar'
                    ? `مرحبًا${user?.user_metadata?.full_name ? `، ${user.user_metadata.full_name}` : ''}!`
                    : `Welcome${user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''}!`}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {language === 'ar'
                    ? 'هنا يمكنك تحويل النص إلى كلام، استنساخ صوتك، أو استخدام المترجم. اختر تبويبًا بالأعلى للبدء.'
                    : 'Here you can turn text into speech, clone your voice, or use the translator. Choose a tab above to get started.'}
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setCurrentScreen(4)}
                  aria-label={language === 'ar' ? 'افتح نص إلى كلام' : 'Open Text To Speech'}
                  className="text-left rounded-xl border border-border/50 bg-white/60 dark:bg-white/5 p-4 hover:bg-white/80 dark:hover:bg-white/10 active:scale-[0.99] transition-colors"
                >
                  <div className="text-sm font-medium mb-1">
                    {language === 'ar' ? 'نص → كلام' : 'Text To Speech'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {language === 'ar'
                      ? 'حوّل النص إلى صوت طبيعي بلغات متعددة. مثالي للرسائل، الملاحظات، والعروض.'
                      : 'Convert text into natural speech in many languages. Great for messages, notes, and presentations.'}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentScreen(2)}
                  aria-label={language === 'ar' ? 'افتح استنساخ الصوت' : 'Open Clone My Voice'}
                  className="text-left rounded-xl border border-border/50 bg-white/60 dark:bg-white/5 p-4 hover:bg-white/80 dark:hover:bg-white/10 active:scale-[0.99] transition-colors"
                >
                  <div className="text-sm font-medium mb-1">
                    {language === 'ar' ? 'استنساخ الصوت' : 'Clone My Voice'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {language === 'ar'
                      ? 'أنشئ نسخة آمنة من صوتك لاستخدامها في القراءة أو الترجمة.'
                      : 'Create a safe clone of your voice to use for reading or translations.'}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentScreen(3)}
                  aria-label={language === 'ar' ? 'افتح المترجم' : 'Open Translator'}
                  className="text-left rounded-xl border border-border/50 bg-white/60 dark:bg-white/5 p-4 hover:bg-white/80 dark:hover:bg-white/10 active:scale-[0.99] transition-colors"
                >
                  <div className="text-sm font-medium mb-1">
                    {language === 'ar' ? 'المترجم' : 'Translator'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {language === 'ar'
                      ? 'ترجم النصوص إلى +60 لغة واستمع إليها بصوت افتراضي أو بصوتك المستنسخ.'
                      : 'Translate text into 60+ languages and listen in a default or your cloned voice.'}
                  </div>
                </button>
              </div>
            </div>
          </div>
        );
      case 1:
        // Single-screen clone flow: render Screen2 directly
        return (
          <VoiceCloneScreen2
            onNext={() => setCurrentScreen(3)}
            onBack={() => setCurrentScreen(2)}
          />
        );
      case 2:
        return (
          <VoiceCloneScreen2
            onNext={() => setCurrentScreen(3)}
            onBack={() => setCurrentScreen(2)}
          />
        );
      case 3:
        return (
          <VoiceCloneScreen3
            onBack={() => setCurrentScreen(2)}
          />
        );
      case 4:
        return (
          <VoiceTTSScreen
            onBack={() => setCurrentScreen(1)}
          />
        );
      case 5:
        return (
          <div className="rounded-2xl border border-border/60 bg-white/70 dark:bg-white/5 shadow-xl p-5 md:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{language === 'ar' ? 'ترجمة نصية' : 'Text Translate'}</h2>
              <div className="text-xs text-muted-foreground">{ttText.length} / {TT_MAX}</div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">{language === 'ar' ? 'اللغة الهدف' : 'Translate to'}</label>
                <select value={ttTarget} onChange={(e)=>setTtTarget(e.target.value)} className="h-11 rounded-md border border-border bg-white/80 dark:bg-white/5 px-3">
                  {LANGS.map(l => (
                    <option key={l.code} value={l.code}>{language === 'ar' ? l.nameAr : l.nameEn}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{language === 'ar' ? 'نص للترجمة' : 'Text to translate'}</label>
              <textarea
                value={ttText}
                onChange={(e)=> setTtText(e.target.value.slice(0, TT_MAX))}
                dir="auto"
                placeholder={language === 'ar' ? 'ألصق النص هنا...' : 'Paste your text here...'}
                className="w-full min-h-32 rounded-md border border-border bg-white/80 dark:bg-white/5 p-3"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={doTextTranslate}
                disabled={!ttText.trim() || ttLoading}
                className="flex-1 h-12 rounded-xl border text-sm font-medium transition-all bg-gradient-to-r from-indigo-400 to-purple-400 text-white shadow-md disabled:opacity-60"
              >
                {ttLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <PenLine className="h-5 w-5 animate-spin" style={{ animationDuration: '800ms' }} />
                    {language === 'ar' ? 'جاري الترجمة النصية...' : 'Text translating...'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <PenLine className="h-5 w-5" />
                    {language === 'ar' ? 'ترجمة نصية' : 'Text Translate'}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={()=> ttResult && navigator.clipboard.writeText(ttResult)}
                disabled={!ttResult}
                className="h-10 px-3 rounded-md border border-border bg-white/80 dark:bg-white/5 text-sm flex items-center gap-1"
              >
                <Copy className="h-4 w-4" /> {language === 'ar' ? 'نسخ' : 'Copy'}
              </button>
            </div>

            {ttResult && (
              <div className="relative">
                <label className="text-sm font-medium mb-1 block">{language === 'ar' ? 'النتيجة' : 'Result'}</label>
                <textarea readOnly value={ttResult} className="w-full min-h-32 rounded-md border border-border bg-white/80 dark:bg-white/5 p-3" />
              </div>
            )}

            {ttHistory.length > 0 && (
              <div className="pt-2">
                <div className="text-xs font-medium text-muted-foreground mb-1">{language === 'ar' ? 'آخر النتائج' : 'Recent results'}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {ttHistory.map((h, idx) => (
                    <div key={idx} className="p-2 border border-border rounded-md bg-white/70 dark:bg-white/5">
                      <div className="text-[11px] text-muted-foreground mb-1">{(language==='ar'?'إلى ':'to ')}{h.target} · {new Date(h.ts).toLocaleTimeString()}</div>
                      <div className="text-xs line-clamp-2">{h.preview}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full">
      <div className="mx-auto max-w-3xl w-[92vw] md:w-[90vw] lg:w-auto pt-6 md:pt-8 pb-10 px-3 md:px-4">
        {/* Page header (icon removed per request) */}
        <div className="text-center mb-2 md:mb-3">
          <h1 className="text-2xl font-semibold">
            {language === 'ar' ? 'الصوت والمترجم' : 'Voice & Translator'}
          </h1>
        </div>

        {/* Top tabs under title */}
        <div className="mb-3">
          <div className="grid grid-cols-4 gap-2 p-1 rounded-2xl border border-border/70 bg-white/60 dark:bg-white/5 shadow-sm" role="tablist" aria-label={language === 'ar' ? 'التبويبات' : 'Tabs'}>
            <button
              type="button"
              onClick={() => setCurrentScreen(4)}
              role="tab"
              aria-selected={currentScreen === 4}
              className={`h-12 rounded-xl border text-sm font-medium transition-all
                ${currentScreen === 4
                  ? 'bg-gradient-secondary text-secondary-foreground shadow-lg border-secondary ring-1 ring-secondary/60'
                  : 'bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white'}
              `}
            >
              {language === 'ar' ? 'نص → كلام' : 'Text To Speech'}
            </button>
            <button
              type="button"
              onClick={() => setCurrentScreen(2)}
              role="tab"
              aria-selected={currentScreen === 1 || currentScreen === 2}
              className={`h-12 rounded-xl border text-sm font-medium transition-all
                ${currentScreen === 1 || currentScreen === 2
                  ? 'bg-gradient-primary text-primary-foreground shadow-lg border-primary ring-1 ring-primary/60'
                  : 'bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white'}
              `}
            >
              {language === 'ar' ? 'استنساخ الصوت' : 'Clone My Voice'}
            </button>
            <button
              type="button"
              onClick={() => setCurrentScreen(3)}
              role="tab"
              aria-selected={currentScreen === 3}
              className={`h-12 rounded-xl border text-sm font-medium transition-all
                ${currentScreen === 3
                  ? 'bg-muted/90 text-foreground shadow-lg border-muted-foreground/20 ring-1 ring-muted-foreground/20'
                  : 'bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white'}
              `}
            >
              {language === 'ar' ? 'المترجم الصوتي' : 'Voice translator'}
            </button>
            <button
              type="button"
              onClick={() => setCurrentScreen(5)}
              role="tab"
              aria-selected={currentScreen === 5}
              className={`h-12 rounded-xl border text-sm font-medium transition-all
                ${currentScreen === 5
                  ? 'bg-white text-foreground shadow-lg border-foreground/20 ring-1 ring-foreground/20'
                  : 'bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white'}
              `}
            >
              {language === 'ar' ? 'مترجم النص' : 'Text translator'}
            </button>
          </div>
        </div>

        {/* Subtitle removed */}

        {/* Page body mirrors the previous dialog content area */}
        <div>{renderScreen()}</div>
      </div>
    </div>
  );
}
