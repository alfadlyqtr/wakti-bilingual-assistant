
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';

interface TypingIndicatorProps {
  hasAttachedFiles?: boolean;
  isVisionProcessing?: boolean;
}

export function TypingIndicator({ hasAttachedFiles = false, isVisionProcessing = false }: TypingIndicatorProps) {
  const { language } = useTheme();

  const getLoadingMessage = () => {
    if (isVisionProcessing || hasAttachedFiles) {
      return language === 'ar' 
        ? 'وقتي يحلل الصورة...'
        : 'WAKTI AI is analyzing image...';
    }
    
    return language === 'ar' 
      ? 'وقتي يفكر...'
      : 'WAKTI AI is thinking...';
  };

  const getSubMessage = () => {
    if (isVisionProcessing || hasAttachedFiles) {
      return language === 'ar' 
        ? 'قد يستغرق هذا وقتاً أطول قليلاً'
        : 'This may take a bit longer';
    }
    
    return null;
  };

  return (
    <div className="flex justify-start mb-4">
      <div className="bg-muted rounded-2xl px-4 py-3 mr-12">
        <div className="flex items-center gap-1">
          <div className="flex space-x-1">
            <div 
              className="w-2 h-2 bg-current rounded-full animate-bounce" 
              style={{ animationDelay: '0ms' }} 
            />
            <div 
              className="w-2 h-2 bg-current rounded-full animate-bounce" 
              style={{ animationDelay: '150ms' }} 
            />
            <div 
              className="w-2 h-2 bg-current rounded-full animate-bounce" 
              style={{ animationDelay: '300ms' }} 
            />
          </div>
          <div className="ml-2">
            <span className="text-xs text-muted-foreground">
              {getLoadingMessage()}
            </span>
            {getSubMessage() && (
              <div className="text-xs text-muted-foreground/70 mt-1">
                {getSubMessage()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
