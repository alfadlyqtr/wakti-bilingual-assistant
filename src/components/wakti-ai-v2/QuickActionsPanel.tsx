
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { CheckSquare, Calendar, Bell, Image, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickActionsPanelProps {
  onSendMessage: (message: string) => void;
}

export function QuickActionsPanel({ onSendMessage }: QuickActionsPanelProps) {
  const { language } = useTheme();

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
    }
  ];

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
        <Sparkles className="h-4 w-4" />
        {language === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}
      </h3>
      
      <div className="space-y-3">
        {quickActions.map((action, index) => (
          <Button
            key={index}
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 h-auto p-3 hover:scale-105 transition-all duration-200",
              "border border-border/50 hover:border-border"
            )}
            onClick={() => onSendMessage(action.message)}
          >
            <div className={cn(
              "p-2 rounded-lg bg-gradient-to-r",
              action.gradient
            )}>
              <action.icon className="h-4 w-4 text-white" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium">{action.label}</p>
            </div>
          </Button>
        ))}
      </div>

      <div className="pt-4 border-t border-border/50">
        <h4 className="text-xs font-medium text-muted-foreground mb-2">
          {language === 'ar' ? 'أمثلة للتجربة' : 'Try asking me'}
        </h4>
        <div className="space-y-2">
          {[
            language === 'ar' ? 'ما هي مهامي اليوم؟' : 'What are my tasks today?',
            language === 'ar' ? 'ساعدني في التخطيط لهذا الأسبوع' : 'Help me plan this week',
            language === 'ar' ? 'أرني تقويمي' : 'Show me my calendar'
          ].map((example, index) => (
            <Button
              key={index}
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs text-muted-foreground hover:text-foreground"
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
