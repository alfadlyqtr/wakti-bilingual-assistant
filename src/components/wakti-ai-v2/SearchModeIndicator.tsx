
import React from 'react';
import { Search } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { cn } from '@/lib/utils';

interface SearchModeIndicatorProps {
  isVisible: boolean;
}

export function SearchModeIndicator({ isVisible }: SearchModeIndicatorProps) {
  const { language } = useTheme();

  if (!isVisible) return null;

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2 py-1 rounded-full",
      "bg-green-100 text-green-700 border border-green-200",
      "dark:bg-green-900/30 dark:text-green-400 dark:border-green-700/50",
      "text-xs font-medium"
    )}>
      <Search className="h-3 w-3" />
      <span>{language === 'ar' ? 'وضع البحث' : 'Search Mode'}</span>
    </div>
  );
}
