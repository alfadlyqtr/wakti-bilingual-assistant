import React, { useEffect, useState } from 'react';
import { VoiceCloneScreen1 } from '@/components/wakti-ai-v2/VoiceCloneScreen1';
import { VoiceCloneScreen2 } from '@/components/wakti-ai-v2/VoiceCloneScreen2';
import { VoiceCloneScreen3 } from '@/components/wakti-ai-v2/VoiceCloneScreen3';
import { VoiceTTSScreen } from '@/components/wakti-ai-v2/VoiceTTSScreen';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/providers/ThemeProvider';

export default function VoiceStudio() {
  const { language } = useTheme();
  const [currentScreen, setCurrentScreen] = useState(1);
  const [hasExistingVoices, setHasExistingVoices] = useState(false);

  useEffect(() => {
    // On page mount, mirror popup behavior: check if user already has voices
    checkExistingVoices();
    setCurrentScreen(1);
  }, []);

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
            {language === 'ar' ? 'استوديو الصوت' : 'Voice Studio'}
          </h1>
        </div>

        {/* Top tabs under title */}
        <div className="mb-3">
          <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl border border-border/70 bg-white/60 dark:bg-white/5 shadow-sm" role="tablist" aria-label={language === 'ar' ? 'التبويبات' : 'Tabs'}>
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
              {language === 'ar' ? 'الصوت الافتراضي والمترجم' : 'Default Voice & Translator'}
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
