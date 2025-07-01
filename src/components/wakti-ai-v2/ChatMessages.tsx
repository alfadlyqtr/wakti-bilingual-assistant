
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
  const lastMessageRef = useRef<HTMLDivElement>(null);

  // Check if the last user message has attached files for better loading indicator
  const lastUserMessage = sessionMessages.filter(msg => msg.role === 'user').pop();
  const hasAttachedFiles = lastUserMessage?.attachedFiles && lastUserMessage.attachedFiles.length > 0;

  // FIXED: Auto-scroll using scrollIntoView on the last message
  useEffect(() => {
    if (lastMessageRef.current) {
      requestAnimationFrame(() => {
        lastMessageRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'end' 
        });
      });
    }
  }, [sessionMessages, isLoading, showTaskConfirmation]);

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
        <div
          key={message.id}
          ref={index === sessionMessages.length - 1 ? lastMessageRef : null}
        >
          <ChatBubble
            message={message}
            userProfile={userProfile}
            activeTrigger={activeTrigger}
          />
        </div>
      ))}

      {isLoading && (
        <div ref={!sessionMessages.length ? lastMessageRef : null}>
          <TypingIndicator 
            hasAttachedFiles={hasAttachedFiles}
            isVisionProcessing={hasAttachedFiles}
          />
        </div>
      )}

      {showTaskConfirmation && (pendingTaskData || pendingReminderData) && (
        <div className="flex justify-start" ref={lastMessageRef}>
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
