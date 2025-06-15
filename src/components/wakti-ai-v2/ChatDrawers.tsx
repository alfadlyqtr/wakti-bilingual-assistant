
import React from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ConversationsList } from './ConversationsList';
import { useTheme } from '@/providers/ThemeProvider';
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
  onSendMessage: (message: string, inputType?: 'text' | 'voice') => void;
  activeTrigger: string;
  onTriggerChange: (trigger: string) => void;
  onTextGenerated: (text: string, mode: 'compose' | 'reply', isTextGenerated?: boolean) => void;
  onNewConversation: () => void;
  onClearChat: () => void;
  sessionMessages: any[];
  isLoading: boolean;
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
  onNewConversation,
  onClearChat,
  sessionMessages,
  isLoading
}: ChatDrawersProps) {
  const { language } = useTheme();

  return (
    <div>
      {/* Conversations Drawer */}
      <Drawer open={showConversations} onOpenChange={setShowConversations}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
              {language === 'ar' ? 'المحادثات' : 'Conversations'}
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-hidden">
            <ConversationsList
              conversations={conversations}
              currentConversationId={currentConversationId}
              onSelectConversation={onSelectConversation}
              onDeleteConversation={onDeleteConversation}
              onRefresh={fetchConversations}
              onClose={() => setShowConversations(false)}
              onNewConversation={onNewConversation}
              onClearChat={onClearChat}
              sessionMessages={sessionMessages}
              isLoading={isLoading}
            />
          </div>
        </DrawerContent>
      </Drawer>

      {/* Quick Actions Drawer */}
      <Drawer open={showQuickActions} onOpenChange={setShowQuickActions}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
              {language === 'ar' ? 'الإجراءات السريعة' : 'Quick Actions'}
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-hidden">
            <QuickActionsPanel
              onSendMessage={onSendMessage}
              activeTrigger={activeTrigger}
              onTriggerChange={onTriggerChange}
              onTextGenerated={onTextGenerated}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
