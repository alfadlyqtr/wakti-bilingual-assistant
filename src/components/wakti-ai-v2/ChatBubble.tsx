import React, { useState } from 'react';
import { Bot, User, Copy, CheckCheck } from 'lucide-react';
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

      // The parent component will handle updating the conversation
      // Force a page reload to refresh the T&R page data
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

      // Force a page reload to refresh the T&R page data
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
    // Just dismiss the confirmation UI
    showSuccess(
      language === 'ar' ? 'تم إلغاء العملية' : 'Operation cancelled'
    );
  };

  // Check if this message has pending task/reminder data
  const hasPendingTask = message.actionTaken === 'parse_task' && message.actionResult?.pendingTask;
  const hasPendingReminder = message.actionTaken === 'parse_reminder' && message.actionResult?.pendingReminder;

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
          
          {/* Show confirmation cards for parsed tasks/reminders */}
          {hasPendingTask && (
            <div className="mt-3">
              <TaskConfirmationCard
                type="task"
                data={message.actionResult.pendingTask}
                onConfirm={() => handleTaskConfirmation(message.actionResult.pendingTask)}
                onCancel={handleCancelConfirmation}
                isLoading={isConfirming}
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
              />
            </div>
          )}

          {message.role === 'assistant' && (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-muted-foreground/20">
              <span className="text-xs text-muted-foreground">
                {formatTime(message.timestamp)}
              </span>
              
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
