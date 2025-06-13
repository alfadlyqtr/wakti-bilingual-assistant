
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
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onClearChat: () => void;
  onNewConversation: () => void;
  quotaStatus: any;
  isLoading: boolean;
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
  quotaStatus,
  isLoading
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
            currentConversationId={null}
            onSelectConversation={onSelectConversation}
            onDeleteConversation={onDeleteConversation}
            onRefresh={() => {}}
            onClose={() => setShowConversations(false)}
            onNewConversation={onNewConversation}
            onClearChat={onClearChat}
            sessionMessages={[]}
          />
        </SheetContent>
      </Sheet>

      {/* Right Drawer - Quick Actions */}
      <Sheet open={showQuickActions} onOpenChange={setShowQuickActions}>
        <SheetContent side="right" className="w-80 p-4">
          <QuickActionsPanel
            onSendMessage={() => {}}
            activeTrigger={'chat' as any}
            onTriggerChange={() => {}}
            onTextGenerated={() => {}}
            onClose={() => setShowQuickActions(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
