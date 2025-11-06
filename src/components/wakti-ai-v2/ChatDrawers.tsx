import React, { useCallback } from 'react';
import { SideSheet } from "@/components/ui/side-sheet";
import { ExtraPanel } from './ExtraPanel';
import { useTheme } from '@/providers/ThemeProvider';
import { AIConversation } from '@/services/WaktiAIV2Service';
import { useNavigate } from 'react-router-dom';

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
  onNewConversation: () => void;
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
  onClearChat,
  sessionMessages,
  isLoading
}: ChatDrawersProps) {
  const { language } = useTheme();
  const navigate = useNavigate();

  // Quick actions drawer removed. Tools are now accessible inline from the input area.

  return (
    <>
      {/* Extra Drawer - left side (unmounted when closed) */}
      {showConversations && (
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
            onClearChat={onClearChat}
            sessionMessages={sessionMessages}
            isLoading={isLoading}
          />
        </SideSheet>
      )}

      {/* Quick Actions drawer removed – quick modes shown inline in ChatInput */}
    </>
  );
}
