
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Flag, List, CheckSquare, X } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { format } from 'date-fns';

interface PendingTask {
  title: string;
  description?: string;
  due_date?: string;
  due_time?: string;
  priority: 'normal' | 'high' | 'urgent';
  task_type: 'one-time' | 'repeated';
  subtasks?: string[];
}

interface PendingReminder {
  title: string;
  description?: string;
  due_date?: string;
  due_time?: string;
}

interface TaskConfirmationCardProps {
  type: 'task' | 'reminder';
  data: PendingTask | PendingReminder;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function TaskConfirmationCard({ 
  type, 
  data, 
  onConfirm, 
  onCancel, 
  isLoading = false 
}: TaskConfirmationCardProps) {
  const { language } = useTheme();

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      return format(new Date(dateStr), 'PPP');
    } catch {
      return dateStr;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'secondary';
      default: return 'outline';
    }
  };

  const getPriorityText = (priority: string) => {
    const priorityMap = {
      normal: language === 'ar' ? 'عادي' : 'Normal',
      high: language === 'ar' ? 'عالي' : 'High',
      urgent: language === 'ar' ? 'عاجل' : 'Urgent'
    };
    return priorityMap[priority as keyof typeof priorityMap] || priority;
  };

  const getTaskTypeText = (taskType: string) => {
    const typeMap = {
      'one-time': language === 'ar' ? 'لمرة واحدة' : 'One-time',
      'repeated': language === 'ar' ? 'متكرر' : 'Repeated'
    };
    return typeMap[taskType as keyof typeof typeMap] || taskType;
  };

  return (
    <Card className="w-full max-w-md mx-auto border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {type === 'task' ? (
            <>
              <CheckSquare className="h-4 w-4" />
              {language === 'ar' ? 'تأكيد إنشاء المهمة' : 'Confirm Task Creation'}
            </>
          ) : (
            <>
              <Clock className="h-4 w-4" />
              {language === 'ar' ? 'تأكيد إنشاء التذكير' : 'Confirm Reminder Creation'}
            </>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Title */}
        <div>
          <h3 className="font-medium text-sm text-muted-foreground mb-1">
            {language === 'ar' ? 'العنوان' : 'Title'}
          </h3>
          <p className="text-sm font-medium">{data.title}</p>
        </div>

        {/* Description */}
        {data.description && (
          <div>
            <h3 className="font-medium text-sm text-muted-foreground mb-1">
              {language === 'ar' ? 'الوصف' : 'Description'}
            </h3>
            <p className="text-sm text-muted-foreground">{data.description}</p>
          </div>
        )}

        {/* Date and Time */}
        {data.due_date && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{formatDate(data.due_date)}</span>
            {data.due_time && (
              <>
                <Clock className="h-4 w-4 text-muted-foreground ml-2" />
                <span className="text-sm">{data.due_time}</span>
              </>
            )}
          </div>
        )}

        {/* Task-specific fields */}
        {type === 'task' && 'priority' in data && (
          <div className="space-y-2">
            {/* Priority */}
            <div className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-muted-foreground" />
              <Badge variant={getPriorityColor(data.priority)}>
                {getPriorityText(data.priority)}
              </Badge>
            </div>

            {/* Task Type */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {language === 'ar' ? 'النوع:' : 'Type:'}
              </span>
              <span className="text-sm">{getTaskTypeText(data.task_type)}</span>
            </div>

            {/* Subtasks */}
            {data.subtasks && data.subtasks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <List className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {language === 'ar' ? 'المهام الفرعية' : 'Subtasks'}
                  </span>
                </div>
                <ul className="list-disc list-inside space-y-1 ml-6">
                  {data.subtasks.map((subtask, index) => (
                    <li key={index} className="text-sm text-muted-foreground">
                      {subtask}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1"
            size="sm"
          >
            {isLoading ? (
              <>
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent mr-2" />
                {language === 'ar' ? 'جارٍ الإنشاء...' : 'Creating...'}
              </>
            ) : (
              language === 'ar' ? 'إنشاء' : 'Create'
            )}
          </Button>
          
          <Button
            onClick={onCancel}
            variant="outline"
            disabled={isLoading}
            size="sm"
          >
            <X className="h-3 w-3 mr-1" />
            {language === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
