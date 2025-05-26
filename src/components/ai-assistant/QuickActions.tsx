
import React from "react";
import { Button } from "@/components/ui/button";
import { CheckSquare, Calendar, Users, Image, Zap, Sparkles, Brain, Wand2 } from "lucide-react";

interface QuickActionsProps {
  onActionClick: (prompt: string) => void;
  isProcessing: boolean;
  language: "en" | "ar";
}

export function QuickActions({ onActionClick, isProcessing, language }: QuickActionsProps) {
  const quickActions = [
    { 
      icon: <CheckSquare className="w-4 h-4" />, 
      text: language === 'ar' ? 'إنشاء مهمة' : 'Create task',
      prompt: language === 'ar' ? 'أنشئ مهمة جديدة' : 'Create a new task',
      gradient: 'from-green-500 to-emerald-600'
    },
    { 
      icon: <Calendar className="w-4 h-4" />, 
      text: language === 'ar' ? 'جدولة حدث' : 'Schedule event',
      prompt: language === 'ar' ? 'جدول حدث جديد' : 'Schedule a new event',
      gradient: 'from-blue-500 to-cyan-600'
    },
    { 
      icon: <Users className="w-4 h-4" />, 
      text: language === 'ar' ? 'إضافة جهة اتصال' : 'Add contact',
      prompt: language === 'ar' ? 'أضف جهة اتصال جديدة' : 'Add a new contact',
      gradient: 'from-purple-500 to-pink-600'
    },
    { 
      icon: <Image className="w-4 h-4" />, 
      text: language === 'ar' ? 'إنشاء صورة' : 'Generate image',
      prompt: language === 'ar' ? 'أنشئ صورة جميلة' : 'Generate a beautiful image',
      gradient: 'from-orange-500 to-red-600'
    }
  ];

  const smartActions = [
    {
      icon: <Brain className="w-4 h-4" />,
      text: language === 'ar' ? 'تحليل ذكي' : 'Smart Analysis',
      prompt: language === 'ar' ? 'حلل أنشطتي وقدم اقتراحات' : 'Analyze my activities and suggest improvements',
      gradient: 'from-indigo-500 to-purple-600'
    },
    {
      icon: <Wand2 className="w-4 h-4" />,
      text: language === 'ar' ? 'اقتراحات تلقائية' : 'Auto Suggestions',
      prompt: language === 'ar' ? 'ما الذي يمكنني فعله اليوم؟' : 'What can I do today?',
      gradient: 'from-yellow-500 to-orange-600'
    }
  ];

  return (
    <div className="p-4 border-t bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-900/20 dark:to-purple-900/20 flex-shrink-0">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-blue-500" />
        <p className="text-sm font-medium text-muted-foreground">
          {language === 'ar' ? 'إجراءات سريعة:' : 'Quick actions:'}
        </p>
      </div>
      
      <div className="grid grid-cols-2 gap-2 mb-3">
        {quickActions.map((action, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            onClick={() => onActionClick(action.prompt)}
            className={`justify-start gap-2 h-auto p-3 bg-gradient-to-r ${action.gradient} text-white border-0 hover:opacity-90 transition-all duration-200 shadow-sm`}
            disabled={isProcessing}
          >
            {action.icon}
            <span className="text-xs font-medium">{action.text}</span>
          </Button>
        ))}
      </div>

      <div className="mb-2 flex items-center gap-2">
        <Zap className="w-4 h-4 text-purple-500" />
        <p className="text-sm font-medium text-muted-foreground">
          {language === 'ar' ? 'إجراءات ذكية:' : 'Smart actions:'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {smartActions.map((action, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            onClick={() => onActionClick(action.prompt)}
            className={`justify-start gap-2 h-auto p-3 bg-gradient-to-r ${action.gradient} text-white border-0 hover:opacity-90 transition-all duration-200 shadow-sm`}
            disabled={isProcessing}
          >
            {action.icon}
            <span className="text-xs font-medium">{action.text}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
