
import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Loader2, MessageSquare } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { ChatBubble } from './ChatBubble';
import { AIMessage } from '@/services/WaktiAIV2Service';

interface ChatMessagesProps {
  sessionMessages: AIMessage[];
  isLoading: boolean;
  activeTrigger: string;
  scrollAreaRef: React.RefObject<any>;
}

export function ChatMessages({
  sessionMessages,
  isLoading,
  activeTrigger,
  scrollAreaRef
}: ChatMessagesProps) {
  const { language } = useTheme();

  return (
    <ScrollArea 
      className="flex-1 px-4"
      ref={scrollAreaRef}
    >
      <div className="max-w-4xl mx-auto py-4 space-y-6">
        {sessionMessages.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">
              {language === 'ar' ? 'مرحباً بك في WAKTI AI' : 'Welcome to WAKTI AI'}
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {language === 'ar' 
                ? 'ابدأ محادثة جديدة. يمكنني مساعدتك في المهام، البحث، إنشاء الصور والمزيد.'
                : 'Start a new conversation. I can help with tasks, search, image generation, and more.'
              }
            </p>
            <div className="mt-4 text-xs text-muted-foreground">
              {language === 'ar' 
                ? 'المحادثة الحالية تحتفظ بآخر 20 رسالة'
                : 'Current chat keeps last 20 messages'
              }
            </div>
          </div>
        )}

        {/* Message Count Indicator */}
        {sessionMessages.length > 15 && (
          <div className="text-center py-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-muted rounded-full text-xs text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              <span>
                {sessionMessages.length}/20 {language === 'ar' ? 'رسالة' : 'messages'}
              </span>
              {sessionMessages.length >= 20 && (
                <span className="text-orange-500">
                  {language === 'ar' ? '(ممتلئ)' : '(full)'}
                </span>
              )}
            </div>
          </div>
        )}

        {sessionMessages.map((message) => (
          <ChatBubble
            key={message.id}
            message={message}
            activeTrigger={activeTrigger}
          />
        ))}

        {isLoading && (
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              {language === 'ar' ? 'جارٍ التحميل...' : 'Loading...'}
            </span>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
