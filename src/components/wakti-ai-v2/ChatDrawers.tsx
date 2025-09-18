import React, { useCallback } from 'react';
import { SideSheet } from "@/components/ui/side-sheet";
import { ExtraPanel } from './ExtraPanel';
import { useTheme } from '@/providers/ThemeProvider';
import { QuickActionsPanel } from './QuickActionsPanel';
import { AIConversation } from '@/services/WaktiAIV2Service';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();

  const openTool = useCallback((tool: 'text' | 'voice' | 'game') => {
    // Close drawer, then navigate to dedicated pages instead of modals
    setShowQuickActions(false);
    setTimeout(() => {
      if (tool === 'text') navigate('/tools/text');
      else if (tool === 'voice') navigate('/tools/voice-studio');
      else if (tool === 'game') navigate('/tools/game');
    }, 150);
  }, [setShowQuickActions, navigate]);

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
          onClearChat={onClearChat}
          sessionMessages={sessionMessages}
          isLoading={isLoading}
        />
      </SideSheet>

      {/* Quick Actions Drawer - right side */}
      <SideSheet open={showQuickActions} onOpenChange={setShowQuickActions} side="right">
        <div className="sr-only" id="quick-actions-title">{language === 'ar' ? 'الإجراءات السريعة' : 'Quick Actions'}</div>
        <div className="sr-only" id="quick-actions-desc">
          {language === 'ar' ? 'اختر من أدوات الذكاء الاصطناعي السريعة لإنشاء محتوى أو تحسينه' : 'Choose from quick AI tools to create or enhance content'}
        </div>
        <QuickActionsPanel 
          onClose={() => setShowQuickActions(false)} 
          onOpenTool={openTool}
        />
      </SideSheet>

      {/* Tool popups removed – now dedicated pages via routes */}
    </>
  );
}
