
import React from 'react';
import { Calendar, Clock, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';
import { formatDateForDisplay, isValidDate } from '@/lib/utils';

interface TaskConfirmationCardProps {
  type: 'task' | 'reminder';
  data: any;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  enhanced?: boolean;
}

export function TaskConfirmationCard({ 
  type, 
  data, 
  onConfirm, 
  onCancel, 
  isLoading = false 
}: TaskConfirmationCardProps) {
  const { language } = useTheme();

  const formatDate = (dateString: string) => {
    if (!dateString || !isValidDate(dateString)) return '';
    return formatDateForDisplay(dateString);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="font-medium text-sm text-gray-900">
            {type === 'task' 
              ? (language === 'ar' ? 'تأكيد المهمة' : 'Confirm Task')
              : (language === 'ar' ? 'تأكيد التذكير' : 'Confirm Reminder')
            }
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
          disabled={isLoading}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      <div className="space-y-3">
        {/* Title */}
        <div>
          <h3 className="font-medium text-gray-900 mb-1">{data.title}</h3>
          {data.description && (
            <p className="text-sm text-gray-600">{data.description}</p>
          )}
        </div>

        {/* Subtasks */}
        {data.subtasks && data.subtasks.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              {language === 'ar' ? 'المهام الفرعية:' : 'Subtasks:'}
            </p>
            <ul className="space-y-1">
              {data.subtasks.map((subtask: string, index: number) => (
                <li key={index} className="text-sm text-gray-600 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                  {subtask}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Basic Details */}
        <div className="space-y-2">
          {/* Due Date */}
          {data.due_date && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600">
                {language === 'ar' ? 'التاريخ:' : 'Date:'}
              </span>
              <span className="text-gray-900">
                {formatDate(data.due_date)}
              </span>
            </div>
          )}

          {/* Due Time */}
          {data.due_time && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600">
                {language === 'ar' ? 'الوقت:' : 'Time:'}
              </span>
              <span className="text-gray-900">
                {data.due_time}
              </span>
            </div>
          )}
        </div>

        {/* Simple Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1"
            size="sm"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                {language === 'ar' ? 'جاري الإنشاء...' : 'Creating...'}
              </div>
            ) : (
              language === 'ar' ? 'إنشاء' : 'Create'
            )}
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            size="sm"
          >
            {language === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
        </div>
      </div>
    </div>
  );
}
