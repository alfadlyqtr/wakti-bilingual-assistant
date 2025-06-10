
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, MessageSquare, Clock, Plus } from 'lucide-react';
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
  onRefresh: () => void;
  onClose?: () => void;
  onNewConversation?: () => void;
}

export function ConversationsList({
  conversations,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  onRefresh,
  onClose,
  onNewConversation
}: ConversationsListProps) {
  const { language, toggleLanguage } = useTheme();

  const handleSelectConversation = (id: string) => {
    console.log('🔍 CONVERSATIONS: Selecting conversation:', id);
    onSelectConversation(id);
    onClose?.();
  };

  const handleDeleteConversation = async (id: string) => {
    console.log('🔍 CONVERSATIONS: Deleting conversation:', id);
    try {
      await onDeleteConversation(id);
      onRefresh();
      onClose?.();
    } catch (error) {
      console.error('🔍 CONVERSATIONS: Error deleting conversation:', error);
    }
  };

  const handleRefresh = () => {
    onRefresh();
    onClose?.();
  };

  const handleNewConversation = () => {
    onNewConversation?.();
    onClose?.();
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return language === 'ar' ? 'الآن' : 'Now';
    } else if (diffInHours < 24) {
      return language === 'ar' ? `منذ ${diffInHours} ساعة` : `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return language === 'ar' ? `منذ ${diffInDays} يوم` : `${diffInDays}d ago`;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <h2 className="text-lg font-semibold">
            {language === 'ar' ? 'المحادثات الأخيرة' : 'Recent Conversations'}
          </h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            {conversations.length}/5
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onNewConversation && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewConversation}
              className="h-9 px-3 rounded-full text-sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              {language === 'ar' ? 'جديد' : 'New'}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleLanguage}
            className="h-9 px-3 rounded-full text-sm"
          >
            {language === 'ar' ? 'English' : 'العربية'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="text-xs"
          >
            {language === 'ar' ? 'تحديث' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Info about conversation limits */}
      <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="h-3 w-3" />
          <span className="font-medium">
            {language === 'ar' ? 'معلومات المحادثات' : 'Conversation Info'}
          </span>
        </div>
        <p>
          {language === 'ar' 
            ? 'يتم حفظ آخر 5 محادثات لمدة 10 أيام، وتحتفظ المحادثة الحالية بآخر 20 رسالة'
            : 'Last 5 conversations saved for 10 days. Current chat keeps last 20 messages.'
          }
        </p>
      </div>
      
      <ScrollArea className="h-[calc(100vh-200px)] scrollbar-hide">
        <div className="space-y-2">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={cn(
                "p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors group",
                currentConversationId === conversation.id && "bg-accent border-primary"
              )}
              onClick={() => handleSelectConversation(conversation.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {conversation.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
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
                    <span className="text-xs text-muted-foreground/70">
                      • {formatRelativeTime(conversation.last_message_at)}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteConversation(conversation.id);
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
              <p className="text-xs mt-1">
                {language === 'ar' ? 'ابدأ محادثة جديدة' : 'Start a new conversation'}
              </p>
            </div>
          )}

          {conversations.length >= 5 && (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-xs">
                {language === 'ar' 
                  ? 'وصلت للحد الأقصى (5 محادثات). المحادثات الجديدة ستحل محل الأقدم.'
                  : 'Maximum limit reached (5 conversations). New chats will replace oldest ones.'
                }
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
