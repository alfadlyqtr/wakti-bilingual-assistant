
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Mic2, FileAudio, Languages, Sparkles } from 'lucide-react';

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
          {language === 'ar' ? 'استوديو الصوت' : 'Voice Studio'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {language === 'ar' 
            ? 'استنسخ صوتك، ترجم واتكلم بلغات مختلفة'
            : 'Clone your voice, translate and speak in different languages'
          }
        </p>
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
                ? 'الحد الأدنى دقيقة واحدة، يُفضل في غرفة هادئة' 
                : 'Minimum 1 minute, quiet room recommended'
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
              <Languages className="h-4 w-4 text-green-500" />
              <span className="font-medium">
                {language === 'ar' ? 'ترجم واتكلم' : 'Translate & Speak'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' 
                ? 'ترجم النصوص إلى 50 لغة مختلفة واسمعها بصوتك المستنسخ أو الافتراضي' 
                : 'Translate text to 50 different languages and hear it in your cloned or default voice'
              }
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center flex-shrink-0 mt-0.5">
            4
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span className="font-medium">
                {language === 'ar' ? 'أساليب متنوعة' : 'Multiple Styles'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' 
                ? 'اختر من أساليب مختلفة: عادي، إخباري، سردي، شعري، تعليمي، رياضي' 
                : 'Choose from different styles: Neutral, News, Storytelling, Poetry, Teaching, Sports'
              }
            </p>
          </div>
        </div>
      </div>

      <div className="p-3 bg-muted/50 rounded-lg">
        <p className="text-xs text-muted-foreground">
          {language === 'ar' 
            ? 'يمكنك إنشاء حتى 3 أصوات مختلفة. لديك حروف محدودة شهرياً للاستخدام.' 
            : 'You can create up to 3 different voices. You have limited monthly characters for usage.'
          }
        </p>
      </div>

      <div className="flex gap-3 pt-4">
        <Button 
          onClick={onNext}
          className="flex-[2]"
        >
          {language === 'ar' ? 'ابدأ / استنسخ الأصوات' : 'Get Started / Clone Voices'}
        </Button>
        
        {hasExistingVoices && (
          <Button 
            onClick={onSkip}
            variant="outline"
            className="flex-1"
          >
            {language === 'ar' ? 'المترجم' : 'Translator'}
          </Button>
        )}
      </div>
    </div>
  );
}
