
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Mic2, FileAudio, AlertCircle } from 'lucide-react';

interface VoiceCloneScreen1Props {
  onNext: () => void;
  onSkip: () => void;
  hasExistingVoices: boolean;
}

export function VoiceCloneScreen1({ onNext, onSkip, hasExistingVoices }: VoiceCloneScreen1Props) {
  const { language } = useTheme();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full flex items-center justify-center mb-4">
          <Mic2 className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-xl font-semibold mb-2">
          {language === 'ar' ? 'إنشاء نسخة من صوتك' : 'Create Your Voice Clone'}
        </h2>
      </div>

      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">
            1
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Mic2 className="h-4 w-4 text-blue-500" />
              <span className="font-medium">
                {language === 'ar' ? 'سجل أو ارفع عينة صوتية' : 'Record or upload a voice sample'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' 
                ? 'الحد الأدنى 30 ثانية، يُفضل في غرفة هادئة' 
                : 'Minimum 30 seconds, quiet room recommended'
              }
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">
            2
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileAudio className="h-4 w-4 text-blue-500" />
              <span className="font-medium">
                {language === 'ar' ? 'اختر اسماً لصوتك' : 'Give your voice a name'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' 
                ? 'مثال: "صوتي الهادئ بالعربية"' 
                : 'e.g. "My Calm Arabic Voice"'
              }
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">
            3
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span className="font-medium">
                {language === 'ar' ? 'حدود الاستخدام' : 'Usage Limits'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' 
                ? 'يمكنك إنشاء حتى 3 أصوات - بمجرد الحفظ، يمكن حذفها لإنشاء أصوات جديدة. لديك 3000 حرف شهرياً، يمكن شراء المزيد.' 
                : 'You can create up to 3 voices total — once saved, they can be deleted to clone more voices. You get 3,000 characters monthly, if all used up you can always buy more.'
              }
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button 
          onClick={onNext}
          className="flex-1"
        >
          {language === 'ar' ? 'ابدأ' : 'Get Started'}
        </Button>
        
        {hasExistingVoices && (
          <Button 
            onClick={onSkip}
            variant="outline"
            className="flex-1"
          >
            {language === 'ar' ? 'تخطي' : 'Skip'}
          </Button>
        )}
      </div>
    </div>
  );
}
