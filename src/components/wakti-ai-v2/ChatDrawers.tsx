
import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useTheme } from '@/providers/ThemeProvider';
import { ConversationsList } from './ConversationsList';
import { QuickActionsPanel } from './QuickActionsPanel';
import { AIConversation } from '@/services/WaktiAIV2Service';

interface ChatDrawersProps {
  showConversations: boolean;
  setShowConversations: (show: boolean) => void;
  showQuickActions: boolean;
  setShowQuickActions: (show: boolean) => void;
  conversations: AIConversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  fetchConversations: () => void;
  onSendMessage: (message: string) => void;
  activeTrigger: string;
  onTriggerChange: (trigger: string) => void;
  onTextGenerated: (text: string, mode: 'compose' | 'reply') => void;
  onNewConversation: () => void;
}

export function ChatDrawers({
  showConversations,
  setShowConversations,
  showQuickActions,
  setShowQuickActions,
  conversations,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  fetchConversations,
  onSendMessage,
  activeTrigger,
  onTriggerChange,
  onTextGenerated,
  onNewConversation
}: ChatDrawersProps) {
  const { language } = useTheme();

  return (
    <>
      {/* Left Drawer - Conversations */}
      <Sheet open={showConversations} onOpenChange={setShowConversations}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>{language === 'ar' ? 'المحادثات' : 'Conversations'}</SheetTitle>
            <SheetDescription>
              {language === 'ar'
                ? 'اختر محادثة موجودة أو ابدأ واحدة جديدة.'
                : 'Select an existing conversation or start a new one.'}
            </SheetDescription>
          </SheetHeader>
          <ConversationsList
            conversations={conversations}
            currentConversationId={currentConversationId}
            onSelectConversation={onSelectConversation}
            onDeleteConversation={onDeleteConversation}
            onRefresh={fetchConversations}
            onClose={() => setShowConversations(false)}
            onNewConversation={onNewConversation}
          />
        </SheetContent>
      </Sheet>

      {/* Right Drawer - Quick Actions */}
      <Sheet open={showQuickActions} onOpenChange={setShowQuickActions}>
        <SheetContent side="right" className="w-80 p-4">
          <QuickActionsPanel
            onSendMessage={onSendMessage}
            activeTrigger={activeTrigger as any}
            onTriggerChange={onTriggerChange}
            onTextGenerated={onTextGenerated}
            onClose={() => setShowQuickActions(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
