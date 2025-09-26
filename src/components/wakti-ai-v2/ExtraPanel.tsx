import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PersonalTouchManager } from './PersonalTouchManager';
import { ConversationsList } from './ConversationsList';
import { AIConversation } from '@/services/WaktiAIV2Service';
import { TalkBackSettings } from './TalkBackSettings';

interface ExtraPanelProps {
  conversations: AIConversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRefresh: () => void;
  onClose: () => void;
  onNewConversation: () => void;
  onClearChat: () => void;
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
  onClearChat,
  sessionMessages,
  isLoading
}: ExtraPanelProps) {
  const { language } = useTheme();

  // Convert AIConversation to the format expected by ConversationsList
  const mappedConversations = conversations.map(conv => ({
    id: conv.id,
    title: conv.title,
    last_message_at: conv.lastMessageAt.toISOString(),
    created_at: conv.createdAt.toISOString()
  }));

  return (
    <div className="md:h-full overflow-hidden">
      <div className="px-2 pb-0 md:pb-2 pt-0 md:h-full flex flex-col">
        <Tabs defaultValue="personal" className="flex flex-col md:h-full">
          {/* Sticky compact tabs header (inside the same Tabs) */}
          <div className="sticky top-0 z-10 px-1 pt-1 pb-1">
            <TabsList className="flex gap-2 h-8 p-0 bg-transparent !rounded-none justify-start">
              <TabsTrigger className="h-8 !min-h-0 !min-w-0 !gap-0 px-3 rounded-xl text-sm font-medium border border-white/25 bg-white/70 hover:bg-white data-[state=active]:bg-white data-[state=active]:!text-slate-900 data-[state=inactive]:!text-slate-700 shadow-sm data-[state=active]:shadow" value="personal">
                {language === 'ar' ? 'الشخصية' : 'Personal'}
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
