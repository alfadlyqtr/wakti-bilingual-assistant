
import React, { useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatBubble } from './ChatBubble';
import { TypingIndicator } from './TypingIndicator';
import { EditableTaskConfirmationCard } from './EditableTaskConfirmationCard';
import { useTheme } from '@/providers/ThemeProvider';

interface ChatMessagesProps {
  sessionMessages: any[];
  isLoading: boolean;
  activeTrigger: string;
  scrollAreaRef: any;
  userProfile: any;
  showTaskConfirmation?: boolean;
  pendingTaskData?: any;
  pendingReminderData?: any;
  taskConfirmationLoading?: boolean;
  onTaskConfirmation?: (taskData: any) => void;
  onReminderConfirmation?: (reminderData: any) => void;
  onCancelTaskConfirmation?: () => void;
}

export function ChatMessages({ 
  sessionMessages, 
  isLoading, 
  activeTrigger, 
  scrollAreaRef,
  userProfile,
  showTaskConfirmation = false,
  pendingTaskData = null,
  pendingReminderData = null,
  taskConfirmationLoading = false,
  onTaskConfirmation,
  onReminderConfirmation,
  onCancelTaskConfirmation
}: ChatMessagesProps) {
  const { language } = useTheme();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [sessionMessages, isLoading, showTaskConfirmation]);

  return (
    <div className="h-full w-full">
      <ScrollArea ref={scrollAreaRef} className="h-full w-full">
        <div className="p-2 pb-8 min-h-full">
          <div className="w-full space-y-4">
            {sessionMessages.length === 0 && !showTaskConfirmation && (
              <div className="text-center py-8">
                <div className="text-muted-foreground text-sm">
                  {language === 'ar' 
                    ? 'ابدأ محادثة جديدة...' 
                    : 'Start a new conversation...'
                  }
                </div>
              </div>
            )}
            
            {sessionMessages.map((message, index) => (
              <ChatBubble
                key={message.id || index}
                message={message}
                userProfile={userProfile}
                activeTrigger={activeTrigger}
              />
            ))}

            {/* Enhanced Task/Reminder Confirmation Card */}
            {showTaskConfirmation && (pendingTaskData || pendingReminderData) && (
              <div className="flex justify-start px-2">
                <div className="max-w-[85%]">
                  <EditableTaskConfirmationCard
                    type={pendingTaskData ? 'task' : 'reminder'}
                    data={pendingTaskData || pendingReminderData}
                    onConfirm={pendingTaskData ? onTaskConfirmation! : onReminderConfirmation!}
                    onCancel={onCancelTaskConfirmation!}
                    isLoading={taskConfirmationLoading}
                  />
                </div>
              </div>
            )}

            {isLoading && (
              <div className="flex justify-start px-2">
                <TypingIndicator />
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
