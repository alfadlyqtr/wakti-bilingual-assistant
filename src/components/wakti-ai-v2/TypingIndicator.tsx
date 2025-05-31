
import React from 'react';

export function TypingIndicator() {
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
          <span className="text-xs text-muted-foreground ml-2">
            WAKTI AI is thinking...
          </span>
        </div>
      </div>
    </div>
  );
}
