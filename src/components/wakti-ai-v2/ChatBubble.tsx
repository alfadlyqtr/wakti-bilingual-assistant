
import React, { useState } from 'react';
import { Bot, User, Copy, CheckCheck, AlertTriangle, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';
import { AIMessage } from '@/services/WaktiAIV2Service';
import { TaskConfirmationCard } from './TaskConfirmationCard';
import { ImageModal } from './ImageModal';
import { WaktiAIV2Service } from '@/services/WaktiAIV2Service';
import { useToastHelper } from "@/hooks/use-toast-helper";
import { supabase } from '@/integrations/supabase/client';

interface ChatBubbleProps {
  message: AIMessage;
  activeTrigger: string;
  userProfile?: any;
}

export function ChatBubble({ message, activeTrigger, userProfile }: ChatBubbleProps) {
  const { language } = useTheme();
  const { showSuccess, showError } = useToastHelper();
  const [copied, setCopied] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);

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

  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
  };

  const addSuccessMessageToChat = (successContent: string) => {
    // Get current session from localStorage
    const savedSession = WaktiAIV2Service.loadChatSession();
    const currentMessages = savedSession?.messages || [];
    
    // Create success message
    const successMessage: AIMessage = {
      id: `success-${Date.now()}`,
      role: 'assistant',
      content: successContent,
      timestamp: new Date(),
      intent: 'task_created_success',
      confidence: 'high',
      actionTaken: true
    };

    // Add success message to session
    const updatedMessages = [...currentMessages, successMessage];
    
    // Save updated session
    WaktiAIV2Service.saveChatSession(updatedMessages, savedSession?.conversationId || null);
    
    // Reload to show the new message
    setTimeout(() => {
      window.location.reload();
    }, 1000);
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

      // Add success message to chat with thumbs up
      const successContent = language === 'ar' 
        ? '👍 تم إنشاء المهمة بنجاح! يرجى زيارة صفحة المهام والتذكيرات'
        : '👍 Task created successfully! Please visit T & R page';
      
      addSuccessMessageToChat(successContent);

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

      // Add success message to chat with thumbs up
      const successContent = language === 'ar' 
        ? '👍 تم إنشاء التذكير بنجاح! يرجى زيارة صفحة المهام والتذكيرات'
        : '👍 Reminder created successfully! Please visit T & R page';
      
      addSuccessMessageToChat(successContent);

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

  // Simple detection for basic task/reminder confirmation
  const hasPendingTask = (message.actionTaken === 'parse_task' || message.actionTaken === 'parse_task_with_learning') && message.actionResult?.pendingTask;
  const hasPendingReminder = (message.actionTaken === 'parse_reminder' || message.actionTaken === 'parse_reminder_with_learning') && message.actionResult?.pendingReminder;
  const hasDuplicateWarning = (message.actionTaken === 'duplicate_warning' || message.actionTaken === 'smart_duplicate_warning') && message.actionResult?.duplicateTask;
  
  const needsClarification = typeof message.actionTaken === 'string' && (
    message.actionTaken.includes('clarify') || 
    message.actionTaken.includes('clarify_task_with_learning') || 
    message.actionTaken.includes('clarify_reminder_with_learning')
  );

  // Simple confirmation detection
  const needsTaskConfirmation = message.needsConfirmation && message.pendingTaskData;
  const needsReminderConfirmation = message.needsConfirmation && message.pendingReminderData;
  
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

          {/* Generated Image Display */}
          {message.imageUrl && (
            <div className="mt-3">
              <div className="relative rounded-lg overflow-hidden border border-border group cursor-pointer">
                {imageLoading && (
                  <div className="absolute inset-0 bg-muted flex items-center justify-center">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="h-4 w-4 animate-pulse bg-muted-foreground rounded" />
                      <span className="text-sm">
                        {language === 'ar' ? 'جارٍ تحميل الصورة...' : 'Loading image...'}
                      </span>
                    </div>
                  </div>
                )}
                {imageError ? (
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm">
                        {language === 'ar' ? 'فشل في تحميل الصورة' : 'Failed to load image'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="relative" onClick={() => setImageModalOpen(true)}>
                    <img
                      src={message.imageUrl}
                      alt="Generated image"
                      className="w-full h-auto max-w-md"
                      onLoad={handleImageLoad}
                      onError={handleImageError}
                      style={{ display: imageLoading ? 'none' : 'block' }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Task Confirmation Card */}
          {needsTaskConfirmation && (
            <div className="mt-3">
              <TaskConfirmationCard
                type="task"
                data={message.pendingTaskData}
                onConfirm={() => handleTaskConfirmation(message.pendingTaskData)}
                onCancel={handleCancelConfirmation}
                isLoading={isConfirming}
              />
            </div>
          )}

          {/* Reminder Confirmation Card */}
          {needsReminderConfirmation && (
            <div className="mt-3">
              <TaskConfirmationCard
                type="reminder"
                data={message.pendingReminderData}
                onConfirm={() => handleReminderConfirmation(message.pendingReminderData)}
                onCancel={handleCancelConfirmation}
                isLoading={isConfirming}
              />
            </div>
          )}

          {/* Simple duplicate task warning */}
          {hasDuplicateWarning && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 text-amber-700 mb-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium text-sm">
                  {language === 'ar' ? 'تحذير: مهمة مشابهة موجودة' : 'Warning: Similar Task Exists'}
                </span>
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
            </div>
          )}

          {/* Simple clarification needed */}
          {needsClarification && (
            <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center gap-2 text-purple-700 mb-2">
                <Clock className="h-4 w-4" />
                <span className="font-medium text-sm">
                  {language === 'ar' ? 'معلومات إضافية مطلوبة' : 'Additional Information Needed'}
                </span>
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
          
          {/* Simple confirmation cards for parsed tasks/reminders */}
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
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatTime(message.timestamp)}
                </span>
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
        <div className="flex-shrink-0 order-1">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <User className="h-4 w-4 text-primary-foreground" />
          </div>
        </div>
      )}

      {/* Image Modal */}
      {message.imageUrl && (
        <ImageModal
          isOpen={imageModalOpen}
          onClose={() => setImageModalOpen(false)}
          imageUrl={message.imageUrl}
          prompt={message.content}
        />
      )}
    </div>
  );
}
