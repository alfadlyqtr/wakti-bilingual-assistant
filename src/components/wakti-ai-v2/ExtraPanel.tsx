
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

  return (
    <div className="h-full overflow-y-auto space-y-4">
      {/* Personal Touch Manager - Always visible */}
      <PersonalTouchManager />
      
      {/* Conversations Section - Collapsible */}
      <Collapsible open={conversationsOpen} onOpenChange={setConversationsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-start p-2 h-auto text-slate-700 dark:text-slate-300 hover:bg-white/10 dark:hover:bg-black/10"
          >
            {conversationsOpen ? (
              <ChevronDown className="h-4 w-4 mr-2" />
            ) : (
              <ChevronRight className="h-4 w-4 mr-2" />
            )}
            <MessageSquare className="h-4 w-4 mr-2" />
            <span className="text-sm font-medium">
              {language === 'ar' ? 'المحادثات السابقة' : 'Recent Conversations'}
            </span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-0">
          <ConversationsList
            conversations={conversations}
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
  );
}
