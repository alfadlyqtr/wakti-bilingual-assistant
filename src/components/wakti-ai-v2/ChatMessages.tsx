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

  // Auto-scroll to bottom when new messages arrive or streaming updates
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
            
            {sessionMessages.map((message, index) => {
              // Show enhanced streaming indicator for streaming messages
              if (message.isStreaming) {
                return (
                  <div key={message.id} className="flex justify-start px-2">
                    <div className="bg-muted rounded-2xl px-4 py-3 mr-12 max-w-[85%]">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {message.content}
                        <div className="inline-flex items-center ml-1">
                          <div className="flex space-x-1">
                            <div 
                              className="w-1 h-1 bg-primary rounded-full animate-bounce" 
                              style={{ animationDelay: '0ms' }} 
                            />
                            <div 
                              className="w-1 h-1 bg-primary rounded-full animate-bounce" 
                              style={{ animationDelay: '150ms' }} 
                            />
                            <div 
                              className="w-1 h-1 bg-primary rounded-full animate-bounce" 
                              style={{ animationDelay: '300ms' }} 
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // Show enhanced typing indicator for thinking messages
              if (message.isThinking) {
                return (
                  <div key={message.id} className="flex justify-start px-2">
                    <div className="bg-muted rounded-2xl px-4 py-3 mr-12 max-w-[85%]">
                      <div className="flex items-center gap-2">
                        <div className="flex space-x-1">
                          <div 
                            className="w-2 h-2 bg-primary rounded-full animate-bounce" 
                            style={{ animationDelay: '0ms' }} 
                          />
                          <div 
                            className="w-2 h-2 bg-primary rounded-full animate-bounce" 
                            style={{ animationDelay: '150ms' }} 
                          />
                          <div 
                            className="w-2 h-2 bg-primary rounded-full animate-bounce" 
                            style={{ animationDelay: '300ms' }} 
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {language === 'ar' ? 'WAKTI يفكر...' : 'WAKTI is thinking...'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <ChatBubble
                  key={message.id || index}
                  message={message}
                  userProfile={userProfile}
                  activeTrigger={activeTrigger}
                />
              );
            })}

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
