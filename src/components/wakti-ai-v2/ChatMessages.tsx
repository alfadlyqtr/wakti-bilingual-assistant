
import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { ChatBubble } from './ChatBubble';
import { TypingIndicator } from './TypingIndicator';
import { TaskConfirmationCard } from './TaskConfirmationCard';
import { EditableTaskConfirmationCard } from './EditableTaskConfirmationCard';
import { ScrollToBottomButton } from './ScrollToBottomButton';
import { AIMessage } from '@/services/WaktiAIV2Service';

interface ChatMessagesProps {
  sessionMessages: AIMessage[];
  isLoading: boolean;
  activeTrigger: string;
  scrollAreaRef: React.RefObject<any>;
  userProfile: any;
  personalTouch: any;
  showTaskConfirmation: boolean;
  pendingTaskData: any;
  pendingReminderData: any;
  taskConfirmationLoading: boolean;
  onTaskConfirmation: (taskData: any) => void;
  onReminderConfirmation: (reminderData: any) => void;
  onCancelTaskConfirmation: () => void;
  conversationId?: string | null;
  isNewConversation?: boolean;
}

export function ChatMessages({
  sessionMessages,
  isLoading,
  activeTrigger,
  scrollAreaRef,
  userProfile,
  personalTouch,
  showTaskConfirmation,
  pendingTaskData,
  pendingReminderData,
  taskConfirmationLoading,
  onTaskConfirmation,
  onReminderConfirmation,
  onCancelTaskConfirmation,
  conversationId,
  isNewConversation = false,
}: ChatMessagesProps) {
  const { language } = useTheme();
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Limit messages to last 70 for optimal performance and memory usage
  const displayMessages = sessionMessages.slice(-70);

  // Check if user is at bottom of scroll
  const checkIfAtBottom = () => {
    if (scrollAreaRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 100; // 100px threshold
      setIsAtBottom(atBottom);
      setShowScrollButton(!atBottom && displayMessages.length > 0);
    }
  };

  // Scroll to bottom function
  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  // Add scroll listener
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', checkIfAtBottom);
      return () => scrollContainer.removeEventListener('scroll', checkIfAtBottom);
    }
  }, [scrollAreaRef]);

  // ENHANCED: Robust auto-scroll to always show latest message
  useEffect(() => {
    const scrollToBottomInstant = () => {
      if (scrollAreaRef.current && isAtBottom) {
        // Clear any existing timeout
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }

        // Use requestAnimationFrame for smooth scrolling
        requestAnimationFrame(() => {
          if (scrollAreaRef.current) {
            // Direct scroll for simple div container
            scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
            
            // Also handle Radix ScrollArea if it exists
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
              scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
          }
        });

        // Additional delayed scroll for dynamic content and images
        scrollTimeoutRef.current = setTimeout(() => {
          if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
            
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
              scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
          }
        }, 150);
      }
    };

    // Only auto-scroll if user was already at bottom
    if (isAtBottom) {
      scrollToBottomInstant();
    }

    // Cleanup timeout on unmount
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [displayMessages, isLoading, showTaskConfirmation, isAtBottom]);

  // Check if the last user message has attached files for better loading indicator
  const lastUserMessage = displayMessages.filter(msg => msg.role === 'user').pop();
  const hasAttachedFiles = lastUserMessage?.attachedFiles && lastUserMessage.attachedFiles.length > 0;

  // FIXED: Get AI nickname from personalTouch, fallback to "WAKTI AI"
  const aiNickname = personalTouch?.aiNickname || 'WAKTI AI';

  return (
    <>
      <div className="flex-1 p-4 space-y-4 max-w-4xl mx-auto w-full pb-32">
        {displayMessages.length === 0 && !isLoading && (
          <div className="text-center text-muted-foreground py-12">
            <div className="text-2xl mb-2">🤖</div>
            <p className="text-lg font-medium mb-2">
              {language === 'ar' ? `مرحباً! أنا ${aiNickname}` : `Hello! I'm ${aiNickname}`}
            </p>
            <p className="text-sm mb-4">
              {language === 'ar' 
                ? 'كيف يمكنني مساعدتك اليوم؟'
                : 'How can I help you today?'
              }
            </p>
          </div>
        )}

        {displayMessages.map((message, index) => (
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

      {/* Scroll to bottom button */}
      <ScrollToBottomButton 
        visible={showScrollButton} 
        onClick={scrollToBottom}
      />
    </>
  );
}
