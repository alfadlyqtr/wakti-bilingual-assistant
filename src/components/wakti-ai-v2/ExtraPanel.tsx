import React, { useEffect, useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { StudioGuestLoginDialog } from '@/components/studio/StudioGuestLoginDialog';
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
  const { isGuest } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('personal');
  const [guestDialogOpen, setGuestDialogOpen] = useState(false);

  const handleTabChange = (value: string) => {
    if (isGuest && (value === 'memory' || value === 'conversations')) {
      setGuestDialogOpen(true);
      return;
    }
    setActiveTab(value);
  };

  // Listen for external requests to open tabs from elsewhere in the app.
  useEffect(() => {
    const offMemory = onEvent('wakti-open-memory-panel', () => {
      setActiveTab('memory');
    });
    const offConversations = onEvent('wakti-open-conversations-panel', () => {
      setActiveTab('conversations');
    });
    return () => {
      offMemory();
      offConversations();
    };
  }, []);


  return (
    <div className="md:h-full overflow-hidden">
      <div className="px-2 pb-0 md:pb-2 pt-0 md:h-full flex flex-col">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col md:h-full">
          {/* Sticky compact tabs header (inside the same Tabs) */}
          <div className="sticky top-0 z-10 px-1 pt-1 pb-1">
            <TabsList className="flex gap-2 h-8 p-0 bg-transparent !rounded-none justify-start">
              <TabsTrigger className="h-8 !min-h-0 !min-w-0 !gap-0 px-3 rounded-xl text-sm font-medium border border-white/25 bg-white/70 hover:bg-white data-[state=active]:bg-white data-[state=active]:!text-slate-900 data-[state=inactive]:!text-slate-700 shadow-sm data-[state=active]:shadow" value="personal">
                {language === 'ar' ? 'Ã˜Â§Ã™â€žÃ˜Â´Ã˜Â®Ã˜ÂµÃ™Å Ã˜Â©' : 'Personal'}
              </TabsTrigger>
              <TabsTrigger className="h-8 !min-h-0 !min-w-0 !gap-0 px-3 rounded-xl text-sm font-medium border border-white/25 bg-white/70 hover:bg-white data-[state=active]:bg-white data-[state=active]:!text-slate-900 data-[state=inactive]:!text-slate-700 shadow-sm data-[state=active]:shadow" value="memory">
                {language === 'ar' ? 'Ã˜Â§Ã™â€žÃ˜Â°Ã˜Â§Ã™Æ’Ã˜Â±Ã˜Â©' : 'Memory'}
              </TabsTrigger>
              <TabsTrigger className="h-8 !min-h-0 !min-w-0 !gap-0 px-3 rounded-xl text-sm font-medium border border-white/25 bg-white/70 hover:bg-white data-[state=active]:bg-white data-[state=active]:!text-slate-900 data-[state=inactive]:!text-slate-700 shadow-sm data-[state=active]:shadow" value="conversations">
                {language === 'ar' ? 'Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜Â§Ã˜Â¯Ã˜Â«Ã˜Â§Ã˜Âª' : 'Conversations'}
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

          <TabsContent value="conversations" className="md:flex-1 mt-2">
            <ConversationsList
              conversations={conversations}
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
      <StudioGuestLoginDialog
        open={guestDialogOpen}
        onOpenChange={setGuestDialogOpen}
        redirectTo={typeof window === 'undefined' ? '/wakti-ai-v2' : `${window.location.pathname}${window.location.search}`}
        language={language === 'ar' ? 'ar' : 'en'}
      />
    </div>
  );
}
