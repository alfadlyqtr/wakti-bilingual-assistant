
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTheme } from '@/providers/ThemeProvider';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SimpleTaskRedirectProps {
  onClose?: () => void;
}

export function SimpleTaskRedirect({ onClose }: SimpleTaskRedirectProps) {
  const { language } = useTheme();
  const navigate = useNavigate();

  const handleRedirect = () => {
    navigate('/tasks-reminders');
    if (onClose) onClose();
  };

  return (
    <Card className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          <span className="font-medium text-green-800 dark:text-green-200">
            {language === 'ar' 
              ? 'تم فهم طلب إنشاء المهمة!' 
              : 'Task creation request understood!'
            }
          </span>
        </div>
        
        <p className="text-sm text-green-700 dark:text-green-300 mb-4">
          {language === 'ar'
            ? 'لإنشاء مهمة جديدة، يرجى زيارة صفحة المهام والتذكيرات حيث يمكنك إضافة وإدارة جميع مهامك.'
            : 'To create a new task, please visit the Tasks & Reminders page where you can add and manage all your tasks.'
          }
        </p>
        
        <Button 
          onClick={handleRedirect}
          className="w-full flex items-center justify-center gap-2"
        >
          {language === 'ar' ? 'اذهب إلى المهام والتذكيرات' : 'Go to Tasks & Reminders'}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
