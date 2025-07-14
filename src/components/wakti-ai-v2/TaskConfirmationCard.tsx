
import React from 'react';
import { Calendar, Clock, CheckCircle, X, Tag } from 'lucide-react';
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'normal': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPriorityLabel = (priority: string) => {
    const labels = {
      en: { normal: 'Normal', high: 'High', urgent: 'Urgent' },
      ar: { normal: 'عادي', high: 'عالي', urgent: 'عاجل' }
    };
    return labels[language as 'en' | 'ar']?.[priority as keyof typeof labels.en] || priority;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm max-w-md mx-auto">
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
          <h3 className="font-medium text-gray-900 mb-1 text-sm">{data.title}</h3>
          {data.description && (
            <p className="text-xs text-gray-600 line-clamp-2">{data.description}</p>
          )}
        </div>

        {/* Priority Badge */}
        {data.priority && (
          <div className="flex items-center gap-2">
            <Tag className="h-3 w-3 text-gray-500" />
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(data.priority)}`}>
              {getPriorityLabel(data.priority)}
            </span>
          </div>
        )}

        {/* Subtasks */}
        {data.subtasks && data.subtasks.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-700 mb-2">
              {language === 'ar' ? 'المهام الفرعية:' : 'Subtasks:'}
            </p>
            <div className="space-y-1 max-h-16 overflow-y-auto">
              {data.subtasks.slice(0, 3).map((subtask: string, index: number) => (
                <div key={index} className="text-xs text-gray-600 flex items-center gap-2">
                  <div className="w-1 h-1 bg-gray-400 rounded-full flex-shrink-0" />
                  <span className="truncate">{subtask}</span>
                </div>
              ))}
              {data.subtasks.length > 3 && (
                <div className="text-xs text-gray-500 font-medium">
                  +{data.subtasks.length - 3} {language === 'ar' ? 'أخرى' : 'more'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Date and Time */}
        <div className="flex flex-wrap gap-3 text-xs">
          {data.due_date && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-gray-500" />
              <span className="text-gray-600">
                {formatDate(data.due_date)}
              </span>
            </div>
          )}

          {data.due_time && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-gray-500" />
              <span className="text-gray-600">
                {data.due_time}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 h-8 text-xs"
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
            className="h-8 text-xs"
          >
            {language === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
        </div>
      </div>
    </div>
  );
}
