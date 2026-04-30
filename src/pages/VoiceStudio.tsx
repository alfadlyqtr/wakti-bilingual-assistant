import React, { useEffect, useMemo, useRef, useState } from 'react';
import Tasjeel from '@/components/tasjeel/Tasjeel';
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
  'tasjeel': 7,
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
      case 7:
        return <Tasjeel />;
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
            {language === 'ar' ? 'صوت' : 'Voice'}
          </h1>
        </div>
  
        {/* Top tabs under title */}
        <div className="mb-3">
          <div
            role="tablist"
            aria-label={language === 'ar' ? 'التبويبات' : 'Tabs'}
            className="grid grid-cols-5 gap-1.5 rounded-[1.35rem] border border-border/70 bg-[#f8fafc] dark:bg-white/5 p-1.5 shadow-[0_2px_12px_rgba(15,23,42,0.06)]"
          >
            {[
              { screen: 4, labelAr: 'نص/كلام', labelEn: 'TTS', active: currentScreen === 4, style: currentScreen === 4 ? 'border-[#e9ceb0] bg-[#f7e2bb] text-[#060541] shadow-[0_4px_14px_rgba(233,206,176,0.45)] dark:border-white/10 dark:bg-white/12 dark:text-white' : '' },
              { screen: 2, labelAr: 'استنساخ', labelEn: 'Clone', active: currentScreen === 1 || currentScreen === 2, style: currentScreen === 1 || currentScreen === 2 ? 'border-[#d8ccff] bg-[#ebe3ff] text-[#060541] shadow-[0_4px_14px_rgba(168,85,247,0.22)] dark:border-white/10 dark:bg-white/12 dark:text-white' : '' },
              { screen: 3, labelAr: 'ترجمة', labelEn: 'Translate', active: currentScreen === 3, style: currentScreen === 3 ? 'border-[#d9d7ef] bg-[#eceaf7] text-[#060541] shadow-[0_4px_14px_rgba(99,102,241,0.14)] dark:border-white/10 dark:bg-white/12 dark:text-white' : '' },
              { screen: 6, labelAr: 'مترجم', labelEn: 'Live', active: currentScreen === 6, style: currentScreen === 6 ? 'border-[#b9ecff] bg-[#d8f5ff] text-[#060541] shadow-[0_4px_14px_rgba(34,211,238,0.22)] dark:border-white/10 dark:bg-white/12 dark:text-white' : '' },
              { screen: 7, labelAr: 'تسجيل', labelEn: 'Tasjeel', active: currentScreen === 7, style: currentScreen === 7 ? 'border-[#d9c7ff] bg-[#eee6ff] text-[#060541] shadow-[0_4px_14px_rgba(168,85,247,0.24)] dark:border-white/10 dark:bg-white/12 dark:text-white' : '' },
            ].map(({ screen, labelAr, labelEn, active, style }) => (
              <button
                key={screen}
                type="button"
                onClick={() => setCurrentScreen(screen)}
                role="tab"
                aria-selected={active}
                className={`h-10 rounded-xl border text-xs font-semibold transition-all duration-200
                  ${active ? style : 'border-border/70 bg-white text-[#060541] shadow-[0_1px_4px_rgba(15,23,42,0.08)] hover:border-border hover:bg-white/95 dark:border-white/10 dark:bg-white/6 dark:text-white'}
                `}
              >
                {language === 'ar' ? labelAr : labelEn}
              </button>
            ))}
          </div>
        </div>

        {/* Subtitle removed */}

        {/* Page body mirrors the previous dialog content area */}
        <div>{renderScreen()}</div>
      </div>
    </div>
  );
}
