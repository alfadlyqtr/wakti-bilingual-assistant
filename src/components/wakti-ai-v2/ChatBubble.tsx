
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';
import { User, Bot, Image as ImageIcon, Search, MessageSquare, Copy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface ChatBubbleProps {
  message: any;
  userProfile?: any;
  activeTrigger?: string;
}

export function ChatBubble({ message, userProfile, activeTrigger }: ChatBubbleProps) {
  const { language } = useTheme();
  const isUser = message.role === 'user';

  // Format message content with enhanced buddy-chat features
  const formatContent = (content: string) => {
    if (!content) return '';
    
    // Handle markdown-style links [text](url)
    let formattedContent = content.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="text-blue-500 hover:text-blue-700 underline font-medium">$1</a>'
    );
    
    // Handle line breaks
    formattedContent = formattedContent.replace(/\n/g, '<br />');
    
    return formattedContent;
  };

  // Copy message content to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      toast.success(language === 'ar' ? 'تم النسخ!' : 'Copied!', {
        description: language === 'ar' ? 'تم نسخ الرسالة إلى الحافظة' : 'Message copied to clipboard',
      });
    } catch (error) {
      console.error('Failed to copy message:', error);
      toast.error(language === 'ar' ? 'خطأ' : 'Error', {
        description: language === 'ar' ? 'فشل في نسخ الرسالة' : 'Failed to copy message',
      });
    }
  };

  // Get mode indicator icon
  const getModeIcon = () => {
    switch (activeTrigger) {
      case 'search':
        return <Search className="w-3 h-3" />;
      case 'image':
        return <ImageIcon className="w-3 h-3" />;
      case 'chat':
      default:
        return <MessageSquare className="w-3 h-3" />;
    }
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex items-start gap-2 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div className={`
          flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
          ${isUser 
            ? 'bg-blue-500 text-white' 
            : 'bg-gradient-to-br from-purple-500 to-blue-500 text-white'
          }
        `}>
          {isUser ? (
            <User className="w-4 h-4" />
          ) : (
            <Bot className="w-4 h-4" />
          )}
        </div>

        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          {/* Message bubble */}
          <Card className={`
            p-3 max-w-full
            ${isUser 
              ? 'bg-blue-500 text-white border-blue-500' 
              : 'bg-card border-border'
            }
          `}>
            <div className="space-y-2">
              {/* Mode indicator for assistant messages */}
              {!isUser && activeTrigger && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                  {getModeIcon()}
                  <span className="capitalize">
                    {activeTrigger === 'chat' 
                      ? (language === 'ar' ? 'محادثة' : 'Chat')
                      : activeTrigger === 'search'
                      ? (language === 'ar' ? 'بحث' : 'Search') 
                      : language === 'ar' ? 'صورة' : 'Image'
                    }
                  </span>
                </div>
              )}

              {/* Message content */}
              <div 
                className="text-sm whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
              />

              {/* Image display */}
              {message.imageUrl && (
                <div className="mt-2">
                  <img 
                    src={message.imageUrl} 
                    alt="Generated image" 
                    className="max-w-full h-auto rounded-lg border"
                    style={{ maxHeight: '300px' }}
                  />
                </div>
              )}

              {/* Enhanced buddy-chat features */}
              {!isUser && message.buddyChat && (
                <div className="mt-3 space-y-2">
                  {/* Cross-mode suggestion */}
                  {message.buddyChat.crossModeSuggestion && (
                    <div className="text-xs bg-blue-50 dark:bg-blue-900/20 p-2 rounded border-l-2 border-blue-400">
                      <span className="text-blue-600 dark:text-blue-400">
                        💡 {language === 'ar' 
                          ? 'اقتراح: جرب وضع'
                          : 'Suggestion: Try'
                        } {message.buddyChat.crossModeSuggestion} {language === 'ar' ? 'للحصول على نتائج أفضل' : 'mode for better results'}
                      </span>
                    </div>
                  )}

                  {/* Follow-up question */}
                  {message.buddyChat.followUpQuestion && (
                    <div className="text-xs text-muted-foreground italic">
                      {message.buddyChat.followUpQuestion}
                    </div>
                  )}

                  {/* Search follow-up */}
                  {message.buddyChat.searchFollowUp && (
                    <div className="text-xs bg-green-50 dark:bg-green-900/20 p-2 rounded">
                      <span className="text-green-600 dark:text-green-400">
                        🔍 {language === 'ar' 
                          ? 'هل تريد المزيد من المعلومات حول هذا الموضوع؟'
                          : 'Want to dive deeper into this topic?'
                        }
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Browsing indicator */}
              {message.browsingUsed && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                  <Search className="w-3 h-3" />
                  <span>
                    {language === 'ar' ? 'تم البحث في الويب' : 'Web search used'}
                  </span>
                </div>
              )}

              {/* Action taken indicator */}
              {message.actionTaken && (
                <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 mt-2">
                  <span>✅</span>
                  <span>
                    {language === 'ar' ? 'تم تنفيذ إجراء' : 'Action completed'}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Copy button for AI messages */}
          {!isUser && (
            <Button
              onClick={handleCopy}
              variant="ghost"
              size="sm"
              className="h-6 px-2 mt-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Copy className="w-3 h-3 mr-1" />
              {language === 'ar' ? 'نسخ' : 'Copy'}
            </Button>
          )}

          {/* Message timestamp */}
          <div className="text-xs text-muted-foreground mt-1 px-1">
            {message.timestamp && new Date(message.timestamp).toLocaleTimeString(
              language === 'ar' ? 'ar-SA' : 'en-US',
              { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: language !== 'ar'
              }
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
