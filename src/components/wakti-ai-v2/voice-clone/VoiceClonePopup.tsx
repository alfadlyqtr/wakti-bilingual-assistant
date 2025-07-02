
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';
import { VoiceCloneScreen1 } from './VoiceCloneScreen1';
import { VoiceCloneScreen2 } from './VoiceCloneScreen2';
import { VoiceCloneScreen3 } from './VoiceCloneScreen3';

interface VoiceClone {
  id: string;
  voice_id: string;
  voice_name: string;
  voice_description: string;
  created_at: string;
}

interface VoiceClonePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VoiceClonePopup({ isOpen, onClose }: VoiceClonePopupProps) {
  const { language } = useTheme();
  const [currentScreen, setCurrentScreen] = useState(1);
  const [voices, setVoices] = useState<VoiceClone[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasRecordings, setHasRecordings] = useState(false);

  const fetchVoices = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-voice-clone', {
        method: 'GET',
      });

      if (error) throw error;

      if (data.success) {
        setVoices(data.voices || []);
        setHasRecordings(data.voices && data.voices.length > 0);
      }
    } catch (error) {
      console.error('Failed to fetch voices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchVoices();
      setCurrentScreen(1);
    }
  }, [isOpen]);

  const handleStartRecording = () => {
    setCurrentScreen(2);
  };

  const handleSkip = () => {
    setCurrentScreen(3);
  };

  const handleNext = () => {
    setCurrentScreen(3);
  };

  const handleBack = () => {
    setCurrentScreen(1);
  };

  const handleRecordingComplete = (hasNewRecordings: boolean) => {
    setHasRecordings(hasNewRecordings);
  };

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 1:
        return (
          <VoiceCloneScreen1
            onStartRecording={handleStartRecording}
            onSkip={handleSkip}
            hasExistingVoices={voices.length > 0}
            hasRecordings={hasRecordings}
          />
        );
      case 2:
        return (
          <VoiceCloneScreen2
            onNext={handleNext}
            onBack={handleBack}
            voices={voices}
            onVoicesUpdate={fetchVoices}
            onRecordingComplete={handleRecordingComplete}
          />
        );
      case 3:
        return <VoiceCloneScreen3 voices={voices} />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-white/30 dark:border-white/20">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl text-slate-700 dark:text-slate-300">
            {language === 'ar' ? 'نسخ الصوت والترجمة' : 'Voice Clone & Translator'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          {renderCurrentScreen()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
