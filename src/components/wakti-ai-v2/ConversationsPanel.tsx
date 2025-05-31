
import React from 'react';
import { ConversationsList } from './ConversationsList';
import { AIConversation } from '@/services/WaktiAIV2Service';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';

interface ConversationsPanelProps {
  conversations: AIConversation[];
  selectedConversation: AIConversation | null;
  onSelectConversation: (conversation: AIConversation) => void;
  onNewConversation: () => void;
  onDeleteConversation: (conversationId: string) => void;
  setConversationsPanelOpen: (open: boolean) => void;
}

export function ConversationsPanel({
  conversations,
  selectedConversation,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  setConversationsPanelOpen
}: ConversationsPanelProps) {
  const { language } = useTheme();

  const handleSelectConversation = (id: string) => {
    const conversation = conversations.find(c => c.id === id);
    if (conversation) {
      onSelectConversation(conversation);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    await onDeleteConversation(id);
  };

  const loadConversations = () => {
    // This will be handled by the parent component
  };

  return (
    <div className="h-full border-l bg-background/95 backdrop-blur">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {language === 'ar' ? 'المحادثات' : 'Conversations'}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onNewConversation}
          >
            <Plus className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConversationsPanelOpen(false)}
            className="lg:hidden"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <div className="p-4">
        <ConversationsList
          conversations={conversations}
          currentConversationId={selectedConversation?.id || null}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          onRefresh={loadConversations}
        />
      </div>
    </div>
  );
}
