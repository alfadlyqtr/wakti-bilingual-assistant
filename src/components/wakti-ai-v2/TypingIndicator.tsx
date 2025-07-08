
import React from 'react';
import { Bot } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';

export function TypingIndicator() {
  const { language } = useTheme();

  return (
    <div className="flex gap-3 justify-start mb-4">
      <div className="flex-shrink-0">
        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
      </div>
      
      <div className="max-w-[80%]">
        <div className="rounded-lg px-4 py-3 bg-card border-border border">
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground">
              {language === 'ar' ? 'WAKTI يكتب' : 'WAKTI is typing'}
            </span>
            <div className="flex space-x-1">
              <div 
                className="w-2 h-2 bg-primary rounded-full animate-bounce"
                style={{ animationDelay: '0s', animationDuration: '1.4s' }}
              />
              <div 
                className="w-2 h-2 bg-primary rounded-full animate-bounce"
                style={{ animationDelay: '0.2s', animationDuration: '1.4s' }}
              />
              <div 
                className="w-2 h-2 bg-primary rounded-full animate-bounce"
                style={{ animationDelay: '0.4s', animationDuration: '1.4s' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
