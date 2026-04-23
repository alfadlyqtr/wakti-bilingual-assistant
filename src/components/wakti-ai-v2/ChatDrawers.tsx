import React from 'react';
import { SideSheet } from "@/components/ui/side-sheet";
import { ExtraPanel } from './ExtraPanel';
import { useTheme } from '@/providers/ThemeProvider';
import { AIConversation } from '@/services/WaktiAIV2Service';
import { ConversationMetaUpdate } from '@/services/SavedConversationsService';

interface ChatDrawersProps {
  showConversations: boolean;
  setShowConversations: (show: boolean) => void;
  conversations: AIConversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  fetchConversations: () => void;
  onSendMessage: (message: string, inputType?: 'text' | 'voice') => void;
  activeTrigger: string;
  onTriggerChange: (trigger: string) => void;
  onTextGenerated: (text: string, mode: 'compose' | 'reply', isTextGenerated?: boolean) => void;
  onNewConversation: () => Promise<boolean> | boolean;
  onUpdateConversationMeta: (id: string, updates: ConversationMetaUpdate) => Promise<void>;
  onClearChat: () => void;
  sessionMessages: any[];
  isLoading: boolean;
}

export function ChatDrawers({
  showConversations,
  setShowConversations,
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
  onUpdateConversationMeta,
  onClearChat,
  sessionMessages,
  isLoading
}: ChatDrawersProps) {
  const { language } = useTheme();

  // Quick actions drawer removed. Tools are now accessible inline from the input area.

  return (
    <>
      {/* Extra Drawer - left side */}
      <SideSheet open={showConversations} onOpenChange={setShowConversations} side="left">
        <div className="sr-only" id="extra-drawer-title">{language === 'ar' ? 'إضافي' : 'Extra'}</div>
        <div className="sr-only" id="extra-drawer-desc">
          {language === 'ar' ? 'لوحة تحتوي على المحادثات السابقة والإعدادات' : 'Panel containing previous conversations and settings'}
        </div>
        <ExtraPanel
          conversations={conversations}
          currentConversationId={currentConversationId}
          onSelectConversation={onSelectConversation}
          onDeleteConversation={onDeleteConversation}
          onRefresh={fetchConversations}
          onClose={() => setShowConversations(false)}
          onNewConversation={onNewConversation}
          onUpdateConversationMeta={onUpdateConversationMeta}
          onClearChat={onClearChat}
          sessionMessages={sessionMessages}
          isLoading={isLoading}
        />
      </SideSheet>

      {/* Quick Actions drawer removed – quick modes shown inline in ChatInput */}
    </>
  );
}
