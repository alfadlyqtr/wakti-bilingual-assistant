import React, { useState, useCallback, useMemo } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Search, Image, PenTool, Mic, Gamepad2 } from 'lucide-react';
import TextGeneratorPopup from './TextGeneratorPopup';
import { VoiceClonePopup } from './VoiceClonePopup';
import { GameModeModal } from './GameModeModal';


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
  
  // Memoized trigger modes for performance
  const triggerModes = useMemo(() => [{
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
  }], [language]);
  
  // Memoized quick actions for performance
  const quickActions = useMemo(() => [{
    icon: <PenTool className="h-5 w-5" />,
    label: language === 'ar' ? 'مولد النصوص' : 'Text Generator',
    description: language === 'ar' ? 'إنشاء النصوص والردود الذكية' : 'Generate texts and smart replies',
    action: () => setShowTextGen(true),
    color: 'bg-purple-500',
    disabled: false
  }, {
    icon: <Mic className="h-5 w-5" />,
    label: language === 'ar' ? 'استوديو الصوت' : 'Voice Studio',
    description: language === 'ar' ? 'استنسخ صوتك، ترجم واتكلم بلغات مختلفة' : 'Clone your voice, translate and speak in different languages',
    action: () => setShowVoiceClone(true),
    color: 'bg-pink-500',
    disabled: false
  }, {
    icon: <Gamepad2 className="h-5 w-5" />,
    label: language === 'ar' ? 'وضع الألعاب' : 'Game Mode',
    description: language === 'ar' ? 'العب ألعاب ذكية مع الذكاء الاصطناعي' : 'Play smart games with AI',
    action: () => setShowGameMode(true),
    color: 'bg-red-500',
    disabled: false
  }], [language]);
  
  const handleTriggerSelect = useCallback((triggerId: string) => {
    onTriggerChange(triggerId);
    console.log('✨ Quick Actions: Trigger changed to:', triggerId);
    // Auto-close drawer after mode selection
    if (onClose) {
      setTimeout(() => {
        onClose();
      }, 300);
    }
  }, [onTriggerChange, onClose]);

  const handleToolAction = useCallback((action: () => void) => {
    action();
    console.log('🔧 Quick Actions: Tool opened and drawer stays open');
  }, []);

  const handleTextGenClose = useCallback(() => {
    setShowTextGen(false);
  }, []);

  const handleVoiceCloneClose = useCallback((open: boolean) => {
    setShowVoiceClone(open);
  }, []);

  const handleGameModeClose = useCallback((open: boolean) => {
    setShowGameMode(open);
  }, []);
  
  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-y-auto">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-center text-foreground">
          {language === 'ar' ? 'أدوات سريعة' : 'Quick Tools'}
        </h2>
        
        <div className="space-y-3" role="radiogroup" aria-label={language === 'ar' ? 'أوضاع المحادثة' : 'Chat modes'}>
          {triggerModes.map((mode, index) => {
            const isActive = activeTrigger === mode.id;
            return (
              <Button
                key={mode.id}
                autoFocus={index === 0}
                onClick={() => handleTriggerSelect(mode.id)}
                variant="ghost"
                role="radio"
                aria-checked={isActive}
                className={`w-full justify-start h-auto p-3 transition-all duration-300 min-w-0 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  isActive 
                    ? `${mode.activeColor} border ${mode.borderColor} text-white shadow-lg` 
                    : `bg-white/10 dark:bg-black/10 ${mode.hoverColor} border ${mode.borderColor} text-slate-700 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-200`
                }`}
                aria-describedby={`${mode.id}-desc`}
              >
                <div 
                  className={`p-2 rounded-lg ${
                    isActive ? 'bg-white/20' : mode.activeColor
                  } text-white mr-3 flex-shrink-0`}
                  aria-hidden="true"
                >
                  {mode.icon}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <div className="font-medium text-sm whitespace-normal break-words leading-tight">
                    {mode.label}
                  </div>
                  <div 
                    id={`${mode.id}-desc`}
                    className="text-xs opacity-70 whitespace-normal break-words leading-tight"
                  >
                    {mode.description}
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Quick Tools */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {language === 'ar' ? 'الأدوات السريعة' : 'Quick Tools'}
        </h3>
        <div className="grid gap-3">
          {quickActions.map((action, index) => (
            <Card 
              key={index} 
              className={`transition-all duration-300 bg-white/20 dark:bg-black/20 border-white/30 dark:border-white/20 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500 ${
                action.disabled 
                  ? 'opacity-60 cursor-not-allowed' 
                  : 'cursor-pointer hover:shadow-md hover:bg-white/30 dark:hover:bg-black/30 hover:border-white/40 dark:hover:border-white/30'
              }`} 
              onClick={action.disabled ? undefined : () => handleToolAction(action.action)}
              role="button"
              tabIndex={action.disabled ? -1 : 0}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !action.disabled) {
                  e.preventDefault();
                  handleToolAction(action.action);
                }
              }}
              aria-label={`${action.label}: ${action.description}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${action.color} text-white ${action.disabled ? 'opacity-70' : ''}`}>
                    {action.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm text-slate-700 dark:text-slate-300">{action.label}</h3>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{action.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Text Generator Popup */}
      <TextGeneratorPopup 
        isOpen={showTextGen} 
        onClose={handleTextGenClose} 
        onTextGenerated={onTextGenerated} 
      />

      {/* Voice Clone Popup */}
      <VoiceClonePopup open={showVoiceClone} onOpenChange={handleVoiceCloneClose} />

      {/* Game Mode Modal */}
      <GameModeModal open={showGameMode} onOpenChange={handleGameModeClose} />
    </div>
  );
}
