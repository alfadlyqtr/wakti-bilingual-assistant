
import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Search, Image, PenTool, Mic, Gamepad2, Video } from 'lucide-react';
import TextGeneratorPopup from './TextGeneratorPopup';
import { VoiceClonePopup } from './VoiceClonePopup';
import { GameModeModal } from './GameModeModal';
import { IsolatedVideoDialog } from './IsolatedVideoDialog';

interface QuickActionsProps {
  onSendMessage: (message: string, inputType?: 'text' | 'voice') => void;
  activeTrigger: string;
  onTriggerChange: (trigger: string) => void;
  onTextGenerated: (text: string, mode: 'compose' | 'reply', isTextGenerated?: boolean) => void;
  onClose?: () => void;
}

export function QuickActionsPanel({
  onSendMessage,
  activeTrigger,
  onTriggerChange,
  onTextGenerated,
  onClose
}: QuickActionsProps) {
  const { language } = useTheme();
  const [showTextGen, setShowTextGen] = useState(false);
  const [showVoiceClone, setShowVoiceClone] = useState(false);
  const [showGameMode, setShowGameMode] = useState(false);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  
  // REMOVED VIDEO MODE - Only chat, search, and image modes
  const triggerModes = [{
    id: 'chat',
    label: language === 'ar' ? 'محادثة عادية' : 'Regular Chat',
    icon: <MessageSquare className="h-4 w-4" />,
    activeColor: 'bg-blue-500',
    hoverColor: 'hover:bg-blue-500/20',
    borderColor: 'border-blue-500',
    description: language === 'ar' ? 'محادثة عادية مع الذكاء الاصطناعي' : 'Normal chat with AI'
  }, {
    id: 'search',
    label: language === 'ar' ? 'بحث' : 'Search',
    icon: <Search className="h-4 w-4" />,
    activeColor: 'bg-green-500',
    hoverColor: 'hover:bg-green-500/20',
    borderColor: 'border-green-500',
    description: language === 'ar' ? 'بحث في الإنترنت' : 'Search the internet'
  }, {
    id: 'image',
    label: language === 'ar' ? 'صورة' : 'Image',
    icon: <Image className="h-4 w-4" />,
    activeColor: 'bg-orange-500',
    hoverColor: 'hover:bg-orange-500/20',
    borderColor: 'border-orange-500',
    description: language === 'ar' ? 'إنشاء الصور' : 'Generate images'
  }];
  
  const quickActions = [{
    icon: <PenTool className="h-5 w-5" />,
    label: language === 'ar' ? 'مولد النصوص' : 'Text Generator',
    description: language === 'ar' ? 'إنشاء النصوص والردود الذكية' : 'Generate texts and smart replies',
    action: () => setShowTextGen(true),
    color: 'bg-purple-500'
  }, {
    icon: <Video className="h-5 w-5" />,
    label: language === 'ar' ? 'إنشاء فيديو' : 'Create Video',
    description: language === 'ar' ? 'حول صورتك إلى فيديو متحرك' : 'Turn your image into an animated video',
    action: () => setShowVideoDialog(true),
    color: 'bg-blue-500'
  }, {
    icon: <Mic className="h-5 w-5" />,
    label: language === 'ar' ? 'استوديو الصوت' : 'Voice Studio',
    description: language === 'ar' ? 'استنسخ صوتك، ترجم واتكلم بلغات مختلفة' : 'Clone your voice, translate and speak in different languages',
    action: () => setShowVoiceClone(true),
    color: 'bg-pink-500'
  }, {
    icon: <Gamepad2 className="h-5 w-5" />,
    label: language === 'ar' ? 'وضع الألعاب' : 'Game Mode',
    description: language === 'ar' ? 'العب ألعاب ذكية مع الذكاء الاصطناعي' : 'Play smart games with AI',
    action: () => setShowGameMode(true),
    color: 'bg-red-500'
  }];
  
  const handleTriggerSelect = (triggerId: string) => {
    onTriggerChange(triggerId);
    console.log('✨ Quick Actions: Trigger changed to:', triggerId);
    // Auto-close drawer after mode selection
    if (onClose) {
      setTimeout(() => {
        onClose();
      }, 300);
    }
  };

  const handleToolAction = (action: () => void) => {
    action();
    console.log('🔧 Quick Actions: Tool opened and drawer stays open');
  };
  
  return <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-6">
        <div className="text-center">
          
          
        </div>

        {/* AI Modes - NO VIDEO MODE */}
        <Card className="bg-white/20 dark:bg-black/20 border-white/30 dark:border-white/20 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-sm text-slate-700 dark:text-slate-300">
              {language === 'ar' ? 'أنماط الذكاء الاصطناعي' : 'AI Modes'}
            </CardTitle>
            <CardDescription className="text-xs text-slate-600 dark:text-slate-400">
              {language === 'ar' ? 'اختر النمط المناسب لمهمتك' : 'Choose the right mode for your task'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {triggerModes.map(mode => {
            const isActive = activeTrigger === mode.id;
            return <Button key={mode.id} onClick={() => handleTriggerSelect(mode.id)} variant="ghost" className={`w-full justify-start h-auto p-3 transition-all duration-300 min-w-0 ${isActive ? `${mode.activeColor} border-2 ${mode.borderColor} text-white shadow-lg` : `bg-white/10 dark:bg-black/10 ${mode.hoverColor} border-2 border-transparent text-slate-700 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-200`}`}>
                  <div className={`p-2 rounded-lg ${isActive ? 'bg-white/20' : mode.activeColor} text-white mr-3 flex-shrink-0`}>
                    {mode.icon}
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className="font-medium text-sm whitespace-normal break-words leading-tight">{mode.label}</div>
                    <div className="text-xs opacity-70 whitespace-normal break-words leading-tight">{mode.description}</div>
                  </div>
                </Button>;
          })}
          </CardContent>
        </Card>

        {/* Quick Tools - Video is here as a standalone tool */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {language === 'ar' ? 'الأدوات السريعة' : 'Quick Tools'}
          </h3>
          <div className="grid gap-3">
            {quickActions.map((action, index) => <Card key={index} className="cursor-pointer hover:shadow-md transition-all duration-300 bg-white/20 dark:bg-black/20 hover:bg-white/30 dark:hover:bg-black/30 border-white/30 dark:border-white/20 hover:border-white/40 dark:hover:border-white/30" onClick={() => handleToolAction(action.action)}>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${action.color} text-white`}>
                      {action.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-sm text-slate-700 dark:text-slate-300">{action.label}</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{action.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>)}
          </div>
        </div>

        {/* Text Generator Popup */}
        <TextGeneratorPopup 
          isOpen={showTextGen} 
          onClose={() => setShowTextGen(false)} 
          onTextGenerated={onTextGenerated} 
        />

        {/* Isolated Video Dialog - COMPLETELY SEPARATE */}
        <IsolatedVideoDialog 
          open={showVideoDialog} 
          onOpenChange={setShowVideoDialog} 
        />

        {/* Voice Clone Popup */}
        <VoiceClonePopup open={showVoiceClone} onOpenChange={setShowVoiceClone} />

        {/* Game Mode Modal */}
        <GameModeModal open={showGameMode} onOpenChange={setShowGameMode} />
      </div>
    </div>;
}
