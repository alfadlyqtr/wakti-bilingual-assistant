
import React from 'react';
import { Bot, Search, ImagePlus } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { cn } from '@/lib/utils';

interface ActiveModeIndicatorProps {
  activeTrigger: string;
}

export function ActiveModeIndicator({ activeTrigger }: ActiveModeIndicatorProps) {
  const { language } = useTheme();

  const getModeConfig = (trigger: string) => {
    switch (trigger) {
      case 'chat':
        return {
          icon: Bot,
          label: language === 'ar' ? 'المحادثة' : 'Chat Mode',
          className: "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700/50"
        };
      case 'search':
        return {
          icon: Search,
          label: language === 'ar' ? 'البحث' : 'Search Mode',
          className: "bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700/50"
        };
      case 'image':
        return {
          icon: ImagePlus,
          label: language === 'ar' ? 'إنشاء الصور' : 'Image Mode',
          className: "bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700/50"
        };
      default:
        return null;
    }
  };

  const config = getModeConfig(activeTrigger);

  if (!config) return null;

  const { icon: Icon, label, className } = config;

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
      className
    )}>
      <Icon className="h-3 w-3" />
      <span>{label}</span>
    </div>
  );
}
