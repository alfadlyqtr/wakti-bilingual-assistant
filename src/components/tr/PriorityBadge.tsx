
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

interface PriorityBadgeProps {
  priority: 'normal' | 'high' | 'urgent';
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority }) => {
  const { language } = useTheme();
  
  const getPriorityStyles = () => {
    switch (priority) {
      case 'normal':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'urgent':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <Badge className={`${getPriorityStyles()} text-xs`}>
      {t(priority, language)}
    </Badge>
  );
};
