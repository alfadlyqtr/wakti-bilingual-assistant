import React from 'react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';
import { ArrowLeft } from 'lucide-react';
import VoiceTTS from '@/pages/VoiceTTS';

interface VoiceTTSScreenProps {
  onBack: () => void;
}

export const VoiceTTSScreen: React.FC<VoiceTTSScreenProps> = ({ onBack }) => {
  const { language } = useTheme();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 px-2">
          <ArrowLeft className="h-4 w-4 mr-1" />
          {language === 'ar' ? 'رجوع' : 'Back'}
        </Button>
        <div className="text-sm font-semibold opacity-80">
          {language === 'ar' ? 'تحويل النص إلى كلام' : 'Text To Speech'}
        </div>
      </div>

      {/* Reuse the page component UI inside the popup */}
      <div className="mt-1">
        <VoiceTTS />
      </div>
    </div>
  );
};
