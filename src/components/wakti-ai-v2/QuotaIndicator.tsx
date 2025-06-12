
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useQuotaManagement } from '@/hooks/useQuotaManagement';
import { useExtendedQuotaManagement } from '@/hooks/useExtendedQuotaManagement';
import { cn } from '@/lib/utils';
import { BarChart3, Zap, Search, SearchCheck } from 'lucide-react';

export function QuotaIndicator() {
  const { language } = useTheme();
  
  // Translation quota
  const { 
    userQuota: translationQuota, 
    MAX_DAILY_TRANSLATIONS, 
    remainingFreeTranslations 
  } = useQuotaManagement(language);
  
  // SIMPLIFIED: Enhanced search quota (renamed from advanced)
  const { 
    userSearchQuota, 
    MAX_MONTHLY_ENHANCED_SEARCHES, 
    remainingEnhancedSearches 
  } = useExtendedQuotaManagement(language);

  const getTranslationStatusColor = () => {
    const usagePercentage = (translationQuota.daily_count / MAX_DAILY_TRANSLATIONS) * 100;
    if (usagePercentage >= 100) return 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800';
    if (usagePercentage >= 80) return 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-900/20 dark:border-orange-800';
    if (usagePercentage >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-900/20 dark:border-yellow-800';
    return 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800';
  };

  // SIMPLIFIED: Enhanced search status color based on monthly quota
  const getEnhancedSearchStatusColor = () => {
    const usagePercentage = (userSearchQuota.daily_count / MAX_MONTHLY_ENHANCED_SEARCHES) * 100;
    if (usagePercentage >= 100) return 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800';
    if (usagePercentage >= 80) return 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-900/20 dark:border-orange-800';
    if (usagePercentage >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-900/20 dark:border-yellow-800';
    return 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800';
  };

  return (
    <div className="flex items-center gap-3 text-xs">
      {/* Voice Translator Quota */}
      <div className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full border",
        getTranslationStatusColor()
      )}>
        <BarChart3 className="h-3 w-3" />
        <span className="font-medium">
          {language === 'ar' 
            ? `${remainingFreeTranslations}/${MAX_DAILY_TRANSLATIONS} ترجمة`
            : `${remainingFreeTranslations}/${MAX_DAILY_TRANSLATIONS} translations`
          }
        </span>
        {translationQuota.extra_translations > 0 && (
          <>
            <span>•</span>
            <Zap className="h-3 w-3" />
            <span>+{translationQuota.extra_translations}</span>
          </>
        )}
      </div>

      {/* SIMPLIFIED: Enhanced Search Quota (renamed from Advanced) */}
      <div className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full border",
        getEnhancedSearchStatusColor()
      )}>
        <SearchCheck className="h-3 w-3" />
        <span className="font-medium">
          {language === 'ar' 
            ? `${remainingEnhancedSearches}/${MAX_MONTHLY_ENHANCED_SEARCHES} بحث محسن`
            : `${remainingEnhancedSearches}/${MAX_MONTHLY_ENHANCED_SEARCHES} enhanced`
          }
        </span>
        {userSearchQuota.extra_enhanced_searches > 0 && (
          <>
            <span>•</span>
            <Zap className="h-3 w-3" />
            <span>+{userSearchQuota.extra_enhanced_searches}</span>
          </>
        )}
      </div>

      {/* Basic Search (Unlimited) */}
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800">
        <Search className="h-3 w-3" />
        <span className="font-medium">
          {language === 'ar' ? 'بحث أساسي ∞' : 'Search ∞'}
        </span>
      </div>
    </div>
  );
}
