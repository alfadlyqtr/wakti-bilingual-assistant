
import React, { useMemo, useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { Bookmark, BookmarkCheck, MessageSquare, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ConversationMetadata } from '@/services/EnhancedFrontendMemory';
import { ConversationMetaUpdate, MAX_CONVERSATIONS } from '@/services/SavedConversationsService';
import { ConversationManagerDialog } from './ConversationManagerDialog';

interface ConversationSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: ConversationMetadata[];
  currentConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  onNewConversation: () => Promise<boolean> | boolean;
  onUpdateConversationMeta: (id: string, updates: ConversationMetaUpdate) => Promise<void>;
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
  onUpdateConversationMeta,
  onRefreshConversations
}: ConversationSidebarProps) {
  const { language } = useTheme();
  const [managingConversation, setManagingConversation] = useState<ConversationMetadata | null>(null);
  const [togglingSaveId, setTogglingSaveId] = useState<string | null>(null);
  const savedCount = useMemo(() => conversations.filter((conversation) => conversation.is_saved === true).length, [conversations]);

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

  const handleNewConversation = async () => {
    const result = await onNewConversation();
    if (result !== false) {
      onClose();
    }
  };

  const handleToggleSaved = async (conversation: ConversationMetadata) => {
    setTogglingSaveId(conversation.id);
    try {
      await onUpdateConversationMeta(conversation.id, { is_saved: conversation.is_saved !== true });
      onRefreshConversations();
    } finally {
      setTogglingSaveId(null);
    }
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
          <div className="flex items-center gap-2">
            <Badge className="border-[rgba(6,5,65,0.08)] bg-[rgba(6,5,65,0.05)] text-[hsl(243_84%_14%)]">
              {conversations.length}/{MAX_CONVERSATIONS}
            </Badge>
            <Badge className="border-[rgba(16,185,129,0.18)] bg-[rgba(16,185,129,0.10)] text-[hsl(160_80%_28%)]">
              {language === 'ar' ? `${savedCount} محفوظة` : `${savedCount} saved`}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* New Conversation Button */}
        <div className="p-4 border-b border-border">
          <Button
            onClick={handleNewConversation}
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
                  className={`group rounded-2xl border border-[rgba(233,206,176,0.82)] bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(252,254,253,0.99)_55%,rgba(247,241,232,0.96)_100%)] shadow-[0_10px_24px_rgba(6,5,65,0.07)] flex items-start gap-3 p-3 cursor-pointer hover:border-[rgba(79,141,246,0.34)] transition-colors ${
                    currentConversationId === conversation.id ? 'bg-accent' : ''
                  }`}
                  onClick={() => {
                    onSelectConversation(conversation.id);
                    onClose();
                  }}
                >
                  <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">
                        {conversation.title}
                      </p>
                      {conversation.is_saved && (
                        <Badge className="border-[rgba(16,185,129,0.18)] bg-[rgba(16,185,129,0.10)] text-[10px] text-[hsl(160_80%_28%)]">
                          {language === 'ar' ? 'محفوظة' : 'Saved'}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDate(conversation.lastMessageAt)}</span>
                      <span>•</span>
                      <span>
                        {conversation.messageCount} {language === 'ar' ? 'رسالة' : 'messages'}
                      </span>
                    </div>
                    {Array.isArray(conversation.tags) && conversation.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {conversation.tags.slice(0, 3).map((tag) => (
                          <Badge key={`${conversation.id}-${tag}`} className="border-[rgba(6,5,65,0.08)] bg-[rgba(6,5,65,0.05)] text-[10px] text-[hsl(243_84%_14%)]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full border border-[rgba(6,5,65,0.08)] bg-white"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleToggleSaved(conversation);
                      }}
                      disabled={togglingSaveId === conversation.id}
                    >
                      {conversation.is_saved ? <BookmarkCheck className="h-4 w-4 text-emerald-600" /> : <Bookmark className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full border border-[rgba(6,5,65,0.08)] bg-white"
                      onClick={(event) => {
                        event.stopPropagation();
                        setManagingConversation(conversation);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full border border-[rgba(6,5,65,0.08)] bg-white text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conversation.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            {language === 'ar' 
              ? `عرض آخر ${Math.min(conversations.length, MAX_CONVERSATIONS)} محادثة`
              : `Showing last ${Math.min(conversations.length, MAX_CONVERSATIONS)} conversations`
            }
          </p>
        </div>

        <ConversationManagerDialog
          open={!!managingConversation}
          onOpenChange={(open) => {
            if (!open) setManagingConversation(null);
          }}
          conversation={managingConversation}
          onSave={async (id, updates) => {
            await onUpdateConversationMeta(id, updates);
            onRefreshConversations();
          }}
          onDelete={async (id) => {
            await onDeleteConversation(id);
            onRefreshConversations();
          }}
        />
      </div>
    </>
  );
}
