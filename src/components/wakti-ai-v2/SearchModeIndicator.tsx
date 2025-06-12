
import React from 'react';
import { Search, Zap } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { cn } from '@/lib/utils';

interface SearchModeIndicatorProps {
  isVisible: boolean;
  searchType?: 'search' | 'enhanced_search';
  quotaInfo?: {
    remaining: number;
    total: number;
  };
}

export function SearchModeIndicator({ isVisible, searchType = 'search', quotaInfo }: SearchModeIndicatorProps) {
  const { language } = useTheme();

  if (!isVisible) return null;

  const isEnhanced = searchType === 'enhanced_search';

  const getDisplayText = () => {
    if (isEnhanced && quotaInfo) {
      const baseText = language === 'ar' ? 'البحث المحسن' : 'Enhanced Search';
      return `${baseText} (${quotaInfo.remaining}/${quotaInfo.total})`;
    }
    
    return isEnhanced 
      ? (language === 'ar' ? 'البحث المحسن' : 'Enhanced Search')
      : (language === 'ar' ? 'البحث العادي' : 'Regular Search');
  };

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
      isEnhanced 
        ? "bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700/50"
        : "bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700/50"
    )}>
      {isEnhanced ? <Zap className="h-3 w-3" /> : <Search className="h-3 w-3" />}
      <span>{getDisplayText()}</span>
    </div>
  );
}
