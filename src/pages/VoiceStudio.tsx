import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { PenLine, Loader2, Copy } from 'lucide-react';
import { VoiceCloneScreen1 } from '@/components/wakti-ai-v2/VoiceCloneScreen1';
import { VoiceCloneScreen2 } from '@/components/wakti-ai-v2/VoiceCloneScreen2';
import { VoiceCloneScreen3 } from '@/components/wakti-ai-v2/VoiceCloneScreen3';
import { VoiceTTSScreen } from '@/components/wakti-ai-v2/VoiceTTSScreen';
import { LiveTranslator } from '@/components/wakti-ai-v2/LiveTranslator';
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
  'live-translator': 6,
};

export default function VoiceStudio() {
  const { language } = useTheme();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [currentScreen, setCurrentScreen] = useState(0); // 0 = Welcome
  const [hasExistingVoices, setHasExistingVoices] = useState(false);

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
        return <Navigate to="/tools/text?tab=translate" replace />;
      case 6:
        return (
          <LiveTranslator
            onBack={() => setCurrentScreen(0)}
          />
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
          <div className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl border border-border/70 bg-white/60 dark:bg-white/5 shadow-sm" role="tablist" aria-label={language === 'ar' ? 'التبويبات' : 'Tabs'}>
            <button
              type="button"
              onClick={() => setCurrentScreen(4)}
              role="tab"
              aria-selected={currentScreen === 4}
              className={`h-11 rounded-xl border text-xs font-medium transition-all
                ${currentScreen === 4
                  ? 'bg-gradient-secondary text-secondary-foreground shadow-lg border-secondary ring-1 ring-secondary/60'
                  : 'bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white'}
              `}
            >
              {language === 'ar' ? 'نص → كلام' : 'TTS'}
            </button>
            <button
              type="button"
              onClick={() => setCurrentScreen(2)}
              role="tab"
              aria-selected={currentScreen === 1 || currentScreen === 2}
              className={`h-11 rounded-xl border text-xs font-medium transition-all
                ${currentScreen === 1 || currentScreen === 2
                  ? 'bg-gradient-primary text-primary-foreground shadow-lg border-primary ring-1 ring-primary/60'
                  : 'bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white'}
              `}
            >
              {language === 'ar' ? 'استنساخ' : 'Clone'}
            </button>
            <button
              type="button"
              onClick={() => setCurrentScreen(3)}
              role="tab"
              aria-selected={currentScreen === 3}
              className={`h-11 rounded-xl border text-xs font-medium transition-all
                ${currentScreen === 3
                  ? 'bg-muted/90 text-foreground shadow-lg border-muted-foreground/20 ring-1 ring-muted-foreground/20'
                  : 'bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white'}
              `}
            >
              {language === 'ar' ? 'ترجمة' : 'Translate'}
            </button>
            <button
              type="button"
              onClick={() => setCurrentScreen(6)}
              role="tab"
              aria-selected={currentScreen === 6}
              className={`h-11 rounded-xl border text-xs font-medium transition-all
                ${currentScreen === 6
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg border-cyan-500 ring-1 ring-cyan-500/60'
                  : 'bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white'}
              `}
            >
              {language === 'ar' ? 'مترجم فوري 🎙️' : 'Interpreter 🎙️'}
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
