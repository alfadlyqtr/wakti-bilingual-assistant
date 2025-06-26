import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  Trash2, 
  Clock, 
  Plus,
  Settings,
  Wand2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { PersonalizationModal } from './PersonalizationModal';

interface ConversationsListProps {
  conversations: any[];
  currentConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  fetchConversations: () => void;
  onNewConversation: () => void;
  onClearChat: () => void;
}

export function ConversationsList({
  conversations,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  fetchConversations,
  onNewConversation,
  onClearChat
}: ConversationsListProps) {
  const { language } = useTheme();
  const [showPersonalizationModal, setShowPersonalizationModal] = useState(false);

  const handleDelete = async (conversationId: string) => {
    if (window.confirm(language === 'ar' ? 'هل أنت متأكد أنك تريد حذف هذه المحادثة؟' : 'Are you sure you want to delete this conversation?')) {
      onDeleteConversation(conversationId);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with New Chat and Personalize buttons */}
      <div className="p-4 border-b border-border space-y-3">
        <Button
          onClick={onNewConversation}
          className="w-full"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          {language === 'ar' ? 'محادثة جديدة' : 'New Chat'}
        </Button>
        
        <Button
          onClick={() => setShowPersonalizationModal(true)}
          variant="outline"
          className="w-full bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-300/30 hover:from-purple-500/20 hover:to-blue-500/20"
          size="sm"
        >
          <Wand2 className="w-4 h-4 mr-2" />
          {language === 'ar' ? '🎛️ تخصيص وكتي' : '🎛️ Personalize Wakti'}
        </Button>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1 p-4">
        {conversations.length > 0 ? (
          <div className="space-y-2">
            {conversations.map(conversation => (
              <div
                key={conversation.id}
                className={`p-3 rounded-md cursor-pointer hover:bg-secondary ${currentConversationId === conversation.id ? 'bg-secondary' : ''}`}
                onClick={() => onSelectConversation(conversation.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{conversation.title}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true, locale: language === 'ar' ? require('date-fns/locale/ar') : undefined })}
                    </Badge>
                    <Trash2 className="w-4 h-4 text-red-500 hover:text-red-700 cursor-pointer" onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(conversation.id);
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground">
            {language === 'ar' ? 'لا توجد محادثات' : 'No conversations'}
          </div>
        )}
      </ScrollArea>

      {/* Personalization Modal */}
      <PersonalizationModal
        open={showPersonalizationModal}
        onOpenChange={setShowPersonalizationModal}
      />
    </div>
  );
}
