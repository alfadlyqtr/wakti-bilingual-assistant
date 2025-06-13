import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { AIMessage } from '@/services/WaktiAIV2Service';

interface MessageBubbleProps {
  message: AIMessage;
  language: string;
}

export function MessageBubble({ message, language }: MessageBubbleProps) {
  const { theme } = useTheme();

  const isUser = message.role === 'user';
  const bubbleClass = isUser
    ? 'bg-blue-500 text-white ml-auto'
    : 'bg-gray-100 text-gray-900 mr-auto';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-xs sm:max-w-md lg:max-w-lg rounded-lg p-3 ${bubbleClass}`}>
        {message.imageUrl && (
          <div className="mb-2">
            <img 
              src={message.imageUrl} 
              alt="Generated image" 
              className="rounded-lg max-w-full h-auto"
            />
          </div>
        )}
        
        <div className="whitespace-pre-wrap text-sm">
          {message.content}
        </div>
        
        {message.browsingUsed && (
          <div className="mt-2 text-xs opacity-75">
            {language === 'ar' ? '🔍 تم البحث' : '🔍 Search used'}
          </div>
        )}
        
        {message.inputType === 'voice' && (
          <div className="mt-2 text-xs opacity-75">
            {language === 'ar' ? '🎤 رسالة صوتية' : '🎤 Voice message'}
          </div>
        )}
      </div>
    </div>
  );
}
