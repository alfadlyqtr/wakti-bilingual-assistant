
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
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100/70 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-700/40">
        <CheckCircle2 className="w-3 h-3" />
        {t('completed', language)}
      </span>
    );
  }

  if (isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-100/70 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200/50 dark:border-red-700/40">
        <AlertTriangle className="w-3 h-3" />
        {t('overdue', language)}
      </span>
    );
  }

  return null;
};
