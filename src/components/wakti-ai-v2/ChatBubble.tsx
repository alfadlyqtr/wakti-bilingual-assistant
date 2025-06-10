
import React, { useState } from 'react';
import { Bot, User, Copy, CheckCheck, Search, AlertTriangle, Calendar, Clock, Lightbulb, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';
import { AIMessage } from '@/services/WaktiAIV2Service';
import { TaskConfirmationCard } from './TaskConfirmationCard';
import { WaktiAIV2Service } from '@/services/WaktiAIV2Service';
import { useToastHelper } from "@/hooks/use-toast-helper";
import { supabase } from '@/integrations/supabase/client';

interface ChatBubbleProps {
  message: AIMessage;
  activeTrigger: string;
}

export function ChatBubble({ message, activeTrigger }: ChatBubbleProps) {
  const { language } = useTheme();
  const { showSuccess, showError } = useToastHelper();
  const [copied, setCopied] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const formatTime = (timestamp: Date) => {
    return new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: language !== 'ar'
    }).format(timestamp);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showSuccess(language === 'ar' ? 'تم النسخ بنجاح' : 'Copied successfully');
    } catch (error) {
      showError(language === 'ar' ? 'فشل في النسخ' : 'Failed to copy');
    }
  };

  const handleTaskConfirmation = async (pendingTask: any) => {
    setIsConfirming(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const response = await WaktiAIV2Service.confirmTaskCreation(
        user.id,
        language,
        pendingTask
      );

      if (response.error) {
        throw new Error(response.error);
      }

      showSuccess(
        language === 'ar' ? 'تم إنشاء المهمة بنجاح' : 'Task created successfully'
      );

      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error: any) {
      console.error('Error confirming task:', error);
      showError(
        error.message || (language === 'ar' ? 'فشل في إنشاء المهمة' : 'Failed to create task')
      );
    } finally {
      setIsConfirming(false);
    }
  };

  const handleReminderConfirmation = async (pendingReminder: any) => {
    setIsConfirming(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const response = await WaktiAIV2Service.confirmReminderCreation(
        user.id,
        language,
        pendingReminder
      );

      if (response.error) {
        throw new Error(response.error);
      }

      showSuccess(
        language === 'ar' ? 'تم إنشاء التذكير بنجاح' : 'Reminder created successfully'
      );

      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error: any) {
      console.error('Error confirming reminder:', error);
      showError(
        error.message || (language === 'ar' ? 'فشل في إنشاء التذكير' : 'Failed to create reminder')
      );
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancelConfirmation = () => {
    showSuccess(
      language === 'ar' ? 'تم إلغاء العملية' : 'Operation cancelled'
    );
  };

  // Phase 3: Enhanced detection for all action types with learning
  const hasPendingTask = (message.actionTaken === 'parse_task' || message.actionTaken === 'parse_task_with_learning') && message.actionResult?.pendingTask;
  const hasPendingReminder = (message.actionTaken === 'parse_reminder' || message.actionTaken === 'parse_reminder_with_learning') && message.actionResult?.pendingReminder;
  const hasSearchSuggestion = (message.actionTaken === 'search_suggestion' || message.actionTaken === 'enhanced_search_suggestion') && message.actionResult?.suggestion;
  const hasDuplicateWarning = (message.actionTaken === 'duplicate_warning' || message.actionTaken === 'smart_duplicate_warning') && message.actionResult?.duplicateTask;
  const hasProductivitySuggestion = message.actionTaken === 'productivity_suggestion' && message.actionResult?.suggestions;
  // Fix: Check for string type before using includes()
  const needsClarification = typeof message.actionTaken === 'string' && (message.actionTaken.includes('clarify') || message.actionTaken.includes('clarify_task_with_learning') || message.actionTaken.includes('clarify_reminder_with_learning'));

  return (
    <div className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      {message.role === 'assistant' && (
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary" />
          </div>
        </div>
      )}
      
      <div className={`max-w-[80%] ${message.role === 'user' ? 'order-2' : ''}`}>
        <div
          className={`rounded-2xl px-4 py-3 ${
            message.role === 'user'
              ? 'bg-primary text-primary-foreground ml-auto'
              : 'bg-muted'
          }`}
        >
          <div className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </div>
          
          {/* Phase 3: Enhanced search suggestion UI with learning */}
          {hasSearchSuggestion && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700 mb-2">
                <Search className="h-4 w-4" />
                <span className="font-medium text-sm">
                  {language === 'ar' ? 'اقتراح بحث ذكي' : 'Smart Search Suggestion'}
                </span>
              </div>
              <p className="text-sm text-blue-600 mb-3">
                {message.actionResult.suggestion}
              </p>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  // This would trigger the mode switch - implementation depends on parent component
                  console.log('Switch to search mode');
                }}
              >
                {language === 'ar' ? 'التبديل إلى وضع البحث' : 'Switch to Search Mode'}
              </Button>
            </div>
          )}

          {/* Phase 3: Smart duplicate task warning UI with similarity scoring */}
          {hasDuplicateWarning && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 text-amber-700 mb-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium text-sm">
                  {language === 'ar' ? 'تحذير ذكي: مهمة مشابهة موجودة' : 'Smart Warning: Similar Task Exists'}
                </span>
                {message.actionResult.similarity && (
                  <span className="text-xs bg-amber-200 px-2 py-1 rounded">
                    {Math.round(message.actionResult.similarity * 100)}% {language === 'ar' ? 'تشابه' : 'similarity'}
                  </span>
                )}
              </div>
              <div className="text-sm text-amber-600 mb-3">
                <p className="font-medium">{language === 'ar' ? 'المهمة الموجودة:' : 'Existing task:'}</p>
                <p>• {message.actionResult.duplicateTask.title}</p>
                {message.actionResult.duplicateTask.due_date && (
                  <p className="text-xs text-amber-500 mt-1">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    {new Date(message.actionResult.duplicateTask.due_date).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-100"
                >
                  {language === 'ar' ? 'إنشاء مهمة جديدة' : 'Create New Task'}
                </Button>
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {language === 'ar' ? 'تحديث الموجودة' : 'Update Existing'}
                </Button>
              </div>
            </div>
          )}

          {/* Phase 3: New productivity suggestion UI */}
          {hasProductivitySuggestion && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 mb-2">
                <TrendingUp className="h-4 w-4" />
                <span className="font-medium text-sm">
                  {language === 'ar' ? 'اقتراح إنتاجية ذكي' : 'Smart Productivity Suggestion'}
                </span>
              </div>
              <div className="text-sm text-green-600 mb-3">
                {message.actionResult.suggestions && message.actionResult.suggestions.map((suggestion: any, index: number) => (
                  <div key={index} className="flex items-start gap-2 mb-2">
                    <Lightbulb className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>{suggestion.text}</span>
                  </div>
                ))}
              </div>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {language === 'ar' ? 'تطبيق الاقتراحات' : 'Apply Suggestions'}
              </Button>
            </div>
          )}

          {/* Phase 3: Enhanced clarification needed UI with learning context */}
          {needsClarification && (
            <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center gap-2 text-purple-700 mb-2">
                <Clock className="h-4 w-4" />
                <span className="font-medium text-sm">
                  {language === 'ar' ? 'معلومات إضافية مطلوبة' : 'Additional Information Needed'}
                </span>
                {message.actionResult?.learningContext && (
                  <span className="text-xs bg-purple-200 px-2 py-1 rounded">
                    {language === 'ar' ? 'ذكي' : 'Smart'}
                  </span>
                )}
              </div>
              {message.actionResult?.missingFields && (
                <div className="text-sm text-purple-600 mb-3">
                  <p className="mb-2">{language === 'ar' ? 'المعلومات المطلوبة:' : 'Required information:'}</p>
                  <ul className="list-disc list-inside space-y-1">
                    {message.actionResult.missingFields.map((field: string, index: number) => (
                      <li key={index}>
                        {field === 'due_date' ? (language === 'ar' ? 'تاريخ الاستحقاق' : 'Due date') : 
                         field === 'priority' ? (language === 'ar' ? 'الأولوية' : 'Priority') :
                         field === 'due_time' ? (language === 'ar' ? 'وقت التذكير' : 'Reminder time') : field}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          
          {/* Enhanced confirmation cards for parsed tasks/reminders with learning */}
          {hasPendingTask && (
            <div className="mt-3">
              <TaskConfirmationCard
                type="task"
                data={message.actionResult.pendingTask}
                onConfirm={() => handleTaskConfirmation(message.actionResult.pendingTask)}
                onCancel={handleCancelConfirmation}
                isLoading={isConfirming}
                enhanced={message.actionResult.learningEnhancements}
              />
            </div>
          )}
          
          {hasPendingReminder && (
            <div className="mt-3">
              <TaskConfirmationCard
                type="reminder"
                data={message.actionResult.pendingReminder}
                onConfirm={() => handleReminderConfirmation(message.actionResult.pendingReminder)}
                onCancel={handleCancelConfirmation}
                isLoading={isConfirming}
                enhanced={message.actionResult.learningEnhancements}
              />
            </div>
          )}

          {/* Phase 3: Display proactive actions if available */}
          {message.proactiveActions && message.proactiveActions.length > 0 && (
            <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
              <div className="flex items-center gap-2 text-indigo-700 mb-2">
                <Lightbulb className="h-4 w-4" />
                <span className="font-medium text-sm">
                  {language === 'ar' ? 'اقتراحات ذكية' : 'Smart Suggestions'}
                </span>
              </div>
              <div className="space-y-2">
                {message.proactiveActions.map((action: any, index: number) => (
                  <div key={index} className="text-sm text-indigo-600">
                    {action.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {message.role === 'assistant' && (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-muted-foreground/20">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatTime(message.timestamp)}
                </span>
                {/* Phase 3: Show learning indicator */}
                {(message.actionTaken?.includes('with_learning') || message.userProfile) && (
                  <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">
                    {language === 'ar' ? 'ذكي' : 'Smart'}
                  </span>
                )}
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-6 px-2 text-xs hover:bg-muted-foreground/20"
              >
                {copied ? (
                  <>
                    <CheckCheck className="h-3 w-3 mr-1" />
                    {language === 'ar' ? 'تم' : 'Copied'}
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    {language === 'ar' ? 'نسخ' : 'Copy'}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
      
      {message.role === 'user' && (
        <div className="flex-shrink-0 order-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="h-4 w-4 text-primary" />
          </div>
        </div>
      )}
    </div>
  );
}
