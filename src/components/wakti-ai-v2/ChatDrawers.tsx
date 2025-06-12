
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
  onClearChat: () => void;
  sessionMessages: any[];
  onVoiceTranslator: () => void;
  onTextGenerator: () => void;
  onImproveAI: () => void;
  onVoiceClone: () => void;
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
  onNewConversation,
  onClearChat,
  sessionMessages,
  onVoiceTranslator,
  onTextGenerator,
  onImproveAI,
  onVoiceClone
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
            onClearChat={onClearChat}
            sessionMessages={sessionMessages}
          />
        </SheetContent>
      </Sheet>

      {/* Right Drawer - Quick Actions */}
      <QuickActionsPanel
        isOpen={showQuickActions}
        onClose={() => setShowQuickActions(false)}
        onVoiceTranslator={onVoiceTranslator}
        onTextGenerator={onTextGenerator}
        onImproveAI={onImproveAI}
        onVoiceClone={onVoiceClone}
      />
    </>
  );
}
