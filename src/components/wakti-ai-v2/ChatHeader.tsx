
import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, Plus, Zap, History } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { ActiveModeIndicator } from './ActiveModeIndicator';
import { SearchQuotaIndicator } from './SearchQuotaIndicator';

interface ChatHeaderProps {
  activeTrigger: string;
  setActiveTrigger: (trigger: string) => void;
  onNewConversation: () => void;
  onToggleConversations: () => void;
  onToggleQuickActions: () => void;
  quotaStatus?: any;
  searchConfirmationRequired: boolean;
  onSearchConfirmation: () => void;
  remainingFreeSearches: number;
  extraSearches: number;
  isAtSearchLimit: boolean;
  translationQuota: any;
  MAX_DAILY_TRANSLATIONS: number;
}

export function ChatHeader({
  activeTrigger,
  setActiveTrigger,
  onNewConversation,
  onToggleConversations,
  onToggleQuickActions,
  quotaStatus,
  searchConfirmationRequired,
  onSearchConfirmation,
  remainingFreeSearches,
  extraSearches,
  isAtSearchLimit,
  translationQuota,
  MAX_DAILY_TRANSLATIONS
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
        
        {/* Show search quota indicator only when in search mode */}
        {activeTrigger === 'search' && <SearchQuotaIndicator />}
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onToggleQuickActions} className="flex items-center gap-2">
          <Zap size={16} />
          <span className="hidden sm:inline">
            {language === 'ar' ? 'الأدوات' : 'Tools'}
          </span>
        </Button>
      </div>
    </div>
  );
}
