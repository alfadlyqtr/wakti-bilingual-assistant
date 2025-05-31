import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  MessageSquare, 
  Search, 
  Layers3, 
  Image as ImageIcon,
  PenTool,
  Mic,
  Globe,
  Languages,
  Volume2,
  BookOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { VoiceClonePopup } from './VoiceClonePopup';
import { VoiceTranslatorPopup } from './VoiceTranslatorPopup';
import { BuyExtrasPopup } from './BuyExtrasPopup';

type TriggerMode = 'chat' | 'search' | 'advanced_search' | 'image';

interface QuickActionsPanelProps {
  onSendMessage: (message: string) => void;
  activeTrigger: TriggerMode;
  onTriggerChange: (trigger: TriggerMode) => void;
  onTextGenerated: (text: string, mode: 'compose' | 'reply') => void;
  onOpenTextGenerator: () => void;
}

export function QuickActionsPanel({ 
  onSendMessage, 
  activeTrigger, 
  onTriggerChange, 
  onTextGenerated,
  onOpenTextGenerator
}: QuickActionsPanelProps) {
  const { language } = useTheme();
  const [voiceCloneOpen, setVoiceCloneOpen] = React.useState(false);
  const [voiceTranslatorOpen, setVoiceTranslatorOpen] = React.useState(false);
  const [buyExtrasOpen, setBuyExtrasOpen] = React.useState(false);

  const triggerModes = [
    {
      mode: 'chat' as TriggerMode,
      label: language === 'ar' ? 'محادثة' : 'Chat',
      icon: MessageSquare
    },
    {
      mode: 'search' as TriggerMode,
      label: language === 'ar' ? 'بحث' : 'Search',
      icon: Search
    },
    {
      mode: 'advanced_search' as TriggerMode,
      label: language === 'ar' ? 'بحث متقدم' : 'Advanced Search',
      icon: Layers3
    },
    {
      mode: 'image' as TriggerMode,
      label: language === 'ar' ? 'صورة' : 'Image',
      icon: ImageIcon
    }
  ];

  const quickTemplates = [
    {
      message: language === 'ar' ? 'ما هي حالة الطقس اليوم؟' : 'What is the weather today?',
      description: language === 'ar' ? 'احصل على معلومات الطقس' : 'Get weather information'
    },
    {
      message: language === 'ar' ? 'أرسل لي صورة قطة' : 'Send me a picture of a cat',
      description: language === 'ar' ? 'احصل على صور عشوائية' : 'Get random images'
    },
    {
      message: language === 'ar' ? 'ما هي آخر الأخبار؟' : 'What is the latest news?',
      description: language === 'ar' ? 'ابق على اطلاع دائم' : 'Stay up-to-date'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Trigger Modes */}
      <div className="space-y-3">
        <h4 className="font-medium text-sm text-muted-foreground">
          {language === 'ar' ? 'أوضاع التشغيل' : 'Trigger Modes'}
        </h4>
        <div className="flex flex-wrap gap-2">
          {triggerModes.map((mode) => (
            <Badge
              key={mode.mode}
              variant={activeTrigger === mode.mode ? 'default' : 'secondary'}
              onClick={() => onTriggerChange(mode.mode)}
              className="cursor-pointer"
            >
              <mode.icon className="h-3 w-3 mr-2" />
              {mode.label}
            </Badge>
          ))}
        </div>
      </div>

      <Separator />

      {/* Quick Templates */}
      <div className="space-y-3">
        <h4 className="font-medium text-sm text-muted-foreground">
          {language === 'ar' ? 'قوالب سريعة' : 'Quick Templates'}
        </h4>
        <div className="grid gap-2">
          {quickTemplates.map((template, index) => (
            <Button
              key={index}
              variant="outline"
              className="w-full justify-start gap-2 h-auto p-3"
              onClick={() => onSendMessage(template.message)}
            >
              <MessageSquare className="h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">{template.message}</div>
                <div className="text-xs text-muted-foreground">
                  {template.description}
                </div>
              </div>
            </Button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Text Generation Section */}
      <div className="space-y-3">
        <h4 className="font-medium text-sm text-muted-foreground">
          {language === 'ar' ? 'إنشاء النصوص' : 'Text Generation'}
        </h4>
        <Button 
          onClick={onOpenTextGenerator}
          variant="outline" 
          className="w-full justify-start gap-2 h-auto p-3"
        >
          <PenTool className="h-4 w-4" />
          <div className="text-left">
            <div className="font-medium">
              {language === 'ar' ? 'مولد النصوص' : 'Text Generator'}
            </div>
            <div className="text-xs text-muted-foreground">
              {language === 'ar' ? 'إنشاء رسائل ومحتوى' : 'Create messages & content'}
            </div>
          </div>
        </Button>
      </div>

      <Separator />

      {/* Voice Tools */}
      <div className="space-y-3">
        <h4 className="font-medium text-sm text-muted-foreground">
          {language === 'ar' ? 'أدوات الصوت' : 'Voice Tools'}
        </h4>
        <Button variant="outline" className="w-full justify-start gap-2 h-auto p-3" onClick={() => setVoiceCloneOpen(true)}>
          <Mic className="h-4 w-4" />
          <div className="text-left">
            <div className="font-medium">
              {language === 'ar' ? 'استنساخ الصوت' : 'Voice Clone'}
            </div>
            <div className="text-xs text-muted-foreground">
              {language === 'ar' ? 'إنشاء نسخة من صوتك' : 'Create a clone of your voice'}
            </div>
          </div>
        </Button>
        <Button variant="outline" className="w-full justify-start gap-2 h-auto p-3" onClick={() => setVoiceTranslatorOpen(true)}>
          <Languages className="h-4 w-4" />
          <div className="text-left">
            <div className="font-medium">
              {language === 'ar' ? 'ترجمة الصوت' : 'Voice Translator'}
            </div>
            <div className="text-xs text-muted-foreground">
              {language === 'ar' ? 'ترجمة صوتك إلى لغات أخرى' : 'Translate your voice to other languages'}
            </div>
          </div>
        </Button>
      </div>

      <Separator />

      {/* Knowledge Base */}
      <div className="space-y-3">
        <h4 className="font-medium text-sm text-muted-foreground">
          {language === 'ar' ? 'قاعدة المعرفة' : 'Knowledge Base'}
        </h4>
        <Button variant="outline" className="w-full justify-start gap-2 h-auto p-3">
          <BookOpen className="h-4 w-4" />
          <div className="text-left">
            <div className="font-medium">
              {language === 'ar' ? 'الوصول إلى قاعدة المعرفة' : 'Access Knowledge Base'}
            </div>
            <div className="text-xs text-muted-foreground">
              {language === 'ar' ? 'ابحث عن معلومات وموارد مفيدة' : 'Find helpful information and resources'}
            </div>
          </div>
        </Button>
      </div>

      <Separator />

      {/* Buy Extras */}
      <div className="space-y-3">
        <h4 className="font-medium text-sm text-muted-foreground">
          {language === 'ar' ? 'شراء إضافات' : 'Buy Extras'}
        </h4>
        <Button variant="outline" className="w-full justify-start gap-2 h-auto p-3" onClick={() => setBuyExtrasOpen(true)}>
          <Globe className="h-4 w-4" />
          <div className="text-left">
            <div className="font-medium">
              {language === 'ar' ? 'احصل على المزيد من الميزات' : 'Get More Features'}
            </div>
            <div className="text-xs text-muted-foreground">
              {language === 'ar' ? 'قم بترقية تجربتك' : 'Upgrade your experience'}
            </div>
          </div>
        </Button>
      </div>

      {/* Voice Clone Popup */}
      <VoiceClonePopup 
        open={voiceCloneOpen} 
        onOpenChange={setVoiceCloneOpen} 
      />

      {/* Voice Translator Popup */}
      <VoiceTranslatorPopup 
        open={voiceTranslatorOpen} 
        onOpenChange={setVoiceTranslatorOpen} 
      />

      {/* Buy Extras Popup */}
      <BuyExtrasPopup 
        open={buyExtrasOpen} 
        onOpenChange={setBuyExtrasOpen} 
      />
    </div>
  );
}
