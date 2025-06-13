import React, { useEffect, useRef, forwardRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTheme } from '@/providers/ThemeProvider';
import { AIMessage } from '@/services/WaktiAIV2Service';
import { MessageBubble } from './MessageBubble';
import { TaskConfirmationCard } from './TaskConfirmationCard';
import { EditableTaskConfirmationCard } from './EditableTaskConfirmationCard';

interface ChatMessagesProps {
  sessionMessages: AIMessage[];
  conversationMessages: AIMessage[];
  isLoading: boolean;
  onTaskConfirm?: (taskData: any) => void;
  onTaskEdit?: (taskData: any) => void;
  onTaskCancel?: () => void;
}

export const ChatMessages = forwardRef<HTMLDivElement, ChatMessagesProps>(({
  sessionMessages,
  conversationMessages,
  isLoading,
  onTaskConfirm,
  onTaskEdit,
  onTaskCancel
}, ref) => {
  const { language } = useTheme();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Combine and sort all messages
  const allMessages = [...conversationMessages, ...sessionMessages]
    .filter((message, index, self) => 
      index === self.findIndex(m => 
        m.timestamp.getTime() === message.timestamp.getTime() && 
        m.content === message.content &&
        m.role === message.role
      )
    )
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [allMessages, isLoading]);

  const renderMessage = (message: AIMessage, index: number) => {
    // Show task confirmation card for messages that need confirmation
    if (message.role === 'assistant' && message.needsConfirmation && message.pendingTaskData) {
      return (
        <div key={`${message.id}-confirmation`} className="flex justify-start mb-4">
          <div className="max-w-xs sm:max-w-md lg:max-w-lg">
            <TaskConfirmationCard
              type="task"
              data={message.pendingTaskData}
              onConfirm={() => onTaskConfirm?.(message.pendingTaskData)}
              onCancel={() => onTaskCancel?.()}
              isLoading={false}
            />
          </div>
        </div>
      );
    }

    // Show editable task confirmation card for messages that need clarification
    if (message.role === 'assistant' && message.needsClarification && message.partialTaskData) {
      return (
        <div key={`${message.id}-editable`} className="flex justify-start mb-4">
          <div className="max-w-xs sm:max-w-md lg:max-w-lg">
            <EditableTaskConfirmationCard
              type="task"
              data={message.partialTaskData}
              onConfirm={(editedData) => onTaskEdit?.(editedData)}
              onCancel={() => onTaskCancel?.()}
              isLoading={false}
            />
          </div>
        </div>
      );
    }

    // Regular message bubble
    return (
      <MessageBubble
        key={message.id}
        message={message}
        language={language}
      />
    );
  };

  return (
    <ScrollArea 
      ref={scrollAreaRef}
      className="flex-1 p-4 h-full"
    >
      <div ref={ref} className="space-y-4">
        {allMessages.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-2xl mb-2">🤖</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {language === 'ar' ? 'مرحباً بك في WAKTI AI' : 'Welcome to WAKTI AI'}
              </h3>
              <p className="text-gray-600 text-sm">
                {language === 'ar' 
                  ? 'اسأل أي شيء، أو أطلب إنشاء مهام، أو ابحث عن معلومات!'
                  : 'Ask anything, create tasks, or search for information!'}
              </p>
            </div>
          </div>
        ) : (
          allMessages.map(renderMessage)
        )}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3 max-w-xs">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-sm text-gray-600">
                  {language === 'ar' ? 'جاري الكتابة...' : 'Typing...'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
});

ChatMessages.displayName = 'ChatMessages';
