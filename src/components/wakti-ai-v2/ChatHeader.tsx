
import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, Menu } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useExtendedQuotaManagement } from '@/hooks/useExtendedQuotaManagement';
import { cn } from '@/lib/utils';

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
  const { 
    userSearchQuota, 
    MAX_MONTHLY_ADVANCED_SEARCHES, 
    MAX_MONTHLY_REGULAR_SEARCHES 
  } = useExtendedQuotaManagement(language);

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

  const getQuotaDisplay = () => {
    if (activeTrigger === 'search') {
      const used = userSearchQuota.regular_search_count;
      const total = MAX_MONTHLY_REGULAR_SEARCHES;
      const remaining = total - used;
      const percentage = (remaining / total) * 100;
      
      let colorClass = 'text-green-600';
      if (percentage <= 20) colorClass = 'text-red-600';
      else if (percentage <= 50) colorClass = 'text-yellow-600';
      
      return (
        <span className={cn('text-xs ml-1', colorClass)}>
          ({used}/{total})
        </span>
      );
    }
    
    if (activeTrigger === 'advanced_search') {
      const used = userSearchQuota.daily_count;
      const total = MAX_MONTHLY_ADVANCED_SEARCHES;
      const remaining = total - used;
      const percentage = (remaining / total) * 100;
      
      let colorClass = 'text-green-600';
      if (percentage <= 20) colorClass = 'text-red-600';
      else if (percentage <= 50) colorClass = 'text-yellow-600';
      
      return (
        <span className={cn('text-xs ml-1', colorClass)}>
          ({used}/{total})
        </span>
      );
    }
    
    return null;
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b h-16 flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onShowConversations}
          className="h-9 w-9"
        >
          <MessageSquare className="h-5 w-5" />
        </Button>
      </div>

      {/* Active Mode Indicator with Quota */}
      <div className="flex items-center px-3 py-1 bg-muted rounded-full text-sm font-medium text-muted-foreground">
        <span>{getTriggerDisplayName()}</span>
        {getQuotaDisplay()}
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
