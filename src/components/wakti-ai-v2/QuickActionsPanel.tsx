
import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckSquare, Calendar, Bell, Image, Sparkles, BookOpen, PenTool, Languages, Settings, Brain, Search, Zap, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VoiceTranslatorPopup } from './VoiceTranslatorPopup';

type TriggerMode = 'chat' | 'search' | 'advanced_search' | 'image';

interface QuickActionsPanelProps {
  onSendMessage: (message: string) => void;
  activeTrigger: TriggerMode;
  onTriggerChange: (trigger: TriggerMode) => void;
}

export function QuickActionsPanel({ onSendMessage, activeTrigger, onTriggerChange }: QuickActionsPanelProps) {
  const { language } = useTheme();
  const [customActionDialogOpen, setCustomActionDialogOpen] = useState(false);
  const [voiceTranslatorOpen, setVoiceTranslatorOpen] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customMessage, setCustomMessage] = useState('');

  const quickActions = [
    {
      icon: CheckSquare,
      label: language === 'ar' ? 'مهمة جديدة' : 'New Task',
      message: language === 'ar' ? 'أنشئ مهمة جديدة' : 'Create a new task',
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      icon: Calendar,
      label: language === 'ar' ? 'حدث جديد' : 'New Event',
      message: language === 'ar' ? 'أنشئ حدث جديد' : 'Create a new event',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      icon: Bell,
      label: language === 'ar' ? 'تذكير جديد' : 'New Reminder',
      message: language === 'ar' ? 'ذكرني بشيء مهم' : 'Remind me of something important',
      gradient: 'from-orange-500 to-red-500'
    }
  ];

  const triggerButtons = [
    {
      id: 'chat' as TriggerMode,
      icon: MessageSquare,
      label: language === 'ar' ? 'محادثة' : 'Chat',
      description: language === 'ar' ? 'الوضع الافتراضي' : 'Default mode',
      color: 'bg-blue-500'
    },
    {
      id: 'search' as TriggerMode,
      icon: Search,
      label: language === 'ar' ? 'بحث' : 'Search',
      description: language === 'ar' ? 'البحث والمعلومات الحديثة' : 'Search & current info',
      color: 'bg-green-500'
    },
    {
      id: 'advanced_search' as TriggerMode,
      icon: Zap,
      label: language === 'ar' ? 'بحث متقدم' : 'Advanced Search',
      description: language === 'ar' ? 'قريباً' : 'Coming soon',
      color: 'bg-purple-500'
    },
    {
      id: 'image' as TriggerMode,
      icon: Image,
      label: language === 'ar' ? 'صورة' : 'Image',
      description: language === 'ar' ? 'إنشاء الصور' : 'Image generation',
      color: 'bg-orange-500'
    }
  ];

  const handleCustomAction = () => {
    if (customLabel && customMessage) {
      onSendMessage(customMessage);
      setCustomActionDialogOpen(false);
      setCustomLabel('');
      setCustomMessage('');
    }
  };

  return (
    <div className="space-y-4">
      {/* AI Trigger Controls */}
      <div>
        <h3 className="font-semibold text-xs text-muted-foreground flex items-center gap-1.5 mb-3">
          <Brain className="h-3 w-3" />
          {language === 'ar' ? 'وضع الذكاء الاصطناعي' : 'AI Mode'}
        </h3>
        
        <div className="grid grid-cols-2 gap-2">
          {triggerButtons.map((trigger) => (
            <Button
              key={trigger.id}
              variant={activeTrigger === trigger.id ? "default" : "outline"}
              className={cn(
                "h-auto p-3 flex flex-col items-center gap-2 text-center transition-all duration-200",
                activeTrigger === trigger.id && "ring-2 ring-primary ring-offset-2",
                trigger.id === 'advanced_search' && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => trigger.id !== 'advanced_search' && onTriggerChange(trigger.id)}
              disabled={trigger.id === 'advanced_search'}
            >
              <div className={cn(
                "p-2 rounded-lg",
                activeTrigger === trigger.id ? "bg-primary-foreground" : trigger.color
              )}>
                <trigger.icon className={cn(
                  "h-4 w-4",
                  activeTrigger === trigger.id ? "text-primary" : "text-white"
                )} />
              </div>
              <div>
                <div className="text-xs font-medium">{trigger.label}</div>
                <div className="text-[10px] text-muted-foreground">{trigger.description}</div>
              </div>
            </Button>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="font-semibold text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
          <Sparkles className="h-3 w-3" />
          {language === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}
        </h3>
        
        <div className="grid grid-cols-2 gap-1.5 mb-2">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              variant="ghost"
              className={cn(
                "h-auto p-1.5 flex flex-col items-center gap-1 hover:scale-105 transition-all duration-200",
                "border border-border/50 hover:border-border text-center"
              )}
              onClick={() => onSendMessage(action.message)}
            >
              <div className={cn(
                "p-1 rounded-sm bg-gradient-to-r",
                action.gradient
              )}>
                <action.icon className="h-3 w-3 text-white" />
              </div>
              <span className="text-[10px] font-medium leading-tight">{action.label}</span>
            </Button>
          ))}
          
          {/* Image Generation Button */}
          <Button
            variant="ghost"
            className={cn(
              "h-auto p-1.5 flex flex-col items-center gap-1 hover:scale-105 transition-all duration-200",
              "border border-border/50 hover:border-border text-center"
            )}
            onClick={() => onSendMessage(language === 'ar' ? 'أنشئ صورة لي' : 'Generate an image for me')}
          >
            <div className="p-1 rounded-sm bg-gradient-to-r from-green-500 to-emerald-500">
              <Image className="h-3 w-3 text-white" />
            </div>
            <span className="text-[10px] font-medium leading-tight">
              {language === 'ar' ? 'إنشاء صورة' : 'Generate Image'}
            </span>
          </Button>

          {/* Homework Button */}
          <Button
            variant="ghost"
            className={cn(
              "h-auto p-1.5 flex flex-col items-center gap-1 hover:scale-105 transition-all duration-200",
              "border border-border/50 hover:border-border text-center"
            )}
            onClick={() => onSendMessage(language === 'ar' ? 'ساعدني في واجبي المنزلي' : 'Help me with my homework')}
          >
            <div className="p-1 rounded-sm bg-gradient-to-r from-indigo-500 to-blue-500">
              <BookOpen className="h-3 w-3 text-white" />
            </div>
            <span className="text-[10px] font-medium leading-tight">
              {language === 'ar' ? 'واجب منزلي' : 'Homework'}
            </span>
          </Button>
        </div>
      </div>

      {/* Action Buttons (Not Triggers) */}
      <div>
        <h3 className="font-semibold text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
          <Settings className="h-3 w-3" />
          {language === 'ar' ? 'أدوات' : 'Tools'}
        </h3>
        
        <div className="grid grid-cols-2 gap-1.5">
          {/* Voice Translator Button */}
          <Button
            variant="ghost"
            className={cn(
              "h-auto p-1.5 flex flex-col items-center gap-1 hover:scale-105 transition-all duration-200",
              "border border-border/50 hover:border-border text-center"
            )}
            onClick={() => setVoiceTranslatorOpen(true)}
          >
            <div className="p-1 rounded-sm bg-gradient-to-r from-rose-500 to-pink-500">
              <Languages className="h-3 w-3 text-white" />
            </div>
            <span className="text-[10px] font-medium leading-tight">
              {language === 'ar' ? 'مترجم' : 'Translator'}
            </span>
          </Button>
          
          {/* Text Generation Button */}
          <Button
            variant="ghost"
            className={cn(
              "h-auto p-1.5 flex flex-col items-center gap-1 hover:scale-105 transition-all duration-200",
              "border border-border/50 hover:border-border text-center"
            )}
            onClick={() => onSendMessage(language === 'ar' ? 'اكتب نصاً لي' : 'Generate text for me')}
          >
            <div className="p-1 rounded-sm bg-gradient-to-r from-teal-500 to-cyan-500">
              <PenTool className="h-3 w-3 text-white" />
            </div>
            <span className="text-[10px] font-medium leading-tight">
              {language === 'ar' ? 'إنشاء نص' : 'Text Generate'}
            </span>
          </Button>
          
          {/* Improve AI Button */}
          <Button
            variant="ghost"
            className={cn(
              "h-auto p-1.5 flex flex-col items-center gap-1 hover:scale-105 transition-all duration-200",
              "border border-border/50 hover:border-border text-center"
            )}
            onClick={() => onSendMessage(language === 'ar' ? 'كيف يمكنني تحسين استخدام الذكاء الاصطناعي؟' : 'How can I improve my AI usage?')}
          >
            <div className="p-1 rounded-sm bg-gradient-to-r from-violet-500 to-purple-500">
              <Brain className="h-3 w-3 text-white" />
            </div>
            <span className="text-[10px] font-medium leading-tight">
              {language === 'ar' ? 'تحسين الذكاء الاصطناعي' : 'Improve AI'}
            </span>
          </Button>
          
          {/* Custom Input Action */}
          <Dialog open={customActionDialogOpen} onOpenChange={setCustomActionDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "h-auto p-1.5 flex flex-col items-center gap-1 hover:scale-105 transition-all duration-200",
                  "border border-border/50 hover:border-border text-center"
                )}
              >
                <div className="p-1 rounded-sm bg-gradient-to-r from-gray-500 to-slate-500">
                  <Settings className="h-3 w-3 text-white" />
                </div>
                <span className="text-[10px] font-medium leading-tight">
                  {language === 'ar' ? 'إدخال مخصص' : 'Custom Input'}
                </span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {language === 'ar' ? 'إنشاء إجراء مخصص' : 'Create Custom Action'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="custom-label">
                    {language === 'ar' ? 'تسمية الإجراء' : 'Action Label'}
                  </Label>
                  <Input
                    id="custom-label"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder={language === 'ar' ? 'مثال: ملخص ذكي' : 'e.g., AI Summary'}
                  />
                </div>
                <div>
                  <Label htmlFor="custom-message">
                    {language === 'ar' ? 'الرسالة المرسلة' : 'Message to Send'}
                  </Label>
                  <Input
                    id="custom-message"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder={language === 'ar' ? 'مثال: لخص هذا النص' : 'e.g., Summarize this text'}
                  />
                </div>
                <Button onClick={handleCustomAction} className="w-full">
                  {language === 'ar' ? 'إنشاء' : 'Create'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Try asking me section */}
      <div className="pt-2 border-t border-border/50">
        <h4 className="text-[10px] font-medium text-muted-foreground mb-1.5">
          {language === 'ar' ? 'أمثلة للتجربة' : 'Try asking me'}
        </h4>
        <div className="space-y-1">
          {[
            language === 'ar' ? 'ما هي مهامي اليوم؟' : 'What are my tasks today?',
            language === 'ar' ? 'ساعدني في التخطيط لهذا الأسبوع' : 'Help me plan this week',
            language === 'ar' ? 'أرني تقويمي' : 'Show me my calendar'
          ].map((example, index) => (
            <Button
              key={index}
              variant="ghost"
              size="sm"
              className="w-full justify-start text-[10px] text-muted-foreground hover:text-foreground h-6"
              onClick={() => onSendMessage(example)}
            >
              "{example}"
            </Button>
          ))}
        </div>
      </div>

      {/* Voice Translator Popup */}
      <VoiceTranslatorPopup 
        open={voiceTranslatorOpen} 
        onOpenChange={setVoiceTranslatorOpen} 
      />
    </div>
  );
}
