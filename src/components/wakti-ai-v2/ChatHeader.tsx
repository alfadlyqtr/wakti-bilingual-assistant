
import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, Plus, Zap, History } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { SearchModeIndicator } from './SearchModeIndicator';
import { ActiveModeIndicator } from './ActiveModeIndicator';
import { useExtendedQuotaManagement } from '@/hooks/useExtendedQuotaManagement';

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
  const { userSearchQuota, MAX_MONTHLY_ADVANCED_SEARCHES } = useExtendedQuotaManagement(language);

  const isSearchMode = activeTrigger === 'search' || activeTrigger === 'advanced_search';

  const getAdvancedSearchQuotaInfo = () => {
    if (activeTrigger === 'advanced_search') {
      const remaining = Math.max(0, MAX_MONTHLY_ADVANCED_SEARCHES - userSearchQuota.daily_count);
      const total = MAX_MONTHLY_ADVANCED_SEARCHES;
      return { remaining, total };
    }
    return undefined;
  };

  return (
    <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onShowConversations} className="flex items-center gap-2">
          <History size={16} />
          <span className="hidden sm:inline">
            {language === 'ar' ? 'المحادثات' : 'History'}
          </span>
        </Button>

        {/* Show search mode indicator with quota for advanced search */}
        {isSearchMode && (
          <SearchModeIndicator 
            isVisible={true} 
            searchType={activeTrigger as 'search' | 'advanced_search'}
            quotaInfo={getAdvancedSearchQuotaInfo()}
          />
        )}

        {/* Show active mode indicator for non-search modes */}
        {!isSearchMode && (
          <ActiveModeIndicator activeTrigger={activeTrigger} />
        )}
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
