
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

interface StatusBadgeProps {
  completed: boolean;
  isOverdue: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ completed, isOverdue }) => {
  const { language } = useTheme();

  if (completed) {
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        {t('completed', language)}
      </Badge>
    );
  }

  if (isOverdue) {
    return (
      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs">
        <AlertTriangle className="w-3 h-3 mr-1" />
        {t('overdue', language)}
      </Badge>
    );
  }

  return null;
};
