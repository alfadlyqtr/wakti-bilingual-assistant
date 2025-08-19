import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';
import { PersonalTouchManager } from './PersonalTouchManager';
import { ConversationsList } from './ConversationsList';
import { AIConversation } from '@/services/WaktiAIV2Service';

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
  const [conversationsOpen, setConversationsOpen] = useState(false);

  // Convert AIConversation to the format expected by ConversationsList
  const mappedConversations = conversations.map(conv => ({
    id: conv.id,
    title: conv.title,
    last_message_at: conv.lastMessageAt.toISOString(),
    created_at: conv.createdAt.toISOString()
  }));

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-6">
        {/* Personal Touch Manager - Always visible */}
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">
            {language === 'ar' ? 'اللمسة الشخصية' : 'Personal Touch'}
          </h2>
          <PersonalTouchManager />
        </div>
        
        {/* Conversations Section - Collapsible */}
        <div className="space-y-2">
          <Collapsible open={conversationsOpen} onOpenChange={setConversationsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                autoFocus
                variant="ghost"
                className="w-full justify-start p-2 h-auto text-slate-700 dark:text-slate-300 hover:bg-white/10 dark:hover:bg-black/10"
                aria-expanded={conversationsOpen}
                aria-controls="conversations-list"
              >
                {conversationsOpen ? (
                  <ChevronDown className="h-4 w-4 mr-2" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-4 w-4 mr-2" aria-hidden="true" />
                )}
                <MessageSquare className="h-4 w-4 mr-2" aria-hidden="true" />
                <span className="text-sm font-medium">
                  {language === 'ar' ? 'المحادثات السابقة' : 'Recent Conversations'}
                </span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent id="conversations-list" className="space-y-0">
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
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}
