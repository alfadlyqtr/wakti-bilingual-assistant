
import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, Menu, Plus } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';

interface ChatHeaderProps {
  currentConversationId: string | null;
  activeTrigger: string;
  onShowConversations: () => void;
  onNewConversation: () => void;
  onShowQuickActions: () => void;
}

export function ChatHeader({
  currentConversationId,
  activeTrigger,
  onShowConversations,
  onNewConversation,
  onShowQuickActions
}: ChatHeaderProps) {
  const { language } = useTheme();

  const getTriggerDisplayName = () => {
    switch (activeTrigger) {
      case 'chat':
        return language === 'ar' ? 'محادثة' : 'Chat';
      case 'search':
        return language === 'ar' ? 'بحث' : 'Search';
      case 'image':
        return language === 'ar' ? 'صورة' : 'Image';
      case 'advanced_search':
        return language === 'ar' ? 'بحث متقدم' : 'Advanced';
      default:
        return language === 'ar' ? 'محادثة' : 'Chat';
    }
  };

  return (
    <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onShowConversations}
          className="h-9 w-9"
        >
          <MessageSquare className="h-5 w-5" />
        </Button>
        {currentConversationId && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onNewConversation}
            className="h-9 w-9"
          >
            <Plus className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Active Mode Indicator */}
      <div className="px-3 py-1 bg-muted rounded-full text-sm font-medium text-muted-foreground">
        {getTriggerDisplayName()}
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={onShowQuickActions}
        className="h-9 w-9"
      >
        <Menu className="h-5 w-5" />
      </Button>
    </div>
  );
}
