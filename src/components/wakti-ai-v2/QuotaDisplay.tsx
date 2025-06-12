
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useSearchQuotaManagement } from '@/hooks/useSearchQuotaManagement';

interface QuotaDisplayProps {
  quotaStatus?: any;
  searchQuotaStatus?: any;
  activeTrigger?: string;
}

export function QuotaDisplay({ quotaStatus, searchQuotaStatus, activeTrigger }: QuotaDisplayProps) {
  const { language } = useTheme();
  const { 
    remainingFreeSearches, 
    extraSearches, 
    MAX_MONTHLY_SEARCHES,
    totalUsed,
    isAtLimit
  } = useSearchQuotaManagement(language);

  // Only show quota for search mode
  if (activeTrigger !== 'search') {
    return null;
  }

  // Check if quota was exceeded from the AI response
  if (quotaStatus?.type === 'search_quota_exceeded') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2 dark:bg-red-900/20 dark:border-red-800">
        <div className="text-sm text-red-800 dark:text-red-200">
          <div className="font-medium mb-1">
            {language === 'ar' ? '🚫 تم الوصول للحد الأقصى' : '🚫 Search Limit Reached'}
          </div>
          <div>
            {language === 'ar' 
              ? `لقد استخدمت ${quotaStatus.used}/${MAX_MONTHLY_SEARCHES} من عمليات البحث المجانية هذا الشهر.`
              : `You've used ${quotaStatus.used}/${MAX_MONTHLY_SEARCHES} free searches this month.`
            }
          </div>
          {quotaStatus.extraSearches > 0 && (
            <div className="mt-1">
              {language === 'ar' 
                ? `البحث الإضافي المتبقي: ${quotaStatus.extraSearches}`
                : `Extra searches remaining: ${quotaStatus.extraSearches}`
              }
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show current quota status
  const getQuotaColor = () => {
    if (isAtLimit) return 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800';
    if (remainingFreeSearches <= 2) return 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-900/20 dark:border-orange-800';
    return 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800';
  };

  return (
    <div className={`rounded-lg p-3 mt-2 border ${getQuotaColor()}`}>
      <div className="text-sm">
        <div className="font-medium mb-1">
          {language === 'ar' ? '📊 حصة البحث الشهرية' : '📊 Monthly Search Quota'}
        </div>
        <div>
          {language === 'ar' 
            ? `${remainingFreeSearches}/${MAX_MONTHLY_SEARCHES} بحث مجاني متبقي`
            : `${remainingFreeSearches}/${MAX_MONTHLY_SEARCHES} free searches remaining`
          }
        </div>
        {extraSearches > 0 && (
          <div className="mt-1 font-medium">
            {language === 'ar' 
              ? `+ ${extraSearches} بحث إضافي`
              : `+ ${extraSearches} extra searches`
            }
          </div>
        )}
      </div>
    </div>
  );
}
