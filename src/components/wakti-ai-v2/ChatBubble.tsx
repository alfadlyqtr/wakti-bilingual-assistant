
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { cn } from '@/lib/utils';
import { Mic, CheckSquare, Calendar, Bell, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AIMessage } from '@/services/WaktiAIV2Service';

interface ChatBubbleProps {
  message: AIMessage;
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const { language } = useTheme();
  
  const isUser = message.role === 'user';
  
  const getActionIcon = (action?: string) => {
    switch (action) {
      case 'create_task': return <CheckSquare className="h-3 w-3" />;
      case 'create_event': return <Calendar className="h-3 w-3" />;
      case 'create_reminder': return <Bell className="h-3 w-3" />;
      default: return null;
    }
  };

  const getConfidenceColor = (confidence?: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'low': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      default: return '';
    }
  };

  return (
    <div className={cn(
      "flex gap-3 mb-4",
      isUser ? 'justify-end' : 'justify-start'
    )}>
      <div className={cn(
        "max-w-[80%] rounded-2xl px-4 py-3 break-words animate-fade-in",
        isUser
          ? "bg-primary text-primary-foreground ml-12"
          : "bg-muted mr-12"
      )}>
        <div className="space-y-2">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {message.content}
          </p>
          
          <div className="flex items-center gap-2 text-xs opacity-70">
            <span>
              {message.timestamp.toLocaleTimeString(language === 'ar' ? 'ar' : 'en', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
            
            {message.inputType === 'voice' && (
              <div className="flex items-center gap-1">
                <Mic className="h-3 w-3" />
                <span>{language === 'ar' ? 'صوتي' : 'Voice'}</span>
              </div>
            )}
            
            {message.actionTaken && (
              <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                {getActionIcon(message.actionTaken)}
                <span>
                  {language === 'ar' ? 'تم التنفيذ' : 'Executed'}
                </span>
              </Badge>
            )}
            
            {message.confidence && !isUser && (
              <Badge className={cn("text-xs", getConfidenceColor(message.confidence))}>
                {message.confidence === 'high' && (language === 'ar' ? 'عالي' : 'High')}
                {message.confidence === 'medium' && (language === 'ar' ? 'متوسط' : 'Medium')}
                {message.confidence === 'low' && (language === 'ar' ? 'منخفض' : 'Low')}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
