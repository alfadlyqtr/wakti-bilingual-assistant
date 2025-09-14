import React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  Icon?: React.ComponentType<{ className?: string }>;
  colorClass?: string; // e.g. nav-icon-ai, nav-icon-maw3d, text-cyan-500
  actions?: React.ReactNode;
  subtitle?: string;
  sticky?: boolean;
}

export function PageHeader({ title, Icon, colorClass, actions, subtitle, sticky = true }: PageHeaderProps) {
  return (
    <div className={cn(
      'w-full',
      sticky ? 'sticky top-0 z-10 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60' : ''
    )}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-h-[40px]">
            {Icon ? <Icon className={cn('h-5 w-5 md:h-6 md:w-6', colorClass)} /> : null}
            <div>
              <h1 className="text-xl md:text-2xl lg:text-3xl font-semibold text-foreground">
                {title}
              </h1>
              {subtitle ? (
                <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{subtitle}</p>
              ) : null}
            </div>
          </div>
          {actions ? (
            <div className="shrink-0 flex items-center gap-2">{actions}</div>
          ) : null}
        </div>
      </div>
      {/* subtle divider */}
      <div className="border-b border-border/50" />
    </div>
  );
}
