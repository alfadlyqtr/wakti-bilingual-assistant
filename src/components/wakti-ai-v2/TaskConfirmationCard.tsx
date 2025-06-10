
import React from 'react';
import { Calendar, Clock, Flag, CheckCircle, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';

interface TaskConfirmationCardProps {
  type: 'task' | 'reminder';
  data: any;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  enhanced?: boolean; // Phase 3: Learning enhancement indicator
}

export function TaskConfirmationCard({ 
  type, 
  data, 
  onConfirm, 
  onCancel, 
  isLoading = false,
  enhanced = false 
}: TaskConfirmationCardProps) {
  const { language } = useTheme();

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return language === 'ar' 
      ? date.toLocaleDateString('ar-SA')
      : date.toLocaleDateString('en-US');
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'normal': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPriorityText = (priority: string) => {
    if (language === 'ar') {
      switch (priority) {
        case 'urgent': return 'عاجل';
        case 'high': return 'عالي';
        case 'normal': return 'عادي';
        default: return priority;
      }
    }
    return priority;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="font-medium text-sm text-gray-900">
              {type === 'task' 
                ? (language === 'ar' ? 'تأكيد المهمة' : 'Confirm Task')
                : (language === 'ar' ? 'تأكيد التذكير' : 'Confirm Reminder')
              }
            </span>
          </div>
          {/* Phase 3: Enhanced learning indicator */}
          {enhanced && (
            <div className="flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded text-xs text-blue-600">
              <Sparkles className="h-3 w-3" />
              {language === 'ar' ? 'محسن بالذكاء الاصطناعي' : 'AI Enhanced'}
            </div>
          )}
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

        {/* Details Grid */}
        <div className="grid grid-cols-1 gap-2">
          {/* Due Date */}
          {(data.due_date || data.suggestedDate) && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600">
                {language === 'ar' ? 'التاريخ:' : 'Date:'}
              </span>
              <span className="text-gray-900">
                {formatDate(data.due_date || data.suggestedDate)}
                {data.suggestedDate && !data.due_date && (
                  <span className="text-blue-600 text-xs ml-1">
                    ({language === 'ar' ? 'مقترح' : 'suggested'})
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Due Time (for reminders) */}
          {(data.due_time || data.suggestedTime) && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600">
                {language === 'ar' ? 'الوقت:' : 'Time:'}
              </span>
              <span className="text-gray-900">
                {data.due_time || data.suggestedTime}
                {data.suggestedTime && !data.due_time && (
                  <span className="text-blue-600 text-xs ml-1">
                    ({language === 'ar' ? 'مقترح' : 'suggested'})
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Priority (for tasks) */}
          {(data.priority || data.suggestedPriority) && type === 'task' && (
            <div className="flex items-center gap-2 text-sm">
              <Flag className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600">
                {language === 'ar' ? 'الأولوية:' : 'Priority:'}
              </span>
              <span 
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  getPriorityColor(data.priority || data.suggestedPriority)
                }`}
              >
                {getPriorityText(data.priority || data.suggestedPriority)}
                {data.suggestedPriority && !data.priority && (
                  <span className="text-blue-600 ml-1">
                    ({language === 'ar' ? 'مقترح' : 'suggested'})
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Phase 3: Smart suggestions or enhancements display */}
        {enhanced && data.smartSuggestions && (
          <div className="bg-blue-50 border border-blue-200 rounded p-2">
            <p className="text-xs text-blue-700 font-medium mb-1">
              {language === 'ar' ? 'تحسينات ذكية:' : 'Smart Enhancements:'}
            </p>
            <ul className="text-xs text-blue-600 space-y-1">
              {data.smartSuggestions.map((suggestion: string, index: number) => (
                <li key={index}>• {suggestion}</li>
              ))}
            </ul>
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
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                {language === 'ar' ? 'جاري الإنشاء...' : 'Creating...'}
              </div>
            ) : (
              language === 'ar' ? 'تأكيد الإنشاء' : 'Confirm & Create'
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
