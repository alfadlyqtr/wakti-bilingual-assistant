
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useQuotaManagement } from '@/hooks/useQuotaManagement';
import { cn } from '@/lib/utils';
import { BarChart3, Zap } from 'lucide-react';

export function QuotaIndicator() {
  const { language } = useTheme();
  const { userQuota, MAX_DAILY_TRANSLATIONS, remainingFreeTranslations } = useQuotaManagement(language);

  const usagePercentage = (userQuota.daily_count / MAX_DAILY_TRANSLATIONS) * 100;
  
  const getStatusColor = () => {
    if (usagePercentage >= 100) return 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800';
    if (usagePercentage >= 80) return 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-900/20 dark:border-orange-800';
    if (usagePercentage >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-900/20 dark:border-yellow-800';
    return 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800';
  };

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium",
      getStatusColor()
    )}>
      <BarChart3 className="h-3 w-3" />
      <span>
        {language === 'ar' 
          ? `${remainingFreeTranslations}/${MAX_DAILY_TRANSLATIONS} متبقي`
          : `${remainingFreeTranslations}/${MAX_DAILY_TRANSLATIONS} left`
        }
      </span>
      {userQuota.extra_translations > 0 && (
        <>
          <span className="mx-1">•</span>
          <Zap className="h-3 w-3" />
          <span>+{userQuota.extra_translations}</span>
        </>
      )}
    </div>
  );
}
