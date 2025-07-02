
import React from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { ExtraPanel } from './ExtraPanel';
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
      {/* Extra Drawer - slides from left */}
      <Drawer open={showConversations} onOpenChange={setShowConversations}>
        <DrawerContent side="left">
          <DrawerHeader>
            <DrawerTitle>
              {language === 'ar' ? 'إضافي' : 'Extra'}
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-hidden">
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
          </div>
        </DrawerContent>
      </Drawer>

      {/* Quick Actions Drawer - slides from right */}
      <Drawer open={showQuickActions} onOpenChange={setShowQuickActions}>
        <DrawerContent side="right">
          <DrawerHeader>
            
          </DrawerHeader>
          <div className="flex-1 overflow-hidden">
            <QuickActionsPanel 
              onClose={() => setShowQuickActions(false)}
              onTriggerChange={onTriggerChange}
              activeTrigger={activeTrigger}
              onTextGenerated={onTextGenerated}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
