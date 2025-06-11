import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, Plus, Zap, History } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { QuotaDisplay } from './QuotaDisplay';
import { SearchModeIndicator } from './SearchModeIndicator';
interface ChatHeaderProps {
  currentConversationId: string | null;
  activeTrigger: string;
  onShowConversations: () => void;
  onNewConversation: () => void;
  onShowQuickActions: () => void;
  quotaStatus?: any; // Add quotaStatus prop
}
export function ChatHeader({
  currentConversationId,
  activeTrigger,
  onShowConversations,
  onNewConversation,
  onShowQuickActions,
  quotaStatus // Add quotaStatus parameter
}: ChatHeaderProps) {
  const {
    language
  } = useTheme();
  return <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onShowConversations} className="flex items-center gap-2">
          <History size={16} />
          <span className="hidden sm:inline">
            {language === 'ar' ? 'المحادثات' : 'History'}
          </span>
        </Button>

        

        <SearchModeIndicator isVisible={activeTrigger === 'search' || activeTrigger === 'advanced_search'} />
      </div>

      <div className="flex items-center gap-3">
        {quotaStatus && <QuotaDisplay quotaStatus={quotaStatus} />}
        
        <Button variant="outline" size="sm" onClick={onShowQuickActions} className="flex items-center gap-2">
          <Zap size={16} />
          <span className="hidden sm:inline">
            {language === 'ar' ? 'الأدوات' : 'Tools'}
          </span>
        </Button>
      </div>
    </div>;
}