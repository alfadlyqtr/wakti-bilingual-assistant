
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useSearchQuotaManagement } from '@/hooks/useSearchQuotaManagement';
import { cn } from '@/lib/utils';
import { Search, Zap } from 'lucide-react';

export function SearchQuotaIndicator() {
  const { language } = useTheme();
  
  const {
    remainingFreeSearches,
    extraSearches,
    MAX_MONTHLY_SEARCHES
  } = useSearchQuotaManagement(language);

  const getSearchStatusColor = () => {
    const usagePercentage = ((MAX_MONTHLY_SEARCHES - remainingFreeSearches) / MAX_MONTHLY_SEARCHES) * 100;
    if (usagePercentage >= 100 && extraSearches === 0) return 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800';
    if (usagePercentage >= 80) return 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-900/20 dark:border-orange-800';
    if (usagePercentage >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-900/20 dark:border-yellow-800';
    return 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800';
  };

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs",
      getSearchStatusColor()
    )}>
      <Search className="h-3 w-3" />
      <span className="font-medium">
        {language === 'ar' 
          ? `${remainingFreeSearches}/${MAX_MONTHLY_SEARCHES} بحث`
          : `${remainingFreeSearches}/${MAX_MONTHLY_SEARCHES} searches`
        }
      </span>
      {extraSearches > 0 && (
        <>
          <span>•</span>
          <Zap className="h-3 w-3" />
          <span>+{extraSearches}</span>
        </>
      )}
    </div>
  );
}
