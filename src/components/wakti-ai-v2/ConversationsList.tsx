
import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, MessageSquare, Clock, Plus, RefreshCw, Trash } from 'lucide-react';
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
  const [isClearing, setIsClearing] = useState(false);

  // Limit to 5 conversations
  const limitedConversations = conversations.slice(0, 5);

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
    } catch (error) {
      console.error('🔍 CONVERSATIONS: Error deleting conversation:', error);
    }
  };

  const handleRefresh = () => {
    onRefresh();
  };

  const handleNewConversation = () => {
    onNewConversation?.();
    onClose?.();
  };

  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      // Delete all conversations one by one
      for (const conversation of limitedConversations) {
        await onDeleteConversation(conversation.id);
      }
      onRefresh();
      onClose?.();
    } catch (error) {
      console.error('🔍 CONVERSATIONS: Error clearing all conversations:', error);
    } finally {
      setIsClearing(false);
    }
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-muted/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">
              {language === 'ar' ? 'المحادثات الأخيرة' : 'Recent Conversations'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-1 rounded-full font-medium">
              {limitedConversations.length}/5
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
            onClick={handleRefresh}
            className="h-8 px-3 text-xs"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>

          {limitedConversations.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs text-destructive hover:text-destructive"
                  disabled={isClearing}
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

        {/* Info Card */}
        <div className="mt-3 text-xs text-muted-foreground bg-muted/50 p-2 rounded-md">
          <div className="flex items-center gap-1 mb-1">
            <Clock className="h-3 w-3" />
            <span className="font-medium">
              {language === 'ar' ? 'معلومات' : 'Info'}
            </span>
          </div>
          <p className="leading-relaxed">
            {language === 'ar' 
              ? 'يتم حفظ آخر 5 محادثات لمدة 10 أيام، وتحتفظ المحادثة الحالية بآخر 20 رسالة'
              : 'Last 5 conversations saved for 10 days. Current chat keeps last 20 messages.'
            }
          </p>
        </div>
      </div>
      
      {/* Conversations List */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-2">
          {limitedConversations.map((conversation) => (
            <div
              key={conversation.id}
              className={cn(
                "group relative p-3 rounded-lg border cursor-pointer transition-all duration-200",
                "hover:bg-accent/50 hover:border-primary/30 hover:shadow-sm",
                currentConversationId === conversation.id && "bg-primary/5 border-primary/50 shadow-sm"
              )}
              onClick={() => handleSelectConversation(conversation.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-sm font-medium truncate mb-1">
                    {conversation.title}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {new Date(conversation.last_message_at).toLocaleDateString(
                        language === 'ar' ? 'ar' : 'en',
                        { 
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }
                      )}
                    </span>
                    <span className="opacity-70">
                      • {formatRelativeTime(conversation.last_message_at)}
                    </span>
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
          ))}
          
          {limitedConversations.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium mb-1">
                {language === 'ar' ? 'لا توجد محادثات بعد' : 'No conversations yet'}
              </p>
              <p className="text-xs opacity-70">
                {language === 'ar' ? 'ابدأ محادثة جديدة للبدء' : 'Start a new conversation to begin'}
              </p>
            </div>
          )}

          {conversations.length >= 5 && (
            <div className="text-center py-3 px-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                {language === 'ar' 
                  ? '⚠️ وصلت للحد الأقصى (5 محادثات)'
                  : '⚠️ Maximum limit reached (5 conversations)'
                }
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                {language === 'ar' 
                  ? 'المحادثات الجديدة ستحل محل الأقدم'
                  : 'New chats will replace oldest ones'
                }
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
