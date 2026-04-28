import React, { useMemo, useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Plus, RefreshCw, Trash2, Eraser, Zap, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConversationMetaUpdate, MAX_CONVERSATIONS } from '@/services/SavedConversationsService';
import { ConversationManagerDialog } from './ConversationManagerDialog';
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
  message_count?: number;
  last_message_at?: string;
  lastMessageAt?: Date;
  created_at?: string;
  createdAt?: Date;
  is_active?: boolean;
  conversation_id?: string | null;
  is_saved?: boolean;
  is_custom_title?: boolean;
}

interface ConversationsListProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRefresh: () => void;
  onClose?: () => void;
  onNewConversation?: () => Promise<boolean> | boolean;
  onUpdateConversationMeta: (id: string, updates: ConversationMetaUpdate) => Promise<void>;
  onClearChat: () => Promise<boolean> | boolean;
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
  onUpdateConversationMeta,
  onClearChat,
  sessionMessages,
  isLoading
}: ConversationsListProps) {
  const { language } = useTheme();
  const [isClearing, setIsClearing] = useState(false);
  const [managingConversation, setManagingConversation] = useState<Conversation | null>(null);

  // Limit to 10 — active first, then by recency
  const limitedConversations = conversations.slice(0, MAX_CONVERSATIONS);
  const savedCount = useMemo(() => limitedConversations.filter((conversation) => conversation.is_saved === true).length, [limitedConversations]);
  const isAtCapacity = limitedConversations.length >= MAX_CONVERSATIONS;
  const allProtected = isAtCapacity && savedCount >= MAX_CONVERSATIONS;

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

  const handleNewConversation = async () => {
    const result = await onNewConversation?.();
    if (result !== false) {
      onClose?.();
    }
  };

  const handleClearChat = async () => {
    const result = await onClearChat();
    if (result !== false) {
      onClose?.();
    }
  };

  const handleSaveConversationMeta = async (id: string, updates: { title: string; is_saved: boolean }) => {
    await onUpdateConversationMeta(id, updates);
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
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-1 rounded-full font-medium">
              {limitedConversations.length}/{MAX_CONVERSATIONS}
            </span>
            <span className="text-xs border border-[rgba(16,185,129,0.18)] bg-[rgba(16,185,129,0.10)] px-2 py-1 rounded-full font-medium text-[hsl(160_80%_28%)]">
              {language === 'ar' ? `${savedCount} محفوظة` : `${savedCount} saved`}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
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
            title={language === 'ar' ? 'تحديث القائمة' : 'Refresh list'}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>

        </div>

        {(sessionMessages.length > 0 || limitedConversations.length > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
          {sessionMessages.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs font-medium text-orange-600 hover:text-orange-700"
                  title={language === 'ar' ? 'مسح الدردشة الحالية' : 'Clear current chat'}
                >
                  <Eraser className="mr-1 h-3 w-3" />
                  {language === 'ar' ? 'مسح الحالية' : 'Clear Current'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent
                overlayClassName="z-[12020]"
                className="z-[12030] max-w-md rounded-3xl border-[rgba(233,206,176,0.9)] bg-[linear-gradient(180deg,rgba(12,15,20,0.98)_0%,rgba(18,22,32,0.98)_100%)] p-5 text-white shadow-[0_20px_44px_rgba(0,0,0,0.45)]"
              >
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {language === 'ar' ? 'مسح الدردشة الحالية' : 'Clear Current Chat'}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {language === 'ar'
                      ? 'سيؤدي هذا إلى مسح الدردشة الحالية وبدء محادثة جديدة فارغة. هل تريد المتابعة؟'
                      : 'This will clear the current chat and start a fresh empty one. Do you want to continue?'
                    }
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-3">
                  <AlertDialogCancel className="mt-0 border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] text-white hover:bg-[rgba(255,255,255,0.08)] hover:text-white">
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearChat}
                    className="bg-orange-600 text-white hover:bg-orange-700"
                  >
                    {language === 'ar' ? 'مسح الحالية' : 'Clear Current'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {limitedConversations.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs font-medium text-destructive hover:text-destructive"
                  disabled={isClearing}
                  title={language === 'ar' ? 'حذف جميع المحادثات' : 'Delete all conversations'}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  {language === 'ar' ? 'حذف الجميع' : 'Delete All'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent
                overlayClassName="z-[12020]"
                className="z-[12030] max-w-md rounded-3xl border-[rgba(233,206,176,0.9)] bg-[linear-gradient(180deg,rgba(12,15,20,0.98)_0%,rgba(18,22,32,0.98)_100%)] p-5 text-white shadow-[0_20px_44px_rgba(0,0,0,0.45)]"
              >
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {language === 'ar' ? 'حذف جميع المحادثات' : 'Delete All Conversations'}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {language === 'ar'
                      ? 'هل أنت متأكد من حذف جميع المحادثات؟ لا يمكن التراجع عن هذا الإجراء.'
                      : 'Are you sure you want to delete all conversations? This action cannot be undone.'
                    }
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-3">
                  <AlertDialogCancel className="mt-0 border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] text-white hover:bg-[rgba(255,255,255,0.08)] hover:text-white">
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearAll}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {language === 'ar' ? 'حذف الجميع' : 'Delete All'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          </div>
        )}

        {/* Info card */}
        <div className="mt-3 text-xs text-muted-foreground bg-muted/50 p-3 rounded-md border">
          <div className="flex items-center gap-1 mb-1">
            <Zap className="h-3 w-3 text-blue-500" />
            <span className="font-medium text-blue-600 dark:text-blue-400">
              {language === 'ar' ? 'مكتبة المحادثات الذكية' : 'Smart conversation library'}
            </span>
          </div>
          <p className="leading-relaxed">
            {language === 'ar'
              ? '• كل محادثاتك تُحفظ تلقائياً. المحادثات المحفوظة يدوياً لا تُستبدل تلقائياً، ويمكنك إعادة تسميتها وحمايتها.'
              : '• Every chat auto-saves. Chats you save manually are protected from auto-replacement, and you can rename and protect them.'
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
            const matchesCurrent = currentConversationId === conversation.id || currentConversationId === conversation.conversation_id;
            return (
              <div
                key={conversation.id}
                className={cn(
                  "group relative rounded-2xl border cursor-pointer transition-all duration-200 p-3",
                  "border-[rgba(233,206,176,0.82)] bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(252,254,253,0.99)_55%,rgba(247,241,232,0.96)_100%)] shadow-[0_10px_24px_rgba(6,5,65,0.07)] hover:border-[rgba(79,141,246,0.34)] hover:shadow-[0_12px_26px_rgba(6,5,65,0.1)]",
                  isActive
                    ? "ring-1 ring-primary/20 border-[rgba(79,141,246,0.5)]"
                    : matchesCurrent
                      ? "ring-1 ring-primary/20 border-[rgba(79,141,246,0.55)]"
                      : ""
                )}
                onClick={() => handleSelectConversation(conversation.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 pr-1">
                    <div className="mb-1 flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-[hsl(243_84%_14%)]">
                        {conversation.title}
                      </p>
                      {conversation.is_saved && (
                        <Badge className="border border-[rgba(16,185,129,0.18)] bg-[rgba(16,185,129,0.10)] text-[10px] text-[hsl(160_80%_28%)]">
                          {language === 'ar' ? 'محفوظة' : 'Saved'}
                        </Badge>
                      )}
                      {isActive && (
                        <div className="shrink-0 rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <Zap className="h-2.5 w-2.5" />
                          {language === 'ar' ? 'الآن' : 'Current'}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[hsl(243_20%_34%)]">
                      <span>{formatRelativeTime(dateVal)}</span>
                      <span>•</span>
                      <span>{conversation.message_count ?? 0} {language === 'ar' ? 'رسالة' : 'msgs'}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-full border border-[rgba(6,5,65,0.08)] bg-white px-3 text-xs font-medium text-[hsl(243_84%_14%)] shadow-[0_4px_10px_rgba(6,5,65,0.05)] hover:bg-[rgba(6,5,65,0.03)]"
                      onClick={(event) => {
                        event.stopPropagation();
                        setManagingConversation(conversation);
                      }}
                      title={language === 'ar' ? 'إدارة المحادثة' : 'Manage chat'}
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      <span className="ml-1">{language === 'ar' ? 'إدارة' : 'Manage'}</span>
                    </Button>
                  </div>
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

          {isAtCapacity && (
            <div className={`rounded-xl border px-3 py-3 ${allProtected ? 'border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.07)]' : 'border-[rgba(245,158,11,0.24)] bg-[rgba(255,244,214,0.65)]'}`}>
              <p className={`text-xs font-semibold ${allProtected ? 'text-red-700' : 'text-[hsl(25_95%_28%)]'}`}>
                {allProtected
                  ? (language === 'ar' ? `الحد ممتلئ (${MAX_CONVERSATIONS}/${MAX_CONVERSATIONS}) وكل المحادثات محفوظة` : `Library full (${MAX_CONVERSATIONS}/${MAX_CONVERSATIONS}) and all chats are saved`)
                  : (language === 'ar' ? `وصلت إلى الحد الأقصى (${MAX_CONVERSATIONS} محادثة)` : `Maximum reached (${MAX_CONVERSATIONS} chats)`)}
              </p>
              <p className={`mt-1 text-xs ${allProtected ? 'text-red-600' : 'text-[hsl(25_95%_28%)]'}`}>
                {allProtected
                  ? (language === 'ar' ? 'لحفظ محادثة جديدة، احذف محادثة واحدة أو ألغِ حفظ واحدة أولاً.' : 'To keep a new chat, delete one saved chat or un-save one first.')
                  : (language === 'ar' ? 'المحادثات غير المحفوظة فقط هي التي يمكن أن تُستبدل تلقائياً.' : 'Only non-saved chats can be auto-replaced now.')}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      <ConversationManagerDialog
        open={!!managingConversation}
        onOpenChange={(open) => {
          if (!open) setManagingConversation(null);
        }}
        conversation={managingConversation}
        onSave={handleSaveConversationMeta}
        onDelete={handleDeleteConversation}
      />
    </div>
  );
}
