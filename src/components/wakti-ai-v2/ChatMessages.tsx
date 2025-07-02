
import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { ChatBubble } from './ChatBubble';
import { TypingIndicator } from './TypingIndicator';
import { TaskConfirmationCard } from './TaskConfirmationCard';
import { EditableTaskConfirmationCard } from './EditableTaskConfirmationCard';
import { AIMessage } from '@/services/WaktiAIV2Service';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';

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
}: ChatMessagesProps) {
  const { language } = useTheme();
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Check if user is near bottom of chat
  const checkScrollPosition = () => {
    if (scrollAreaRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom && sessionMessages.length > 3);
    }
  };

  // Handle scroll events
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', checkScrollPosition);
      return () => scrollContainer.removeEventListener('scroll', checkScrollPosition);
    }
  }, [sessionMessages.length]);

  // ENHANCED: Robust auto-scroll to always show latest message
  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollAreaRef.current) {
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

    // Immediate scroll
    scrollToBottom();

    // Cleanup timeout on unmount
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [sessionMessages, isLoading, showTaskConfirmation]);

  // Manual scroll to bottom function
  const handleScrollToBottom = () => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth'
      });
      setShowScrollButton(false);
    }
  };

  // Check if the last user message has attached files for better loading indicator
  const lastUserMessage = sessionMessages.filter(msg => msg.role === 'user').pop();
  const hasAttachedFiles = lastUserMessage?.attachedFiles && lastUserMessage.attachedFiles.length > 0;

  // FIXED: Get AI nickname from personalTouch, fallback to "WAKTI AI"
  const aiNickname = personalTouch?.aiNickname || 'WAKTI AI';

  return (
    <div className="relative flex-1 p-4 space-y-4 max-w-4xl mx-auto w-full pb-16">
      {sessionMessages.length === 0 && !isLoading && (
        <div className="text-center text-muted-foreground py-12">
          <div className="text-2xl mb-2">🤖</div>
          <p className="text-lg font-medium mb-2">
            {language === 'ar' ? `مرحباً! أنا ${aiNickname}` : `Hello! I'm ${aiNickname}`}
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

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <div className="fixed bottom-32 right-6 z-40">
          <Button
            onClick={handleScrollToBottom}
            size="icon"
            className="h-10 w-10 rounded-full bg-primary/90 hover:bg-primary shadow-lg backdrop-blur-sm border border-white/20 transition-all duration-200 hover:scale-110"
            aria-label={language === 'ar' ? 'انتقل إلى الأسفل' : 'Scroll to bottom'}
          >
            <ChevronDown className="h-5 w-5" />
          </Button>
        </div>
      )}
    </div>
  );
}
