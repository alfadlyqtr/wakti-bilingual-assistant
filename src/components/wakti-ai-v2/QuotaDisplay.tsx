
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
    extraSearches: number;
  } | null;
  activeTrigger?: string;
}

export function QuotaDisplay({ quotaStatus, searchQuotaStatus, activeTrigger }: QuotaDisplayProps) {
  const { language } = useTheme();

  // If we're in search mode and have search quota data, show search-specific quota
  if ((activeTrigger === 'search' || activeTrigger === 'advanced_search') && searchQuotaStatus) {
    const isAdvanced = activeTrigger === 'advanced_search';
    const remaining = isAdvanced ? searchQuotaStatus.advancedRemaining : searchQuotaStatus.regularRemaining;
    const limit = isAdvanced ? searchQuotaStatus.advancedLimit : searchQuotaStatus.regularLimit;
    const usagePercentage = Math.round(((limit - remaining) / limit) * 100);
    
    const getQuotaColor = (percentage: number) => {
      if (percentage >= 90) return 'destructive';
      if (percentage >= 70) return 'secondary';
      return isAdvanced ? 'default' : 'default';
    };

    return (
      <div className="flex items-center gap-2">
        <Badge variant={getQuotaColor(usagePercentage)} className="text-xs">
          {remaining}/{limit}
        </Badge>
        <div className="hidden sm:flex items-center gap-2">
          <Progress 
            value={usagePercentage} 
            className="w-16 h-2" 
          />
          <span className="text-xs text-muted-foreground">
            {language === 'ar' ? 'متبقي' : 'left'}: {remaining}
          </span>
        </div>
        {searchQuotaStatus.extraSearches > 0 && (
          <Badge variant="outline" className="text-xs">
            +{searchQuotaStatus.extraSearches}
          </Badge>
        )}
      </div>
    );
  }

  // Fallback to general quota status
  if (!quotaStatus) {
    return null;
  }

  const getQuotaColor = (percentage: number) => {
    if (percentage >= 90) return 'destructive';
    if (percentage >= 70) return 'secondary';
    return 'default';
  };

  return (
    <div className="flex items-center gap-2">
      <Badge variant={getQuotaColor(quotaStatus.usagePercentage)} className="text-xs">
        {quotaStatus.count}/{quotaStatus.limit}
      </Badge>
      <div className="hidden sm:flex items-center gap-2">
        <Progress 
          value={quotaStatus.usagePercentage} 
          className="w-16 h-2" 
        />
        <span className="text-xs text-muted-foreground">
          {language === 'ar' ? 'متبقي' : 'left'}: {quotaStatus.remaining}
        </span>
      </div>
    </div>
  );
}
