
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
  const { userSearchQuota, MAX_MONTHLY_ENHANCED_SEARCHES } = useExtendedQuotaManagement(language); // Fixed: renamed from MAX_MONTHLY_ADVANCED_SEARCHES

  const isSearchMode = activeTrigger === 'search' || activeTrigger === 'enhanced_search'; // Fixed: renamed from advanced_search

  const getEnhancedSearchQuotaInfo = () => { // Fixed: renamed from getAdvancedSearchQuotaInfo
    if (activeTrigger === 'enhanced_search') { // Fixed: renamed from advanced_search
      const remaining = Math.max(0, MAX_MONTHLY_ENHANCED_SEARCHES - userSearchQuota.daily_count);
      const total = MAX_MONTHLY_ENHANCED_SEARCHES;
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

        {/* Show search mode indicator with quota for enhanced search */}
        {isSearchMode && (
          <SearchModeIndicator 
            isVisible={true} 
            searchType={activeTrigger as 'search' | 'enhanced_search'} // Fixed: renamed from advanced_search
            quotaInfo={getEnhancedSearchQuotaInfo()} // Fixed: renamed
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
