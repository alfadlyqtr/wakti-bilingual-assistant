
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, Clock, Volume2, ShieldCheck } from 'lucide-react';

interface VoiceCloneScreen1Props {
  onStartRecording: () => void;
  onSkip: () => void;
  hasExistingVoices: boolean;
  hasRecordings?: boolean;
}

export function VoiceCloneScreen1({ onStartRecording, onSkip, hasExistingVoices, hasRecordings = false }: VoiceCloneScreen1Props) {
  const { language } = useTheme();

  const instructions = [
    {
      icon: <Mic className="h-5 w-5" />,
      title: language === 'ar' ? 'مكان هادئ' : 'Quiet Place',
      description: language === 'ar' ? 'سجل في مكان هادئ بدون ضوضاء في الخلفية' : 'Record in a quiet place without background noise',
    },
    {
      icon: <Clock className="h-5 w-5" />,
      title: language === 'ar' ? '30-60 ثانية' : '30-60 Seconds',
      description: language === 'ar' ? 'المدة المثلى للحصول على أفضل جودة نسخ' : 'Optimal duration for best cloning quality',
    },
    {
      icon: <Volume2 className="h-5 w-5" />,
      title: language === 'ar' ? 'تحدث بوضوح' : 'Speak Clearly',
      description: language === 'ar' ? 'تحدث بصوت طبيعي وواضح بسرعة عادية' : 'Speak naturally and clearly at normal pace',
    },
    {
      icon: <ShieldCheck className="h-5 w-5" />,
      title: language === 'ar' ? 'صوت متسق' : 'Consistent Voice',
      description: language === 'ar' ? 'حافظ على نبرة ومستوى صوت ثابت طوال التسجيل' : 'Maintain consistent tone and volume throughout',
    },
  ];

  const getButtonText = () => {
    if (hasRecordings) {
      return language === 'ar' ? 'عرض التسجيلات' : 'Show Recordings';
    }
    return language === 'ar' ? 'ابدأ الآن' : 'Start Now';
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        <Card className="bg-white/20 dark:bg-black/20 border-white/30 dark:border-white/20 backdrop-blur-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-slate-700 dark:text-slate-300">
              {language === 'ar' ? 'إنشاء نسخة من صوتك' : 'Create Your Voice Clone'}
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              {language === 'ar' 
                ? 'اتبع هذه التعليمات للحصول على أفضل جودة نسخ للصوت'
                : 'Follow these instructions for the best voice cloning quality'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-accent-blue/10 border border-accent-blue/20 rounded-lg p-4 text-center">
              <p className="text-sm font-medium text-accent-blue dark:text-accent-blue">
                {language === 'ar' 
                  ? 'سجل في مكان هادئ، الحد الأدنى 30 ثانية، الحد الأقصى دقيقة واحدة'
                  : 'Record in a quiet place, minimum 30 seconds, maximum 1 minute'
                }
              </p>
            </div>

            <div className="grid gap-4">
              {instructions.map((instruction, index) => (
                <div key={index} className="flex items-center space-x-3 rtl:space-x-reverse">
                  <div className="p-2 rounded-lg bg-accent-blue text-white flex-shrink-0">
                    {instruction.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-slate-700 dark:text-slate-300">
                      {instruction.title}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-normal break-words leading-tight">
                      {instruction.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex space-x-3 rtl:space-x-reverse pt-4">
              <Button 
                onClick={onStartRecording}
                className="flex-1 bg-accent-blue hover:bg-accent-blue/80 text-white"
              >
                {getButtonText()}
              </Button>
              
              {hasExistingVoices && (
                <Button 
                  onClick={onSkip}
                  variant="outline"
                  className="flex-1 border-white/30 dark:border-white/20 text-slate-700 dark:text-slate-300 hover:bg-white/10"
                >
                  {language === 'ar' ? 'تخطي' : 'Skip'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
