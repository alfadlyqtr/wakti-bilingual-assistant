
import React from 'react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';

interface NotificationBarsProps {
  quotaStatus: any;
  searchQuotaStatus: {
    remainingFreeSearches: number;
    extraSearches: number;
    isAtLimit: boolean;
    maxMonthlySearches: number;
  };
  translationQuota: any;
  maxDailyTranslations: number;
  language: string;
}

export function NotificationBars({
  quotaStatus,
  searchQuotaStatus,
  translationQuota,
  maxDailyTranslations,
  language
}: NotificationBarsProps) {
  return (
    <>
      {/* Quota status notifications can be added here if needed */}
      {quotaStatus && quotaStatus.showWarning && (
        <div className="bg-yellow-100 border-b p-4">
          <p className="text-sm text-yellow-800">
            {language === 'ar' ? 'تحذير الحصة' : 'Quota Warning'}
          </p>
        </div>
      )}
      
      {/* Search quota notifications */}
      {searchQuotaStatus.isAtLimit && (
        <div className="bg-red-100 border-b p-4">
          <p className="text-sm text-red-800">
            {language === 'ar' 
              ? `تم الوصول للحد الأقصى من البحث (${searchQuotaStatus.maxMonthlySearches}/${searchQuotaStatus.maxMonthlySearches})`
              : `Search limit reached (${searchQuotaStatus.maxMonthlySearches}/${searchQuotaStatus.maxMonthlySearches})`
            }
          </p>
        </div>
      )}

      {/* Translation quota notifications */}
      {translationQuota && translationQuota.daily_count >= maxDailyTranslations && (
        <div className="bg-orange-100 border-b p-4">
          <p className="text-sm text-orange-800">
            {language === 'ar' 
              ? `تم الوصول للحد الأقصى من الترجمات (${maxDailyTranslations}/${maxDailyTranslations})`
              : `Translation limit reached (${maxDailyTranslations}/${maxDailyTranslations})`
            }
          </p>
        </div>
      )}
    </>
  );
}
