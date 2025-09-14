import React from 'react';
import { cn } from '@/lib/utils';

interface PageTitleProps {
  title: string;
  Icon?: React.ComponentType<{ className?: string }>;
  className?: string;
  colorClass?: string; // e.g. nav-icon-ai, nav-icon-maw3d
  subtitle?: string;
}

export function PageTitle({ title, Icon, className, colorClass, subtitle }: PageTitleProps) {
  return (
    <div className={cn('flex items-center gap-3 mb-4', className)}>
      {Icon ? (
        <Icon className={cn('h-5 w-5', colorClass)} />
      ) : null}
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
