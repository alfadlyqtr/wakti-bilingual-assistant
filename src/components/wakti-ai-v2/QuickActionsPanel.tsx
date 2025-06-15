
import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, Search, Image, PenTool, Mic, Volume2, 
  Zap
} from 'lucide-react';
import { TextGeneratorPopup } from './TextGeneratorPopup';
import { VoiceTranslatorPopup } from './VoiceTranslatorPopup';
import { VoiceClonePopup } from './VoiceClonePopup';
import { BuyExtrasPopup } from './BuyExtrasPopup';

interface QuickActionsProps {
  onSendMessage: (message: string, inputType?: 'text' | 'voice') => void;
  activeTrigger: string;
  onTriggerChange: (trigger: string) => void;
  onTextGenerated: (text: string, mode: 'compose' | 'reply', isTextGenerated?: boolean) => void;
}

export function QuickActionsPanel({ 
  onSendMessage, 
  activeTrigger, 
  onTriggerChange,
  onTextGenerated 
}: QuickActionsProps) {
  const { language } = useTheme();
  const [showTextGen, setShowTextGen] = useState(false);
  const [showVoiceTranslator, setShowVoiceTranslator] = useState(false);
  const [showVoiceClone, setShowVoiceClone] = useState(false);
  const [showBuyExtras, setShowBuyExtras] = useState(false);

  const triggerModes = [
    {
      id: 'chat',
      label: language === 'ar' ? 'محادثة' : 'Chat',
      icon: <MessageSquare className="h-4 w-4" />,
      color: 'bg-blue-500',
      description: language === 'ar' ? 'محادثة عادية مع الذكاء الاصطناعي' : 'Normal chat with AI'
    },
    {
      id: 'search',
      label: language === 'ar' ? 'بحث' : 'Search',
      icon: <Search className="h-4 w-4" />,
      color: 'bg-green-500',
      description: language === 'ar' ? 'بحث في الإنترنت' : 'Search the internet'
    },
    {
      id: 'image',
      label: language === 'ar' ? 'صورة' : 'Image',
      icon: <Image className="h-4 w-4" />,
      color: 'bg-orange-500',
      description: language === 'ar' ? 'إنشاء الصور' : 'Generate images'
    }
  ];

  const quickActions = [
    {
      icon: <PenTool className="h-5 w-5" />,
      label: language === 'ar' ? 'مولد النصوص' : 'Text Generator',
      description: language === 'ar' ? 'إنشاء النصوص والردود الذكية' : 'Generate texts and smart replies',
      action: () => setShowTextGen(true),
      color: 'bg-purple-500'
    },
    {
      icon: <Volume2 className="h-5 w-5" />,
      label: language === 'ar' ? 'مترجم صوتي' : 'Voice Translator',
      description: language === 'ar' ? 'ترجمة فورية بالصوت' : 'Real-time voice translation',
      action: () => setShowVoiceTranslator(true),
      color: 'bg-indigo-500'
    },
    {
      icon: <Mic className="h-5 w-5" />,
      label: language === 'ar' ? 'استنساخ الصوت' : 'Voice Clone',
      description: language === 'ar' ? 'إنشاء نسخة من صوتك' : 'Create a copy of your voice',
      action: () => setShowVoiceClone(true),
      color: 'bg-pink-500'
    },
    {
      icon: <Zap className="h-5 w-5" />,
      label: language === 'ar' ? 'شراء إضافات' : 'Buy Extras',
      description: language === 'ar' ? 'المزيد من الميزات المتقدمة' : 'More advanced features',
      action: () => setShowBuyExtras(true),
      color: 'bg-yellow-500'
    }
  ];

  const handleTriggerSelect = (triggerId: string) => {
    onTriggerChange(triggerId);
    console.log('✨ Quick Actions: Trigger changed to:', triggerId);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-bold">
            {language === 'ar' ? 'الإجراءات السريعة' : 'Quick Actions'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {language === 'ar' ? 'أدوات ذكية لتحسين تجربتك' : 'Smart tools to enhance your experience'}
          </p>
        </div>

        {/* AI Modes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              {language === 'ar' ? 'أنماط الذكاء الاصطناعي' : 'AI Modes'}
            </CardTitle>
            <CardDescription className="text-xs">
              {language === 'ar' ? 'اختر النمط المناسب لمهمتك' : 'Choose the right mode for your task'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {triggerModes.map((mode) => (
              <Button
                key={mode.id}
                onClick={() => handleTriggerSelect(mode.id)}
                variant={activeTrigger === mode.id ? 'default' : 'ghost'}
                className="w-full justify-start h-auto p-3"
              >
                <div className={`p-2 rounded-lg ${mode.color} text-white mr-3`}>
                  {mode.icon}
                </div>
                <div className="text-left">
                  <div className="font-medium text-sm">{mode.label}</div>
                  <div className="text-xs text-muted-foreground">{mode.description}</div>
                </div>
                {activeTrigger === mode.id && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {language === 'ar' ? 'نشط' : 'Active'}
                  </Badge>
                )}
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* Quick Tools */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">
            {language === 'ar' ? 'الأدوات السريعة' : 'Quick Tools'}
          </h3>
          <div className="grid gap-3">
            {quickActions.map((action, index) => (
              <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-4" onClick={action.action}>
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${action.color} text-white`}>
                      {action.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-sm">{action.label}</h3>
                      <p className="text-xs text-muted-foreground">{action.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Text Generator Popup */}
        <TextGeneratorPopup
          open={showTextGen}
          onOpenChange={setShowTextGen}
          onGenerated={onTextGenerated}
        />

        {/* Voice Translator Popup */}
        <VoiceTranslatorPopup
          open={showVoiceTranslator}
          onOpenChange={setShowVoiceTranslator}
          onTranslated={(translatedText) => {
            onSendMessage(translatedText, 'voice');
            console.log('🔄 Voice translation completed:', translatedText);
          }}
        />

        {/* Voice Clone Popup */}
        <VoiceClonePopup
          open={showVoiceClone}
          onOpenChange={setShowVoiceClone}
        />

        {/* Buy Extras Popup */}
        <BuyExtrasPopup
          open={showBuyExtras}
          onOpenChange={setShowBuyExtras}
        />
      </div>
    </div>
  );
}
