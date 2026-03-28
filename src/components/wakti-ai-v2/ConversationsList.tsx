
import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, MessageSquare, Plus, RefreshCw, Trash, Eraser, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Conversation {
  id: string;
  title: string;
  last_message_at?: string;
  lastMessageAt?: Date;
  created_at?: string;
  createdAt?: Date;
  is_active?: boolean;
  conversation_id?: string | null;
}

interface ConversationsListProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRefresh: () => void;
  onClose?: () => void;
  onNewConversation?: () => void;
  onClearChat: () => void;
  sessionMessages: any[];
  isLoading?: boolean;
}

export function ConversationsList({
  conversations,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  onRefresh,
  onClose,
  onNewConversation,
  onClearChat,
  sessionMessages,
  isLoading
}: ConversationsListProps) {
  const { language, toggleLanguage } = useTheme();
  const [isClearing, setIsClearing] = useState(false);

  // Limit to 10 — active first, then by recency
  const limitedConversations = conversations.slice(0, 10);

  const handleSelectConversation = (id: string) => {
    onSelectConversation(id);
    onClose?.();
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await onDeleteConversation(id);
      onRefresh();
    } catch {}
  };

  const handleNewConversation = () => {
    onNewConversation?.();
    onClose?.();
  };

  const handleClearChat = () => {
    onClearChat();
    onClose?.();
  };

  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      for (const conversation of limitedConversations) {
        await onDeleteConversation(conversation.id);
      }
      onRefresh();
      onClose?.();
    } catch {} finally {
      setIsClearing(false);
    }
  };

  const formatRelativeTime = (dateStr: string | Date | undefined) => {
    if (!dateStr) return '';
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    if (diffInHours < 1) return language === 'ar' ? 'الآن' : 'Now';
    if (diffInHours < 24) return language === 'ar' ? `منذ ${diffInHours} ساعة` : `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return language === 'ar' ? `منذ ${diffInDays} يوم` : `${diffInDays}d ago`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-muted/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">
              {language === 'ar' ? 'المحادثات' : 'Conversations'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-1 rounded-full font-medium">
              {limitedConversations.length}/10
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleLanguage}
              className="h-7 px-2 text-xs"
            >
              {language === 'ar' ? 'En' : 'ع'}
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={handleNewConversation}
            className="flex-1 h-8 text-xs font-medium"
          >
            <Plus className="h-3 w-3 mr-1" />
            {language === 'ar' ? 'محادثة جديدة' : 'New Chat'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => { onRefresh(); }}
            className="h-8 px-3 text-xs"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>

          {sessionMessages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearChat}
              className="h-8 px-3 text-xs text-orange-600 hover:text-orange-700"
              title={language === 'ar' ? 'مسح الدردشة الحالية' : 'Clear current chat'}
            >
              <Eraser className="h-3 w-3" />
            </Button>
          )}

          {limitedConversations.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs text-destructive hover:text-destructive"
                  disabled={isClearing}
                  title={language === 'ar' ? 'حذف جميع المحادثات' : 'Delete all conversations'}
                >
                  <Trash className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {language === 'ar' ? 'حذف جميع المحادثات' : 'Clear All Conversations'}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {language === 'ar'
                      ? 'هل أنت متأكد من حذف جميع المحادثات؟ لا يمكن التراجع عن هذا الإجراء.'
                      : 'Are you sure you want to delete all conversations? This action cannot be undone.'
                    }
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearAll}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {language === 'ar' ? 'حذف الكل' : 'Clear All'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {/* Info card */}
        <div className="mt-3 text-xs text-muted-foreground bg-muted/50 p-3 rounded-md border">
          <div className="flex items-center gap-1 mb-1">
            <Zap className="h-3 w-3 text-blue-500" />
            <span className="font-medium text-blue-600 dark:text-blue-400">
              {language === 'ar' ? 'حفظ تلقائي سحابي' : 'Auto Cloud Save'}
            </span>
          </div>
          <p className="leading-relaxed">
            {language === 'ar'
              ? '• كل محادثاتك تُحفظ تلقائياً في السحابة — تظهر هنا فوراً وتُستعاد على أي جهاز. استخدم "محادثة جديدة" لبدء موضوع جديد.'
              : '• All conversations auto-save to cloud — visible here instantly and restored on any device. Use "New Chat" to start a fresh topic.'
            }
          </p>
        </div>
      </div>

      {/* Unified Conversations List */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-2">
          {limitedConversations.map((conversation) => {
            const isActive = (conversation as any).is_active === true;
            const dateVal = conversation.lastMessageAt || conversation.last_message_at;
            return (
              <div
                key={conversation.id}
                className={cn(
                  "group relative p-3 rounded-lg border cursor-pointer transition-all duration-200",
                  "hover:bg-accent/50 hover:border-primary/30 hover:shadow-sm",
                  isActive
                    ? "bg-primary/5 border-primary/40 shadow-sm ring-1 ring-primary/20"
                    : currentConversationId === conversation.id
                      ? "bg-primary/5 border-primary/50 shadow-sm ring-1 ring-primary/20"
                      : ""
                )}
                onClick={() => handleSelectConversation(conversation.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium truncate">
                        {conversation.title}
                      </p>
                      {isActive && (
                        <div className="text-xs bg-blue-500/15 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 shrink-0">
                          <Zap className="h-2.5 w-2.5" />
                          {language === 'ar' ? 'الآن' : 'Current'}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatRelativeTime(dateVal)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConversation(conversation.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}

          {limitedConversations.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium mb-1">
                {language === 'ar' ? 'لا توجد محادثات بعد' : 'No conversations yet'}
              </p>
              <p className="text-xs opacity-70">
                {language === 'ar' ? 'ابدأ محادثة وستُحفظ هنا تلقائياً' : 'Start chatting — conversations save here automatically'}
              </p>
            </div>
          )}

          {conversations.length >= 10 && (
            <div className="text-center py-3 px-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                {language === 'ar'
                  ? '⚠️ وصلت للحد الأقصى (10 محادثات)'
                  : '⚠️ Maximum reached (10 conversations)'
                }
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                {language === 'ar'
                  ? 'المحادثات الجديدة ستحل محل الأقدم تلقائياً'
                  : 'Oldest conversations are auto-removed for new ones'
                }
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
