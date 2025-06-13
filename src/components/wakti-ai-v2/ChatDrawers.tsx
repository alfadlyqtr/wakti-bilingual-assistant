
import React from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useTheme } from '@/providers/ThemeProvider';
import { ConversationsList } from './ConversationsList';
import { QuickActionsPanel } from './QuickActionsPanel';

interface Conversation {
  id: string;
  created_at: string;
  name: string;
  user_id: string;
  title?: string;
  last_message_at?: string;
}

interface ChatDrawersProps {
  showConversations: boolean;
  setShowConversations: (show: boolean) => void;
  showQuickActions: boolean;
  setShowQuickActions: (show: boolean) => void;
  conversations: Conversation[];
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  onClearChat: () => void;
  onNewConversation: () => void;
  isLoading: boolean;
  activeTrigger: string;
  onSendMessage: (message: string) => void;
  setActiveTrigger: (trigger: string) => void;
}

export function ChatDrawers({
  showConversations,
  setShowConversations,
  showQuickActions,
  setShowQuickActions,
  conversations,
  onSelectConversation,
  onDeleteConversation,
  onClearChat,
  onNewConversation,
  isLoading,
  activeTrigger,
  onSendMessage,
  setActiveTrigger
}: ChatDrawersProps) {
  const { language } = useTheme();

  // Transform conversations to match expected format
  const transformedConversations = conversations.map(conv => ({
    ...conv,
    title: conv.name || conv.title || 'Untitled Conversation',
    last_message_at: conv.last_message_at || conv.created_at
  }));

  return (
    <>
      {/* Conversations Drawer */}
      <Sheet open={showConversations} onOpenChange={setShowConversations}>
        <SheetContent side="left" className="w-80">
          <SheetHeader>
            <SheetTitle>
              {language === 'ar' ? 'المحادثات' : 'Conversations'}
            </SheetTitle>
          </SheetHeader>
          <ConversationsList
            conversations={transformedConversations}
            onSelectConversation={onSelectConversation}
            onDeleteConversation={onDeleteConversation}
            onClearChat={onClearChat}
            onNewConversation={onNewConversation}
          />
        </SheetContent>
      </Sheet>

      {/* Quick Actions Drawer */}
      <Sheet open={showQuickActions} onOpenChange={setShowQuickActions}>
        <SheetContent side="right" className="w-80">
          <SheetHeader>
            <SheetTitle>
              {language === 'ar' ? 'الأدوات السريعة' : 'Quick Tools'}
            </SheetTitle>
          </SheetHeader>
          <QuickActionsPanel 
            onSendMessage={onSendMessage}
            activeTrigger={activeTrigger}
            onTriggerChange={setActiveTrigger}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
