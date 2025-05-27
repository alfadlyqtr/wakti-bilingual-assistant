
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  title: string;
  last_message_at: string;
  created_at: string;
}

interface ConversationsListProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
}

export function ConversationsList({
  conversations,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation
}: ConversationsListProps) {
  const { language } = useTheme();

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        {language === 'ar' ? 'المحادثات' : 'Conversations'}
      </h2>
      
      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-2">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={cn(
                "p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors group",
                currentConversationId === conversation.id && "bg-accent border-primary"
              )}
              onClick={() => onSelectConversation(conversation.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {conversation.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(conversation.last_message_at).toLocaleDateString(
                      language === 'ar' ? 'ar' : 'en',
                      { 
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }
                    )}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(conversation.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
          
          {conversations.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {language === 'ar' ? 'لا توجد محادثات بعد' : 'No conversations yet'}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
