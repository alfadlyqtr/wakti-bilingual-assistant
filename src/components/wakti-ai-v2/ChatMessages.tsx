
import React, { useEffect, useRef } from 'react';
import { AIMessage } from '@/services/WaktiAIV2Service';
import { useTheme } from '@/providers/ThemeProvider';
import { WelcomeMessage } from './WelcomeMessage';
import { MessageBubble } from './MessageBubble';

interface ChatMessagesProps {
  sessionMessages: AIMessage[];
  isLoading: boolean;
  activeTrigger: string;
  scrollAreaRef: React.RefObject<HTMLDivElement>;
  userProfile: any;
  personalTouch: any;
  conversationId: string | null;
  isNewConversation: boolean;
}

export function ChatMessages({ 
  sessionMessages, 
  isLoading, 
  activeTrigger,
  scrollAreaRef,
  userProfile,
  personalTouch,
  conversationId,
  isNewConversation
}: ChatMessagesProps) {
  const { language } = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [sessionMessages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {sessionMessages.length === 0 && (
        <WelcomeMessage 
          userProfile={userProfile}
          personalTouch={personalTouch}
          activeTrigger={activeTrigger}
        />
      )}
      
      {sessionMessages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          conversationId={conversationId}
        />
      ))}
      
      {isLoading && (
        <div className="flex justify-start">
          <div className="max-w-xs lg:max-w-md bg-gray-100 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
              <span className="text-xs text-gray-500">
                {language === 'ar' ? 'جاري التفكير...' : 'Thinking...'}
              </span>
            </div>
          </div>
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  );
}
