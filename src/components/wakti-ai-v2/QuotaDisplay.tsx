
import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/providers/ThemeProvider';

interface QuotaDisplayProps {
  quotaStatus?: {
    count: number;
    limit: number;
    usagePercentage: number;
    remaining: number;
  } | null;
  searchQuotaStatus?: {
    regularRemaining: number;
    advancedRemaining: number;
    regularLimit: number;
    advancedLimit: number;
    extraRegularSearches: number;
    extraAdvancedSearches: number;
  } | null;
  activeTrigger?: string;
}

export function QuotaDisplay({ quotaStatus, searchQuotaStatus, activeTrigger }: QuotaDisplayProps) {
  const { language } = useTheme();

  console.log('QuotaDisplay props:', { quotaStatus, searchQuotaStatus, activeTrigger });

  // Only show quota for search modes
  if (activeTrigger !== 'search' && activeTrigger !== 'advanced_search') {
    return null;
  }

  // If we're in search mode and have search quota data, show search-specific quota
  if ((activeTrigger === 'search' || activeTrigger === 'advanced_search') && searchQuotaStatus) {
    const isAdvanced = activeTrigger === 'advanced_search';
    const remaining = isAdvanced ? searchQuotaStatus.advancedRemaining : searchQuotaStatus.regularRemaining;
    const limit = isAdvanced ? searchQuotaStatus.advancedLimit : searchQuotaStatus.regularLimit;
    const extraSearches = isAdvanced ? searchQuotaStatus.extraAdvancedSearches : searchQuotaStatus.extraRegularSearches;
    
    // Ensure we have valid numbers
    const validRemaining = typeof remaining === 'number' && !isNaN(remaining) ? remaining : 0;
    const validLimit = typeof limit === 'number' && !isNaN(limit) ? limit : (isAdvanced ? 5 : 15);
    const validExtras = typeof extraSearches === 'number' && !isNaN(extraSearches) ? extraSearches : 0;
    
    const usagePercentage = validLimit > 0 ? Math.round(((validLimit - validRemaining) / validLimit) * 100) : 0;
    
    console.log('Quota calculation:', {
      isAdvanced,
      validRemaining,
      validLimit,
      validExtras,
      usagePercentage
    });
    
    const getQuotaColor = (percentage: number) => {
      if (percentage >= 90) return 'destructive';
      if (percentage >= 70) return 'secondary';
      return 'default';
    };

    const totalAvailable = validRemaining + validExtras;
    const totalLimit = validLimit + validExtras;

    return (
      <div className="flex items-center gap-2">
        <Badge variant={getQuotaColor(usagePercentage)} className="text-xs">
          {totalAvailable}/{totalLimit}
        </Badge>
        <div className="hidden sm:flex items-center gap-2">
          <Progress 
            value={usagePercentage} 
            className="w-16 h-2" 
          />
          <span className="text-xs text-muted-foreground">
            {language === 'ar' ? 'متبقي' : 'left'}: {totalAvailable}
          </span>
        </div>
        {validExtras > 0 && (
          <Badge variant="outline" className="text-xs text-green-600">
            +{validExtras}
          </Badge>
        )}
      </div>
    );
  }

  // Don't show general quota for non-search modes
  return null;
}
