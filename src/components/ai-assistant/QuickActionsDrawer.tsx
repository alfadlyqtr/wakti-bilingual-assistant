
import React from "react";
import { Button } from "@/components/ui/button";
import { CheckSquare, Calendar, Users, Image, Sparkles, X } from "lucide-react";

interface QuickActionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onActionClick: (prompt: string) => void;
  isProcessing: boolean;
  language: "en" | "ar";
}

export function QuickActionsDrawer({ 
  isOpen, 
  onClose, 
  onActionClick, 
  isProcessing, 
  language 
}: QuickActionsDrawerProps) {
  const quickActions = [
    { 
      icon: <CheckSquare className="w-5 h-5" />, 
      text: language === 'ar' ? 'إنشاء مهمة' : 'Create task',
      prompt: language === 'ar' ? 'أنشئ مهمة جديدة' : 'Create a new task',
      gradient: 'from-green-500 to-emerald-600'
    },
    { 
      icon: <Calendar className="w-5 h-5" />, 
      text: language === 'ar' ? 'جدولة حدث' : 'Schedule event',
      prompt: language === 'ar' ? 'جدول حدث جديد' : 'Schedule a new event',
      gradient: 'from-blue-500 to-cyan-600'
    },
    { 
      icon: <Users className="w-5 h-5" />, 
      text: language === 'ar' ? 'إضافة جهة اتصال' : 'Add contact',
      prompt: language === 'ar' ? 'أضف جهة اتصال جديدة' : 'Add a new contact',
      gradient: 'from-purple-500 to-pink-600'
    },
    { 
      icon: <Image className="w-5 h-5" />, 
      text: language === 'ar' ? 'إنشاء صورة' : 'Generate image',
      prompt: language === 'ar' ? 'أنشئ صورة جميلة' : 'Generate a beautiful image',
      gradient: 'from-orange-500 to-red-600'
    }
  ];

  if (!isOpen) return null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold">
            {language === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Content */}
      <div className="flex-1 p-4">
        <div className="space-y-3">
          {quickActions.map((action, index) => (
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
      </div>
    </div>
  );
}
