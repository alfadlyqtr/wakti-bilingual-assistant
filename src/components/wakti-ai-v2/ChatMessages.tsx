
import React, { useEffect, useRef } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { ChatBubble } from './ChatBubble';
import { TypingIndicator } from './TypingIndicator';
import { TaskConfirmationCard } from './TaskConfirmationCard';
import { EditableTaskConfirmationCard } from './EditableTaskConfirmationCard';
import { AIMessage } from '@/services/WaktiAIV2Service';

interface ChatMessagesProps {
  sessionMessages: AIMessage[];
  isLoading: boolean;
  activeTrigger: string;
  scrollAreaRef: React.RefObject<any>;
  userProfile: any;
  showTaskConfirmation: boolean;
  pendingTaskData: any;
  pendingReminderData: any;
  taskConfirmationLoading: boolean;
  onTaskConfirmation: (taskData: any) => void;
  onReminderConfirmation: (reminderData: any) => void;
  onCancelTaskConfirmation: () => void;
}

export function ChatMessages({
  sessionMessages,
  isLoading,
  activeTrigger,
  scrollAreaRef,
  userProfile,
  showTaskConfirmation,
  pendingTaskData,
  pendingReminderData,
  taskConfirmationLoading,
  onTaskConfirmation,
  onReminderConfirmation,
  onCancelTaskConfirmation,
}: ChatMessagesProps) {
  const { language } = useTheme();

  // ENHANCED: Improved auto-scroll to reliably show latest message
  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          // Use multiple methods to ensure reliable scrolling
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
          
          // Backup scroll method with slight delay
          setTimeout(() => {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
          }, 50);
          
          // Force scroll with requestAnimationFrame for better reliability
          requestAnimationFrame(() => {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
          });
        }
      }
    };

    // Immediate scroll
    scrollToBottom();

    // Additional scroll with delay to handle dynamic content
    const timeoutId = setTimeout(scrollToBottom, 100);

    return () => clearTimeout(timeoutId);
  }, [sessionMessages, isLoading, showTaskConfirmation, scrollAreaRef]);

  // Check if the last user message has attached files for better loading indicator
  const lastUserMessage = sessionMessages.filter(msg => msg.role === 'user').pop();
  const hasAttachedFiles = lastUserMessage?.attachedFiles && lastUserMessage.attachedFiles.length > 0;

  return (
    <div className="flex-1 p-4 space-y-4 max-w-4xl mx-auto w-full pb-16">
      {sessionMessages.length === 0 && !isLoading && (
        <div className="text-center text-muted-foreground py-12">
          <div className="text-2xl mb-2">🤖</div>
          <p className="text-lg font-medium mb-2">
            {language === 'ar' ? 'مرحباً! أنا وقتي AI' : 'Hello! I\'m WAKTI AI'}
          </p>
          <p className="text-sm">
            {language === 'ar' 
              ? 'كيف يمكنني مساعدتك اليوم؟'
              : 'How can I help you today?'
            }
          </p>
        </div>
      )}

      {sessionMessages.map((message, index) => (
        <div key={message.id}>
          <ChatBubble
            message={message}
            userProfile={userProfile}
            activeTrigger={activeTrigger}
          />
        </div>
      ))}

      {isLoading && (
        <div>
          <TypingIndicator 
            hasAttachedFiles={hasAttachedFiles}
            isVisionProcessing={hasAttachedFiles}
          />
        </div>
      )}

      {showTaskConfirmation && (pendingTaskData || pendingReminderData) && (
        <div className="flex justify-start">
          <div className="max-w-md">
            <EditableTaskConfirmationCard
              data={pendingTaskData || pendingReminderData}
              isLoading={taskConfirmationLoading}
              onConfirm={pendingTaskData ? onTaskConfirmation : onReminderConfirmation}
              onCancel={onCancelTaskConfirmation}
              type={pendingTaskData ? 'task' : 'reminder'}
            />
          </div>
        </div>
      )}
    </div>
  );
}

