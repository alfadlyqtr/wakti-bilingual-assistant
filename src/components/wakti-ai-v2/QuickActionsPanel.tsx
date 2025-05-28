
import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckSquare, Calendar, Bell, Image, Sparkles, BookOpen, PenTool, Languages, Settings, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickActionsPanelProps {
  onSendMessage: (message: string) => void;
}

export function QuickActionsPanel({ onSendMessage }: QuickActionsPanelProps) {
  const { language } = useTheme();
  const [customActionDialogOpen, setCustomActionDialogOpen] = useState(false);
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
    },
    {
      icon: Image,
      label: language === 'ar' ? 'إنشاء صورة' : 'Generate Image',
      message: language === 'ar' ? 'أنشئ صورة لي' : 'Generate an image for me',
      gradient: 'from-green-500 to-emerald-500'
    },
    {
      icon: BookOpen,
      label: language === 'ar' ? 'واجب منزلي' : 'Homework',
      message: language === 'ar' ? 'ساعدني في واجبي المنزلي' : 'Help me with my homework',
      gradient: 'from-indigo-500 to-blue-500'
    },
    {
      icon: PenTool,
      label: language === 'ar' ? 'إنشاء نص' : 'Text Generate',
      message: language === 'ar' ? 'اكتب نصاً لي' : 'Generate text for me',
      gradient: 'from-teal-500 to-cyan-500'
    },
    {
      icon: Languages,
      label: language === 'ar' ? 'مترجم' : 'Translator',
      message: language === 'ar' ? 'ترجم هذا النص' : 'Translate this text',
      gradient: 'from-rose-500 to-pink-500'
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
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
          <Sparkles className="h-3 w-3" />
          {language === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}
        </h3>
        
        {/* Ultra compact 2-column grid for actions */}
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
                  {language === 'ar' ? 'إدخال مخصص' : 'Custom Input'} ⚙️
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
    </div>
  );
}
