
import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, Plus, Zap, History } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { ActiveModeIndicator } from './ActiveModeIndicator';
import { QuotaIndicator } from './QuotaIndicator';

interface ChatHeaderProps {
  currentConversationId: string | null;
  activeTrigger: string;
  onShowConversations: () => void;
  onNewConversation: () => void;
  onShowQuickActions: () => void;
  quotaStatus?: any;
  searchQuotaStatus?: any;
}

export function ChatHeader({
  currentConversationId,
  activeTrigger,
  onShowConversations,
  onNewConversation,
  onShowQuickActions,
  quotaStatus,
  searchQuotaStatus
}: ChatHeaderProps) {
  const { language } = useTheme();

  return (
    <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onShowConversations} className="flex items-center gap-2">
          <History size={16} />
          <span className="hidden sm:inline">
            {language === 'ar' ? 'المحادثات' : 'History'}
          </span>
        </Button>

        {/* Show active mode indicator for all modes */}
        <ActiveModeIndicator activeTrigger={activeTrigger} />
        
        {/* Show quota indicator next to the mode indicator */}
        <QuotaIndicator />
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onShowQuickActions} className="flex items-center gap-2">
          <Zap size={16} />
          <span className="hidden sm:inline">
            {language === 'ar' ? 'الأدوات' : 'Tools'}
          </span>
        </Button>
      </div>
    </div>
  );
}
