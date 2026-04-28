import React, { useEffect, useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { onEvent } from '@/utils/eventBus';
import { PersonalTouchManager } from './PersonalTouchManager';
import { ConversationsList } from './ConversationsList';
import { AIConversation } from '@/services/WaktiAIV2Service';
import { ConversationMetaUpdate } from '@/services/SavedConversationsService';
import { TalkBackSettings } from './TalkBackSettings';
import { HelpfulMemoryManager } from './HelpfulMemoryManager';

interface ExtraPanelProps {
  conversations: AIConversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRefresh: () => void;
  onClose: () => void;
  onNewConversation: () => Promise<boolean> | boolean;
  onUpdateConversationMeta: (id: string, updates: ConversationMetaUpdate) => Promise<void>;
  onClearChat: () => Promise<boolean> | boolean;
  sessionMessages: any[];
  isLoading: boolean;
}

export function ExtraPanel({
  conversations,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  onRefresh,
  onClose,
  onNewConversation,
  onUpdateConversationMeta,
  onClearChat,
  sessionMessages,
  isLoading
}: ExtraPanelProps) {
  const { language } = useTheme();
  const [activeTab, setActiveTab] = useState<string>('personal');

  // Listen for external requests to open the Memory tab (e.g. from the onboarding popup).
  useEffect(() => {
    return onEvent('wakti-open-memory-panel', () => {
      setActiveTab('memory');
    });
  }, []);

  // Convert AIConversation to the format expected by ConversationsList
  const mappedConversations = conversations.map(conv => ({
    id: conv.id,
    title: conv.title,
    last_message_at: conv.lastMessageAt.toISOString(),
    created_at: conv.createdAt.toISOString(),
    message_count: (conv as any).message_count ?? (conv as any).messageCount ?? 0,
    is_active: conv.is_active,
    conversation_id: conv.conversation_id,
    is_saved: conv.is_saved,
    is_custom_title: conv.is_custom_title,
  }));

  return (
    <div className="md:h-full overflow-hidden">
      <div className="px-2 pb-0 md:pb-2 pt-0 md:h-full flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col md:h-full">
          {/* Sticky compact tabs header (inside the same Tabs) */}
          <div className="sticky top-0 z-10 px-1 pt-1 pb-1">
            <TabsList className="flex gap-2 h-8 p-0 bg-transparent !rounded-none justify-start">
              <TabsTrigger className="h-8 !min-h-0 !min-w-0 !gap-0 px-3 rounded-xl text-sm font-medium border border-white/25 bg-white/70 hover:bg-white data-[state=active]:bg-white data-[state=active]:!text-slate-900 data-[state=inactive]:!text-slate-700 shadow-sm data-[state=active]:shadow" value="personal">
                {language === 'ar' ? 'الشخصية' : 'Personal'}
              </TabsTrigger>
              <TabsTrigger className="h-8 !min-h-0 !min-w-0 !gap-0 px-3 rounded-xl text-sm font-medium border border-white/25 bg-white/70 hover:bg-white data-[state=active]:bg-white data-[state=active]:!text-slate-900 data-[state=inactive]:!text-slate-700 shadow-sm data-[state=active]:shadow" value="memory">
                {language === 'ar' ? 'الذاكرة' : 'Memory'}
              </TabsTrigger>
              <TabsTrigger className="h-8 !min-h-0 !min-w-0 !gap-0 px-3 rounded-xl text-sm font-medium border border-white/25 bg-white/70 hover:bg-white data-[state=active]:bg-white data-[state=active]:!text-slate-900 data-[state=inactive]:!text-slate-700 shadow-sm data-[state=active]:shadow" value="conversations">
                {language === 'ar' ? 'المحادثات' : 'Convos'}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Personal tab content: natural height on mobile, full on desktop */}
          <TabsContent value="personal" className="md:flex-1">
            <div className="mt-2 mb-3 grid grid-cols-1 gap-2 w-full">
              <TalkBackSettings compact />
            </div>

            <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 p-3">
              <PersonalTouchManager compact />
            </div>
          </TabsContent>

          <TabsContent value="memory" className="md:flex-1 mt-2">
            <HelpfulMemoryManager currentConversationId={currentConversationId} />
          </TabsContent>

          {/* Conversations tab content: natural height on mobile, full on desktop */}
          <TabsContent value="conversations" className="md:flex-1 mt-2">
            <ConversationsList
              conversations={mappedConversations}
              currentConversationId={currentConversationId}
              onSelectConversation={onSelectConversation}
              onDeleteConversation={onDeleteConversation}
              onRefresh={onRefresh}
              onClose={onClose}
              onNewConversation={onNewConversation}
              onUpdateConversationMeta={onUpdateConversationMeta}
              onClearChat={onClearChat}
              sessionMessages={sessionMessages}
              isLoading={isLoading}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
