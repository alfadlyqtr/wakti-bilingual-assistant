
import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { 
  MessageSquare, 
  FileText, 
  Palette,
  Calculator,
  Languages,
  Search,
  X,
  Bot,
  ImagePlus,
  Mic
} from 'lucide-react';
import { TextGenModal } from './TextGenModal';
import { GameModeModal } from './GameModeModal';

interface QuickActionsPanelProps {
  onClose: () => void;
  onTriggerChange?: (trigger: string) => void;
  activeTrigger?: string;
}

export function QuickActionsPanel({ onClose, onTriggerChange, activeTrigger = 'chat' }: QuickActionsPanelProps) {
  const { language } = useTheme();
  const [showTextGen, setShowTextGen] = useState(false);
  const [showGameMode, setShowGameMode] = useState(false);

  const aiModes = [
    {
      id: 'chat',
      icon: Bot,
      label: language === 'ar' ? 'محادثة عادية' : 'Regular Chat',
      description: language === 'ar' ? 'محادثة عادية مع الذكاء الاصطناعي' : 'Normal chat with AI',
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
      isActive: activeTrigger === 'chat'
    },
    {
      id: 'search',
      icon: Search,
      label: language === 'ar' ? 'بحث' : 'Search',
      description: language === 'ar' ? 'بحث في الإنترنت' : 'Search the internet',
      color: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-950/20',
      isActive: activeTrigger === 'search'
    },
    {
      id: 'image',
      icon: ImagePlus,
      label: language === 'ar' ? 'صورة' : 'Image',
      description: language === 'ar' ? 'إنشاء الصور' : 'Generate images',
      color: 'text-orange-500',
      bgColor: 'bg-orange-50 dark:bg-orange-950/20',
      isActive: activeTrigger === 'image'
    }
  ];

  const quickTools = [
    {
      id: 'textgen',
      icon: FileText,
      label: language === 'ar' ? 'مولد النصوص' : 'Text Generator',
      description: language === 'ar' ? 'إنشاء النصوص والردود الذكية' : 'Generate texts and smart replies',
      color: 'text-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-950/20',
      action: () => setShowTextGen(true)
    },
    {
      id: 'translator',
      icon: Mic,
      label: language === 'ar' ? 'مترجم الصوت' : 'Voice Translator',
      description: language === 'ar' ? 'ترجمة صوتية في الوقت الفعلي' : 'Real-time voice translation',
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
      action: () => {
        console.log('Voice Translator action - to be implemented');
        onClose();
      }
    },
    {
      id: 'games',
      icon: Calculator,
      label: language === 'ar' ? 'وضع اللعب' : 'Game Mode',
      description: language === 'ar' ? 'العب الألعاب الذكية مع الذكاء الاصطناعي' : 'Play smart games with AI',
      color: 'text-red-500',
      bgColor: 'bg-red-50 dark:bg-red-950/20',
      action: () => setShowGameMode(true)
    }
  ];

  const handleModeSelect = (modeId: string) => {
    if (onTriggerChange) {
      onTriggerChange(modeId);
    }
    onClose();
  };

  return (
    <>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {language === 'ar' ? 'أوضاع الذكاء الاصطناعي' : 'AI Modes'}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="text-sm text-muted-foreground mb-4">
          {language === 'ar' ? 'اختر الوضع المناسب لمهمتك' : 'Choose the right mode for your task'}
        </div>

        {/* AI Modes Section */}
        <div className="space-y-3">
          {aiModes.map((mode) => {
            const IconComponent = mode.icon;
            return (
              <Button
                key={mode.id}
                variant={mode.isActive ? "default" : "ghost"}
                className={`h-auto p-4 justify-start w-full ${mode.isActive ? '' : `hover:${mode.bgColor}`} transition-colors`}
                onClick={() => handleModeSelect(mode.id)}
              >
                <div className="flex items-center gap-3 w-full">
                  <div className={`p-2 rounded-lg ${mode.isActive ? 'bg-white/20' : mode.bgColor}`}>
                    <IconComponent className={`h-5 w-5 ${mode.isActive ? 'text-white' : mode.color}`} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium">{mode.label}</div>
                    <div className={`text-sm ${mode.isActive ? 'text-white/80' : 'text-muted-foreground'}`}>
                      {mode.description}
                    </div>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>

        {/* Quick Tools Section */}
        <div className="pt-6 border-t border-border">
          <h3 className="text-lg font-semibold mb-4">
            {language === 'ar' ? 'الأدوات السريعة' : 'Quick Tools'}
          </h3>
          
          <div className="space-y-3">
            {quickTools.map((tool) => {
              const IconComponent = tool.icon;
              return (
                <Button
                  key={tool.id}
                  variant="ghost"
                  className={`h-auto p-4 justify-start w-full hover:${tool.bgColor} transition-colors`}
                  onClick={tool.action}
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className={`p-2 rounded-lg ${tool.bgColor}`}>
                      <IconComponent className={`h-5 w-5 ${tool.color}`} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">{tool.label}</div>
                      <div className="text-sm text-muted-foreground">
                        {tool.description}
                      </div>
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      <TextGenModal 
        open={showTextGen} 
        onOpenChange={setShowTextGen}
        onTriggerChange={(trigger) => console.log('Trigger changed:', trigger)}
        onTextGenParams={(params) => console.log('Text gen params:', params)}
      />

      <GameModeModal 
        open={showGameMode} 
        onOpenChange={setShowGameMode}
      />
    </>
  );
}
