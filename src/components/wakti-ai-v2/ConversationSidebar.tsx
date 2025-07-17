
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { MessageSquare, Trash2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConversationMetadata } from '@/services/EnhancedFrontendMemory';

interface ConversationSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: ConversationMetadata[];
  currentConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  onRefreshConversations: () => void;
}

export function ConversationSidebar({
  isOpen,
  onClose,
  conversations,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  onNewConversation,
  onRefreshConversations
}: ConversationSidebarProps) {
  const { language } = useTheme();

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return language === 'ar' ? 'اليوم' : 'Today';
    if (diffDays === 2) return language === 'ar' ? 'أمس' : 'Yesterday';
    if (diffDays <= 7) return language === 'ar' ? `منذ ${diffDays} أيام` : `${diffDays} days ago`;
    
    return date.toLocaleDateString(language === 'ar' ? 'ar-QA' : 'en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className="fixed top-0 left-0 h-full w-80 bg-background border-r border-border z-50 transform transition-transform duration-300 ease-in-out">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {t('conversations', language)}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* New Conversation Button */}
        <div className="p-4 border-b border-border">
          <Button
            onClick={() => {
              onNewConversation();
              onClose();
            }}
            className="w-full flex items-center gap-2"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
            {t('new_conversation', language)}
          </Button>
        </div>

        {/* Conversations List */}
        <ScrollArea className="flex-1 h-[calc(100vh-140px)]">
          <div className="p-2">
            {conversations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{t('no_conversations', language)}</p>
                <p className="text-sm mt-2">
                  {language === 'ar' ? 'ابدأ محادثة جديدة للبدء' : 'Start a new conversation to begin'}
                </p>
              </div>
            ) : (
              conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`group flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-accent/50 transition-colors ${
                    currentConversationId === conversation.id ? 'bg-accent' : ''
                  }`}
                  onClick={() => {
                    onSelectConversation(conversation.id);
                    onClose();
                  }}
                >
                  <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {conversation.title}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDate(conversation.lastMessageAt)}</span>
                      <span>•</span>
                      <span>
                        {conversation.messageCount} {language === 'ar' ? 'رسالة' : 'messages'}
                      </span>
                    </div>
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
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            {language === 'ar' 
              ? `عرض آخر ${Math.min(conversations.length, 5)} محادثات`
              : `Showing last ${Math.min(conversations.length, 5)} conversations`
            }
          </p>
        </div>
      </div>
    </>
  );
}
