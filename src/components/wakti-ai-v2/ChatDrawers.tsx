import React, { useRef, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
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
  const extraDrawerRef = useRef<HTMLDivElement>(null);
  const quickActionsDrawerRef = useRef<HTMLDivElement>(null);

  // Focus management for Extra drawer
  useEffect(() => {
    if (showConversations && extraDrawerRef.current) {
      // Small delay to ensure the drawer is fully mounted
      const timer = setTimeout(() => {
        const firstFocusable = extraDrawerRef.current?.querySelector('button, [href], [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) {
          (firstFocusable as HTMLElement).focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showConversations]);

  // Focus management for Quick Actions drawer
  useEffect(() => {
    if (showQuickActions && quickActionsDrawerRef.current) {
      // Small delay to ensure the drawer is fully mounted
      const timer = setTimeout(() => {
        const firstFocusable = quickActionsDrawerRef.current?.querySelector('button, [href], [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) {
          (firstFocusable as HTMLElement).focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showQuickActions]);

  return (
    <div>
      {/* Extra Drawer - slides from left */}
      <Drawer open={showConversations} onOpenChange={setShowConversations}>
        <DrawerContent 
          side="left" 
          ref={extraDrawerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="extra-drawer-title"
          aria-describedby="extra-drawer-desc"
        >
          <DrawerHeader>
            <DrawerTitle id="extra-drawer-title">
              {language === 'ar' ? 'إضافي' : 'Extra'}
            </DrawerTitle>
            <DrawerDescription id="extra-drawer-desc" className="sr-only">
              {language === 'ar' 
                ? 'لوحة تحتوي على المحادثات السابقة والإعدادات' 
                : 'Panel containing previous conversations and settings'}
            </DrawerDescription>
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
        <DrawerContent 
          side="right" 
          ref={quickActionsDrawerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-actions-title"
          aria-describedby="quick-actions-desc"
        >
          <DrawerHeader>
            <DrawerTitle id="quick-actions-title" className="sr-only">
              {language === 'ar' ? 'الإجراءات السريعة' : 'Quick Actions'}
            </DrawerTitle>
            <DrawerDescription id="quick-actions-desc" className="sr-only">
              {language === 'ar'
                ? 'اختر من أدوات الذكاء الاصطناعي السريعة لإنشاء محتوى أو تحسينه'
                : 'Choose from quick AI tools to create or enhance content'}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-hidden">
            <QuickActionsPanel 
              onSendMessage={onSendMessage} 
              activeTrigger={activeTrigger} 
              onTriggerChange={onTriggerChange} 
              onTextGenerated={onTextGenerated} 
              onClose={() => setShowQuickActions(false)} 
            />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
