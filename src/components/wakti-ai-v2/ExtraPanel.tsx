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
    <div className="h-full overflow-y-auto">
      <div className="px-3 pb-3 pt-0 space-y-2">
        {/* Talk Back settings section (voice choices) */}
        <TalkBackSettings />

        <Tabs defaultValue="personal" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="personal">
              {language === 'ar' ? 'اللمسة الشخصية' : 'Personal Touch'}
            </TabsTrigger>
            <TabsTrigger value="conversations">
              {language === 'ar' ? 'المحادثات' : 'Conversations'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="mt-4">
            <PersonalTouchManager />
          </TabsContent>

          <TabsContent value="conversations" className="mt-4">
            {/* Conversations Section */}
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
