
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { cn } from '@/lib/utils';
import { Mic, Search, MessageSquare, Expand, Download, Copy, PenTool } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { BrowsingIndicator } from './BrowsingIndicator';
import { SearchResultActions } from './SearchResultActions';
import { AIMessage } from '@/services/WaktiAIV2Service';
import { useToast } from '@/hooks/use-toast';

interface ChatBubbleProps {
  message: AIMessage;
  onSearchConfirm?: (messageContent: string) => void;
  onSwitchToChat?: () => void;
  activeTrigger?: string;
  isTextGenerated?: boolean;
}

export function ChatBubble({ message, onSearchConfirm, onSwitchToChat, activeTrigger, isTextGenerated }: ChatBubbleProps) {
  const { theme, language } = useTheme();
  const { toast } = useToast();
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

  // Check if we should show search-related features - NOW INCLUDES both search and advanced_search
  const isSearchResult = !isUser && 
    (activeTrigger === 'search' || activeTrigger === 'advanced_search') && 
    (message.browsingUsed || message.quotaStatus);

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

  const handleExpandImage = () => {
    if (message.imageUrl) {
      window.open(message.imageUrl, '_blank');
    }
  };

  const handleDownloadImage = async () => {
    if (message.imageUrl) {
      try {
        const response = await fetch(message.imageUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `wakti-generated-image-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        console.error('Error downloading image:', error);
      }
    }
  };

  const handleCopyTextGenerated = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      toast({
        title: language === 'ar' ? '✅ تم النسخ' : '✅ Copied',
        description: language === 'ar' ? 'تم نسخ النص المولد' : 'Generated text copied',
        duration: 2000
      });
    } catch (error) {
      console.error('Error copying text:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في نسخ النص' : 'Failed to copy text',
        variant: 'destructive'
      });
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

          {/* Generated Image with Controls */}
          {message.imageUrl && (
            <div className="mt-3 relative group">
              <img
                src={message.imageUrl}
                alt="Generated content"
                className="max-w-full rounded-lg border shadow-sm"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              
              {/* Image Controls - Show on hover */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleExpandImage}
                  className="h-8 w-8 p-0 bg-black/50 hover:bg-black/70 text-white border-0"
                  title={language === 'ar' ? 'توسيع الصورة' : 'Expand image'}
                >
                  <Expand className="h-3 w-3" />
                </Button>
                
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleDownloadImage}
                  className="h-8 w-8 p-0 bg-black/50 hover:bg-black/70 text-white border-0"
                  title={language === 'ar' ? 'تحميل الصورة' : 'Download image'}
                >
                  <Download className="h-3 w-3" />
                </Button>
              </div>
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

        {/* Browsing Indicator - Show for both search and advanced_search */}
        {isSearchResult && (
          <div className={cn(
            "ml-2",
            isUser && "mr-2"
          )}>
            <BrowsingIndicator
              browsingUsed={message.browsingUsed}
              quotaStatus={message.quotaStatus ? {
                ...message.quotaStatus,
                remaining: message.quotaStatus.limit - message.quotaStatus.count
              } : undefined}
              sources={message.browsingData?.sources}
              imageUrl={message.imageUrl}
              size="sm"
            />
          </div>
        )}

        {/* Search Result Actions - Copy Text and Export PDF */}
        {isSearchResult && message.browsingUsed && (
          <div className={cn(
            "ml-2",
            isUser && "mr-2"
          )}>
            <SearchResultActions
              content={message.content}
              query={message.browsingData?.query || ''}
              sources={message.browsingData?.sources}
              metadata={{
                searchMode: activeTrigger === 'advanced_search' 
                  ? (language === 'ar' ? 'بحث متقدم' : 'Advanced Search')
                  : (language === 'ar' ? 'بحث أساسي' : 'Basic Search'),
                intent: message.intent,
                timestamp: message.timestamp
              }}
            />
          </div>
        )}

        {/* Text Generation Indicator and Copy Button */}
        {isTextGenerated && !isUser && (
          <div className={cn(
            "flex items-center justify-between ml-2",
            isUser && "mr-2"
          )}>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <PenTool className="h-3 w-3" />
                <span>{language === 'ar' ? 'WAKTI AI نص مولد' : 'WAKTI AI Text Gen.'}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {format(message.timestamp, 'HH:mm')}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyTextGenerated}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              title={language === 'ar' ? 'نسخ النص المولد' : 'Copy generated text'}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Regular Timestamp - Only show if not text generated */}
        {!isTextGenerated && (
          <div className={cn(
            "text-xs text-muted-foreground px-2",
            isUser ? (isArabic ? "text-left" : "text-right") : "text-left"
          )}>
            {format(message.timestamp, 'HH:mm')}
          </div>
        )}
      </div>
    </div>
  );
}
