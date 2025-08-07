
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useQuotaManagement } from '@/hooks/useQuotaManagement';
import { useExtendedQuotaManagement } from '@/hooks/useExtendedQuotaManagement';
import { useSearchQuotaManagement } from '@/hooks/useSearchQuotaManagement';
import { cn } from '@/lib/utils';
import { BarChart3, Zap, Search, Mic } from 'lucide-react';

export function QuotaIndicator() {
  const { language } = useTheme();
  
  // Translation quota (Voice Translator) - now monthly
  const { 
    userQuota: translationQuota, 
    MAX_MONTHLY_TRANSLATIONS, 
    remainingFreeTranslations 
  } = useQuotaManagement(language);

  // Voice quota (Voice Characters for TTS/Voice Clone)
  const {
    userVoiceQuota,
    remainingVoiceCharacters,
    totalAvailableCharacters
  } = useExtendedQuotaManagement(language);

  // Search quota
  const {
    remainingFreeSearches,
    extraSearches,
    MAX_MONTHLY_SEARCHES
  } = useSearchQuotaManagement(language);

  const getTranslationStatusColor = () => {
    const usagePercentage = (translationQuota.monthly_count / MAX_MONTHLY_TRANSLATIONS) * 100;
    if (usagePercentage >= 100 && translationQuota.extra_translations === 0) return 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800';
    if (usagePercentage >= 80) return 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-900/20 dark:border-orange-800';
    if (usagePercentage >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-900/20 dark:border-yellow-800';
    return 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800';
  };

  const getVoiceStatusColor = () => {
    const usagePercentage = (userVoiceQuota.characters_used / userVoiceQuota.characters_limit) * 100;
    if (usagePercentage >= 100 && userVoiceQuota.extra_characters === 0) return 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800';
    if (usagePercentage >= 80) return 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-900/20 dark:border-orange-800';
    if (usagePercentage >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-900/20 dark:border-yellow-800';
    return 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800';
  };

  const getSearchStatusColor = () => {
    const usagePercentage = ((MAX_MONTHLY_SEARCHES - remainingFreeSearches) / MAX_MONTHLY_SEARCHES) * 100;
    if (usagePercentage >= 100 && extraSearches === 0) return 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800';
    if (usagePercentage >= 80) return 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-900/20 dark:border-orange-800';
    if (usagePercentage >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-900/20 dark:border-yellow-800';
    return 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800';
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      {/* Voice Characters Quota */}
      <div className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full border",
        getVoiceStatusColor()
      )}>
        <Mic className="h-3 w-3" />
        <span className="font-medium">
          {language === 'ar' 
            ? `${Math.floor(remainingVoiceCharacters/1000)}ك حرف شهري`
            : `${Math.floor(remainingVoiceCharacters/1000)}k monthly`
          }
        </span>
        {userVoiceQuota.extra_characters > 0 && (
          <>
            <span>•</span>
            <Zap className="h-3 w-3" />
            <span>+{Math.floor(userVoiceQuota.extra_characters/1000)}k</span>
          </>
        )}
      </div>

      {/* Translation Credits Quota - Changed to monthly display */}
      <div className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full border",
        getTranslationStatusColor()
      )}>
        <BarChart3 className="h-3 w-3" />
        <span className="font-medium">
          {language === 'ar' 
            ? `${remainingFreeTranslations} ترجمة`
            : `${remainingFreeTranslations} trans`
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

      {/* Search Quota */}
      <div className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full border",
        getSearchStatusColor()
      )}>
        <Search className="h-3 w-3" />
        <span className="font-medium">
          {language === 'ar' 
            ? `${remainingFreeSearches} بحث`
            : `${remainingFreeSearches} search`
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
    </div>
  );
}
