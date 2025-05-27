
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { AIMessage } from '@/services/WaktiAIV2Service';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ChatBubbleProps {
  message: AIMessage;
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const { theme, language } = useTheme();
  
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  
  const formatTime = (timestamp: Date) => {
    return new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(timestamp);
  };

  const getConfidenceColor = (confidence?: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getInputTypeIcon = (inputType?: string) => {
    switch (inputType) {
      case 'voice': return '🎤';
      case 'text': return '💬';
      default: return '';
    }
  };

  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <div className="backdrop-blur-md border border-border/50 rounded-2xl shadow-xl p-3 bg-muted/80 text-muted-foreground text-sm text-center max-w-md">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex gap-3 mb-4",
      isUser ? "justify-end" : "justify-start"
    )}>
      {!isUser && (
        <Avatar className="h-8 w-8 mt-1">
          <AvatarImage src="/placeholder.svg" />
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
            AI
          </AvatarFallback>
        </Avatar>
      )}
      
      <div className={cn(
        "max-w-[80%] sm:max-w-[70%]",
        isUser ? "order-1" : "order-2"
      )}>
        <div className={cn(
          "backdrop-blur-md border border-border/50 rounded-2xl shadow-xl p-3",
          isUser 
            ? "bg-primary text-primary-foreground ml-auto" 
            : "bg-background/90"
        )}>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {message.content}
          </div>
          
          {/* Message metadata */}
          <div className={cn(
            "flex items-center gap-2 mt-2 text-xs opacity-70",
            isUser ? "justify-end" : "justify-start"
          )}>
            <span>{formatTime(message.timestamp)}</span>
            {message.inputType && (
              <span>{getInputTypeIcon(message.inputType)}</span>
            )}
          </div>
        </div>
        
        {/* AI metadata badges */}
        {!isUser && (message.intent || message.confidence || message.actionTaken) && (
          <div className="flex flex-wrap gap-1 mt-2">
            {message.intent && (
              <Badge variant="outline" className="text-xs">
                {message.intent}
              </Badge>
            )}
            {message.confidence && (
              <Badge className={cn("text-xs", getConfidenceColor(message.confidence))}>
                {message.confidence}
              </Badge>
            )}
            {message.actionTaken && (
              <Badge variant="secondary" className="text-xs">
                ⚡ {message.actionTaken}
              </Badge>
            )}
          </div>
        )}
      </div>
      
      {isUser && (
        <Avatar className="h-8 w-8 mt-1 order-2">
          <AvatarImage src="/placeholder.svg" />
          <AvatarFallback className="bg-muted text-muted-foreground text-xs">
            U
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
