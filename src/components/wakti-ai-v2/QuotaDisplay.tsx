
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
}

export function QuotaDisplay({ quotaStatus }: QuotaDisplayProps) {
  const { language } = useTheme();

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
