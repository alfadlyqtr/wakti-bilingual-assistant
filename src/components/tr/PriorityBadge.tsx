
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
      gradient: 'bg-gradient-to-r from-blue-50 to-indigo-50/80 dark:from-blue-900/25 dark:to-indigo-900/15',
      text: 'text-blue-600 dark:text-blue-400',
      dot: 'bg-gradient-to-br from-blue-400 to-blue-600 shadow-[0_0_4px_hsla(210,100%,55%,0.4)]',
    },
    high: {
      gradient: 'bg-gradient-to-r from-orange-50 to-amber-50/80 dark:from-orange-900/25 dark:to-amber-900/15',
      text: 'text-orange-600 dark:text-orange-400',
      dot: 'bg-gradient-to-br from-orange-400 to-orange-600 shadow-[0_0_4px_hsla(25,95%,55%,0.4)]',
    },
    urgent: {
      gradient: 'bg-gradient-to-r from-red-50 to-rose-50/80 dark:from-red-900/25 dark:to-rose-900/15',
      text: 'text-red-600 dark:text-red-400',
      dot: 'bg-gradient-to-br from-red-400 to-red-600 shadow-[0_0_4px_hsla(0,80%,55%,0.4)]',
    },
  }[priority] || {
    gradient: 'bg-slate-100/80 dark:bg-white/[0.05]',
    text: 'text-slate-500 dark:text-slate-400',
    dot: 'bg-slate-400',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg
      ${config.gradient} ${config.text}
      shadow-[inset_0_1px_0_hsla(0,0%,100%,0.5)]`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {t(priority, language)}
    </span>
  );
};
