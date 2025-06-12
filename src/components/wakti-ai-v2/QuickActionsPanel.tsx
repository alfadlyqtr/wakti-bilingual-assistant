
import React from 'react';
import { Button } from '@/components/ui/button';
import { X, Languages, PenTool, Sparkles, Mic } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';

interface QuickActionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onVoiceTranslator: () => void;
  onTextGenerator: () => void;
  onImproveAI: () => void;
  onVoiceClone: () => void;
}

export function QuickActionsPanel({
  isOpen,
  onClose,
  onVoiceTranslator,
  onTextGenerator,
  onImproveAI,
  onVoiceClone
}: QuickActionsPanelProps) {
  const { language } = useTheme();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
      <div className="bg-background w-80 h-full shadow-xl overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {language === 'ar' ? 'الأدوات' : 'Tools'}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Translator */}
            <Button
              onClick={onVoiceTranslator}
              className="h-20 flex flex-col items-center justify-center gap-2 bg-pink-500 hover:bg-pink-600 text-white border-0"
            >
              <Languages className="h-6 w-6" />
              <span className="text-xs font-medium">
                {language === 'ar' ? 'مترجم' : 'Translator'}
              </span>
            </Button>

            {/* Text Generate */}
            <Button
              onClick={onTextGenerator}
              className="h-20 flex flex-col items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white border-0"
            >
              <PenTool className="h-6 w-6" />
              <span className="text-xs font-medium">
                {language === 'ar' ? 'كتابة نص' : 'Text Generate'}
              </span>
            </Button>

            {/* Improve AI */}
            <Button
              onClick={onImproveAI}
              className="h-20 flex flex-col items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600 text-white border-0"
            >
              <Sparkles className="h-6 w-6" />
              <span className="text-xs font-medium">
                {language === 'ar' ? 'تحسين الذكاء' : 'Improve AI'}
              </span>
            </Button>

            {/* Voice Clone */}
            <Button
              onClick={onVoiceClone}
              className="h-20 flex flex-col items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white border-0"
            >
              <Mic className="h-6 w-6" />
              <span className="text-xs font-medium">
                {language === 'ar' ? 'استنساخ الصوت' : 'Voice Clone'}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
