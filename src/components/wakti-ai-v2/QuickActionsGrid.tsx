
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTheme } from '@/providers/ThemeProvider';
import { MessageSquare, Search, Image, Video, PenTool, Mic, Gamepad2, Calendar, Clock, CheckCircle } from 'lucide-react';

interface QuickActionsGridProps {
  onClose: () => void;
}

export function QuickActionsGrid({ onClose }: QuickActionsGridProps) {
  const { language } = useTheme();
  
  const quickActions = [
    {
      icon: <MessageSquare className="h-5 w-5" />,
      label: language === 'ar' ? 'محادثة عادية' : 'Regular Chat',
      description: language === 'ar' ? 'محادثة عادية مع الذكاء الاصطناعي' : 'Normal chat with AI',
      action: () => console.log('Chat action'),
      color: 'bg-blue-500'
    },
    {
      icon: <Search className="h-5 w-5" />,
      label: language === 'ar' ? 'بحث' : 'Search Web',
      description: language === 'ar' ? 'بحث في الإنترنت' : 'Search the internet',
      action: () => console.log('Search action'),
      color: 'bg-green-500'
    },
    {
      icon: <Image className="h-5 w-5" />,
      label: language === 'ar' ? 'إنشاء صور' : 'Generate Images',
      description: language === 'ar' ? 'إنشاء الصور بالذكاء الاصطناعي' : 'Create images with AI',
      action: () => console.log('Image action'),
      color: 'bg-orange-500'
    },
    {
      icon: <Video className="h-5 w-5" />,
      label: language === 'ar' ? 'إنشاء فيديو' : 'Generate Video',
      description: language === 'ar' ? 'إنشاء مقاطع الفيديو' : 'Create video content',
      action: () => console.log('Video action'),
      color: 'bg-purple-500'
    },
    {
      icon: <CheckCircle className="h-5 w-5" />,
      label: language === 'ar' ? 'إنشاء مهمة' : 'Create Task',
      description: language === 'ar' ? 'إنشاء مهمة جديدة' : 'Create a new task',
      action: () => console.log('Task action'),
      color: 'bg-indigo-500'
    },
    {
      icon: <Clock className="h-5 w-5" />,
      label: language === 'ar' ? 'إنشاء تذكير' : 'Create Reminder',
      description: language === 'ar' ? 'إنشاء تذكير جديد' : 'Create a new reminder',
      action: () => console.log('Reminder action'),
      color: 'bg-pink-500'
    }
  ];

  const handleActionClick = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div className="grid gap-3">
      {quickActions.map((action, index) => (
        <Card 
          key={index} 
          className="cursor-pointer hover:shadow-md transition-all duration-300 bg-white/20 dark:bg-black/20 hover:bg-white/30 dark:hover:bg-black/30 border-white/30 dark:border-white/20 hover:border-white/40 dark:hover:border-white/30" 
          onClick={() => handleActionClick(action.action)}
        >
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
        </Card>
      ))}
    </div>
  );
}
