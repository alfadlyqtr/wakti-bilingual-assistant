
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

interface PriorityBadgeProps {
  priority: 'normal' | 'high' | 'urgent';
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority }) => {
  const { language } = useTheme();
  
  const config = {
    normal: {
      bg: 'bg-blue-100/70 dark:bg-blue-900/30',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-200/50 dark:border-blue-700/40',
      dot: 'bg-blue-500',
    },
    high: {
      bg: 'bg-orange-100/70 dark:bg-orange-900/30',
      text: 'text-orange-700 dark:text-orange-300',
      border: 'border-orange-200/50 dark:border-orange-700/40',
      dot: 'bg-orange-500',
    },
    urgent: {
      bg: 'bg-red-100/70 dark:bg-red-900/30',
      text: 'text-red-700 dark:text-red-300',
      border: 'border-red-200/50 dark:border-red-700/40',
      dot: 'bg-red-500',
    },
  }[priority] || {
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-300',
    border: 'border-slate-200/50 dark:border-slate-700/40',
    dot: 'bg-slate-400',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${config.bg} ${config.text} ${config.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {t(priority, language)}
    </span>
  );
};
