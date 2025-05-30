
import React from 'react';
import { Zap, BarChart3 } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useQuotaManagement } from '@/hooks/useQuotaManagement';
import { cn } from '@/lib/utils';

interface AdvancedSearchModeIndicatorProps {
  isVisible: boolean;
}

export function AdvancedSearchModeIndicator({ isVisible }: AdvancedSearchModeIndicatorProps) {
  const { language } = useTheme();
  const { userQuota } = useQuotaManagement(language);

  if (!isVisible) return null;

  const MAX_DAILY_SEARCHES = 3;
  const remainingFreeSearches = Math.max(0, MAX_DAILY_SEARCHES - userQuota.advanced_search_count);
  const usagePercentage = (userQuota.advanced_search_count / MAX_DAILY_SEARCHES) * 100;
  
  const getStatusColor = () => {
    if (usagePercentage >= 100) return 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800';
    if (usagePercentage >= 67) return 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-900/20 dark:border-orange-800';
    return 'text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-900/20 dark:border-purple-800';
  };

  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium",
        "bg-gradient-to-r from-purple-100 to-violet-100 text-purple-700 border-purple-200",
        "dark:from-purple-900/30 dark:to-violet-900/30 dark:text-purple-400 dark:border-purple-700/50"
      )}>
        <Zap className="h-3 w-3" />
        <span>{language === 'ar' ? 'بحث متقدم' : 'Advanced Search'}</span>
      </div>
      
      <div className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium",
        getStatusColor()
      )}>
        <BarChart3 className="h-3 w-3" />
        <span>
          {language === 'ar' 
            ? `${remainingFreeSearches}/${MAX_DAILY_SEARCHES} متبقي`
            : `${remainingFreeSearches}/${MAX_DAILY_SEARCHES} left`
          }
        </span>
        {userQuota.extra_advanced_searches > 0 && (
          <>
            <span className="mx-1">•</span>
            <Zap className="h-3 w-3" />
            <span>+{userQuota.extra_advanced_searches}</span>
          </>
        )}
      </div>
    </div>
  );
}
