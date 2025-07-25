
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Volume2, VolumeX } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { waktiSounds } from '@/services/waktiSounds';

interface SoundEnablerProps {
  className?: string;
  showAlways?: boolean;
}

export function SoundEnabler({ className = "", showAlways = false }: SoundEnablerProps) {
  const { language } = useTheme();
  const [soundsEnabled, setSoundsEnabled] = useState(waktiSounds.getSettings().enabled);

  useEffect(() => {
    setSoundsEnabled(waktiSounds.getSettings().enabled);
  }, []);

  const handleEnableSounds = () => {
    waktiSounds.updateSettings({ enabled: true });
    setSoundsEnabled(true);
    // Test the sound to confirm it works
    waktiSounds.testSound('chime');
  };

  // Don't show if sounds are already enabled, unless showAlways is true
  if (!showAlways && soundsEnabled) {
    return null;
  }

  return (
    <Alert className={className}>
      <Volume2 className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>
          {language === 'ar' 
            ? 'تفعيل الأصوات للحصول على إشعارات صوتية'
            : 'Enable sounds to receive audio notifications'}
        </span>
        <Button 
          onClick={handleEnableSounds} 
          size="sm" 
          variant="outline"
          className="ml-2"
        >
          <Volume2 className="h-4 w-4 mr-1" />
          {language === 'ar' ? 'تفعيل' : 'Enable'}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
