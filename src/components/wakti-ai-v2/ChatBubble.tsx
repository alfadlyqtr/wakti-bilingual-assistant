
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { cn } from '@/lib/utils';
import { Mic, Search, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { BrowsingIndicator } from './BrowsingIndicator';
import { AIMessage } from '@/services/WaktiAIV2Service';

interface ChatBubbleProps {
  message: AIMessage;
  onSearchConfirm?: (messageContent: string) => void;
  onSwitchToChat?: () => void;
  activeTrigger?: string;
}

export function ChatBubble({ message, onSearchConfirm, onSwitchToChat, activeTrigger }: ChatBubbleProps) {
  const { theme, language } = useTheme();
  const isUser = message.role === 'user';
  const isArabic = language === 'ar';

  // Check if this message requires search confirmation (80% quota reached)
  const showSearchButton = !isUser && 
    message.quotaStatus?.usagePercentage >= 80 && 
    message.quotaStatus?.usagePercentage < 100 && 
    !message.browsingUsed &&
    onSearchConfirm;

  // Show chat mode switch button if we're in search mode and user sent a general chat message
  const showChatModeSwitch = !isUser && 
    activeTrigger === 'search' && 
    message.content.includes('⚠️') && 
    onSwitchToChat;

  const handleSearchConfirm = () => {
    if (onSearchConfirm) {
      onSearchConfirm(message.content);
    }
  };

  const handleSwitchToChat = () => {
    if (onSwitchToChat) {
      onSwitchToChat();
    }
  };

  return (
    <div className={cn(
      "flex gap-3 max-w-4xl",
      isUser ? (isArabic ? "justify-start" : "justify-end") : "justify-start"
    )}>
      {/* Message Content */}
      <div className={cn(
        "flex-1 space-y-2",
        isUser ? "max-w-[80%]" : "max-w-[85%]"
      )}>
        {/* Message Bubble */}
        <div className={cn(
          "relative px-4 py-3 rounded-2xl shadow-sm",
          isUser 
            ? "bg-primary text-primary-foreground ml-auto" 
            : "bg-muted/50 text-foreground border",
          isUser 
            ? (isArabic ? "rounded-br-md" : "rounded-bl-md")
            : "rounded-bl-md"
        )}>
          {/* Voice Input Indicator */}
          {message.inputType === 'voice' && isUser && (
            <div className="flex items-center gap-1 mb-2 text-xs opacity-70">
              <Mic className="h-3 w-3" />
              <span>{language === 'ar' ? 'رسالة صوتية' : 'Voice message'}</span>
            </div>
          )}

          {/* Message Text */}
          <div className={cn(
            "whitespace-pre-wrap break-words",
            isArabic ? "text-right" : "text-left"
          )}>
            {message.content}
          </div>

          {/* Intent Badge */}
          {message.intent && !isUser && (
            <div className="mt-2 flex items-center gap-1">
              <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
                {message.intent}
              </span>
              {message.confidence && (
                <span className={cn(
                  "text-xs px-2 py-1 rounded-full",
                  message.confidence === 'high' ? "bg-green-100 text-green-700" :
                  message.confidence === 'medium' ? "bg-yellow-100 text-yellow-700" :
                  "bg-gray-100 text-gray-700"
                )}>
                  {message.confidence}
                </span>
              )}
            </div>
          )}

          {/* Generated Image */}
          {message.imageUrl && (
            <div className="mt-3">
              <img
                src={message.imageUrl}
                alt="Generated content"
                className="max-w-full rounded-lg border shadow-sm"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Action Buttons */}
          {(showSearchButton || showChatModeSwitch) && (
            <div className="mt-3 pt-2 border-t border-border/30 flex gap-2">
              {/* Mini Search Button - Only shown when 80% quota reached */}
              {showSearchButton && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSearchConfirm}
                  className="flex items-center gap-2 text-xs h-8 px-3"
                >
                  <Search className="h-3 w-3" />
                  {language === 'ar' ? 'البحث للحصول على معلومات حديثة؟' : 'Search for current info?'}
                </Button>
              )}

              {/* Chat Mode Switch Button */}
              {showChatModeSwitch && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleSwitchToChat}
                  className="flex items-center gap-2 text-xs h-8 px-3 bg-blue-500 hover:bg-blue-600"
                >
                  <MessageSquare className="h-3 w-3" />
                  {language === 'ar' ? 'التبديل إلى وضع المحادثة' : 'Switch to Chat Mode'}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Browsing Indicator - Only for assistant messages */}
        {!isUser && (message.browsingUsed || message.quotaStatus) && (
          <div className={cn(
            "ml-2",
            isUser && "mr-2"
          )}>
            <BrowsingIndicator
              browsingUsed={message.browsingUsed}
              quotaStatus={message.quotaStatus}
              sources={message.browsingData?.sources}
              imageUrl={message.imageUrl}
              size="sm"
            />
          </div>
        )}

        {/* Timestamp */}
        <div className={cn(
          "text-xs text-muted-foreground px-2",
          isUser ? (isArabic ? "text-left" : "text-right") : "text-left"
        )}>
          {format(message.timestamp, 'HH:mm')}
        </div>
      </div>
    </div>
  );
}
