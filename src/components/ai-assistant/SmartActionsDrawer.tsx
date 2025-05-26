
import React from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Brain, Wand2, Zap, TrendingUp, BarChart3, Target } from "lucide-react";

interface SmartActionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onActionClick: (prompt: string) => void;
  isProcessing: boolean;
  language: "en" | "ar";
}

export function SmartActionsDrawer({ 
  isOpen, 
  onClose, 
  onActionClick, 
  isProcessing, 
  language 
}: SmartActionsDrawerProps) {
  const smartActions = [
    {
      icon: <Brain className="w-5 h-5" />,
      text: language === 'ar' ? 'تحليل ذكي' : 'Smart Analysis',
      prompt: language === 'ar' ? 'حلل أنشطتي وقدم اقتراحات' : 'Analyze my activities and suggest improvements',
      gradient: 'from-indigo-500 to-purple-600'
    },
    {
      icon: <Wand2 className="w-5 h-5" />,
      text: language === 'ar' ? 'اقتراحات تلقائية' : 'Auto Suggestions',
      prompt: language === 'ar' ? 'ما الذي يمكنني فعله اليوم؟' : 'What can I do today?',
      gradient: 'from-yellow-500 to-orange-600'
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      text: language === 'ar' ? 'تحسين الإنتاجية' : 'Productivity Boost',
      prompt: language === 'ar' ? 'كيف يمكنني تحسين إنتاجيتي؟' : 'How can I improve my productivity?',
      gradient: 'from-green-500 to-teal-600'
    },
    {
      icon: <BarChart3 className="w-5 h-5" />,
      text: language === 'ar' ? 'تقرير الأداء' : 'Performance Report',
      prompt: language === 'ar' ? 'أنشئ تقرير أداء أسبوعي' : 'Generate a weekly performance report',
      gradient: 'from-blue-500 to-indigo-600'
    },
    {
      icon: <Target className="w-5 h-5" />,
      text: language === 'ar' ? 'تحديد الأهداف' : 'Goal Setting',
      prompt: language === 'ar' ? 'ساعدني في وضع أهداف ذكية' : 'Help me set SMART goals',
      gradient: 'from-red-500 to-pink-600'
    }
  ];

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-80 h-full">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-500" />
            {language === 'ar' ? 'إجراءات ذكية' : 'Smart Actions'}
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-3">
          {smartActions.map((action, index) => (
            <Button
              key={index}
              variant="outline"
              onClick={() => onActionClick(action.prompt)}
              className={`w-full justify-start gap-3 h-16 p-4 bg-gradient-to-r ${action.gradient} text-white border-0 hover:opacity-90 transition-all duration-200 shadow-md hover:shadow-lg`}
              disabled={isProcessing}
            >
              {action.icon}
              <span className="font-medium">{action.text}</span>
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
