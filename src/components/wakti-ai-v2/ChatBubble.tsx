
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { AIMessage } from '@/services/WaktiAIV2Service';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Expand, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ChatBubbleProps {
  message: AIMessage;
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const { theme, language } = useTheme();
  const [copied, setCopied] = React.useState(false);
  
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

  const handleDownloadImage = () => {
    if (message.imageUrl) {
      const link = document.createElement('a');
      link.href = message.imageUrl;
      link.download = `wakti-generated-image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleExpandImage = () => {
    if (message.imageUrl) {
      window.open(message.imageUrl, '_blank');
    }
  };

  const handleCopyTranslatedText = async () => {
    // Extract translated text from the message content - look for the pattern after "النص المترجم:**"
    const translatedTextMatch = message.content.match(/\*\*النص المترجم:\*\*\s*\n(.+)/);
    if (translatedTextMatch && translatedTextMatch[1]) {
      try {
        await navigator.clipboard.writeText(translatedTextMatch[1].trim());
        setCopied(true);
        toast.success(language === 'ar' ? 'تم نسخ النص المترجم' : 'Translated text copied');
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        toast.error(language === 'ar' ? 'فشل في نسخ النص' : 'Failed to copy text');
      }
    }
  };

  // Check if message contains translated text for Arabic image requests
  const hasTranslatedText = message.content.includes('**النص المترجم:**') && 
    message.actionTaken === 'translate_for_image';

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
          "backdrop-blur-md border border-border/50 rounded-xl shadow-xl p-3 relative",
          isUser 
            ? "bg-primary text-primary-foreground ml-auto" 
            : "bg-background/90"
        )}>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {message.content}
          </div>
          
          {/* Copy button for translated Arabic text */}
          {hasTranslatedText && !isUser && (
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyTranslatedText}
                className="text-xs flex items-center gap-1"
              >
                {copied ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {language === 'ar' ? 'نسخ النص المترجم' : 'Copy translated text'}
              </Button>
            </div>
          )}
          
          {/* Display generated image if available */}
          {message.imageUrl && (
            <div className="mt-3 relative group">
              <img 
                src={message.imageUrl} 
                alt="Generated image"
                className="rounded-lg max-w-full h-auto shadow-md"
                loading="lazy"
              />
              
              {/* Image action buttons */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1">
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 bg-black/50 hover:bg-black/70 text-white border-0"
                  onClick={handleDownloadImage}
                  title={language === 'ar' ? 'تحميل الصورة' : 'Download image'}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 bg-black/50 hover:bg-black/70 text-white border-0"
                  onClick={handleExpandImage}
                  title={language === 'ar' ? 'فتح في نافذة جديدة' : 'Open in new tab'}
                >
                  <Expand className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          
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
