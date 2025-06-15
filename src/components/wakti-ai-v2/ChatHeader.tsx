
import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, Plus, Zap, History } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { ActiveModeIndicator } from './ActiveModeIndicator';

interface ChatHeaderProps {
  currentConversationId: string | null;
  activeTrigger: string;
  onToggleConversations: () => void;
  onNewConversation: () => void;
  onToggleQuickActions: () => void;
  onTriggerChange: (trigger: string) => void;
  onClearChat: () => void;
  hasMessages: boolean;
  quotaStatus?: any;
}

export function ChatHeader({
  currentConversationId,
  activeTrigger,
  onToggleConversations,
  onNewConversation,
  onToggleQuickActions,
  onTriggerChange,
  onClearChat,
  hasMessages,
  quotaStatus
}: ChatHeaderProps) {
  const { language } = useTheme();

  return (
    <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onToggleConversations} className="flex items-center gap-2">
          <History size={16} />
          <span className="hidden sm:inline">
            {language === 'ar' ? 'المحادثات' : 'History'}
          </span>
        </Button>

        {/* Show active mode indicator for all modes */}
        <ActiveModeIndicator activeTrigger={activeTrigger} />
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onToggleQuickActions} className="flex items-center gap-2">
          <Zap size={16} />
          <span className="hidden sm:inline">
            {language === 'ar' ? 'الأدوات' : 'Tools'}
          </span>
        </Button>
        
        <Button variant="outline" size="sm" onClick={onNewConversation} className="flex items-center gap-2">
          <Plus size={16} />
          <span className="hidden sm:inline">
            {language === 'ar' ? 'جديد' : 'New'}
          </span>
        </Button>
      </div>
    </div>
  );
}
