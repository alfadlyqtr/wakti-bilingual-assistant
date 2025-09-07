import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VoiceCloneScreen1 } from './VoiceCloneScreen1';
import { VoiceCloneScreen2 } from './VoiceCloneScreen2';
import { VoiceCloneScreen3 } from './VoiceCloneScreen3';
import { VoiceTTSScreen } from './VoiceTTSScreen';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/providers/ThemeProvider';

interface VoiceClonePopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VoiceClonePopup({ open, onOpenChange }: VoiceClonePopupProps) {
  const { language } = useTheme();
  const [currentScreen, setCurrentScreen] = useState(1);
  const [hasExistingVoices, setHasExistingVoices] = useState(false);

  useEffect(() => {
    if (open) {
      checkExistingVoices();
      setCurrentScreen(1);
    }
  }, [open]);

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

      setHasExistingVoices(data && data.length > 0);
    } catch (error) {
      console.error('Error checking voices:', error);
    }
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 1:
        return (
          <VoiceCloneScreen1
            onNext={() => setCurrentScreen(2)}
            onSkip={() => setCurrentScreen(3)}
            hasExistingVoices={hasExistingVoices}
            onOpenTTS={() => setCurrentScreen(4)}
          />
        );
      case 2:
        return (
          <VoiceCloneScreen2
            onNext={() => setCurrentScreen(3)}
            onBack={() => setCurrentScreen(1)}
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-[90vw] md:max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl" hideCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="sr-only">Voice Clone</DialogTitle>
          <DialogDescription className="sr-only">
            {language === 'ar' 
              ? 'اتبع الخطوات لإعداد واختبار استنساخ الصوت.' 
              : 'Follow the steps to set up and test voice cloning.'}
          </DialogDescription>
        </DialogHeader>
        {renderScreen()}
      </DialogContent>
    </Dialog>
  );
}
