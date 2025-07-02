
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
  X
} from 'lucide-react';
import { TextGenModal } from './TextGenModal';
import { GameModeModal } from './GameModeModal';

interface QuickActionsPanelProps {
  onClose: () => void;
}

export function QuickActionsPanel({ onClose }: QuickActionsPanelProps) {
  const { language } = useTheme();
  const [showTextGen, setShowTextGen] = useState(false);
  const [showGameMode, setShowGameMode] = useState(false);

  const quickActions = [
    {
      id: 'translate',
      icon: Languages,
      label: language === 'ar' ? 'ترجمة' : 'Translate',
      description: language === 'ar' ? 'ترجم النصوص لأي لغة' : 'Translate text to any language',
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
      action: () => {
        console.log('Translate action - to be implemented');
        onClose();
      }
    },
    {
      id: 'search',
      icon: Search,
      label: language === 'ar' ? 'بحث' : 'Search',
      description: language === 'ar' ? 'ابحث في الإنترنت' : 'Search the web',
      color: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-950/20',
      action: () => {
        console.log('Search action - to be implemented');
        onClose();
      }
    },
    {
      id: 'image',
      icon: Palette,
      label: language === 'ar' ? 'صور AI' : 'AI Images',
      description: language === 'ar' ? 'إنشاء صور بالذكاء الاصطناعي' : 'Generate AI images',
      color: 'text-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-950/20',
      action: () => {
        console.log('Image generation action - to be implemented');
        onClose();
      }
    },
    {
      id: 'textgen',
      icon: FileText,
      label: language === 'ar' ? 'كتابة AI' : 'AI Writing',
      description: language === 'ar' ? 'كتابة وتحرير النصوص' : 'Write and edit text',
      color: 'text-orange-500',
      bgColor: 'bg-orange-50 dark:bg-orange-950/20',
      action: () => setShowTextGen(true)
    },
    {
      id: 'games',
      icon: Calculator,
      label: language === 'ar' ? 'ألعاب' : 'Games',
      description: language === 'ar' ? 'العب الشطرنج وXO' : 'Play Chess & Tic-Tac-Toe',
      color: 'text-red-500',  
      bgColor: 'bg-red-50 dark:bg-red-950/20',
      action: () => setShowGameMode(true)
    }
  ];

  return (
    <>
      <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-lg shadow-lg z-50 max-h-[70vh] overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">
              {language === 'ar' ? 'الإجراءات السريعة' : 'Quick Actions'}
            </h3>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {quickActions.map((action) => {
              const IconComponent = action.icon;
              return (
                <Button
                  key={action.id}
                  variant="ghost"
                  className={`h-auto p-4 justify-start hover:${action.bgColor} transition-colors`}
                  onClick={action.action}
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className={`p-2 rounded-lg ${action.bgColor}`}>
                      <IconComponent className={`h-5 w-5 ${action.color}`} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">{action.label}</div>
                      <div className="text-sm text-muted-foreground">
                        {action.description}
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
