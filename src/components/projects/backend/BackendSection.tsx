import React, { useState } from 'react';
import { ChevronDown, ChevronRight, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BackendSectionProps {
  icon: LucideIcon;
  title: string;
  count?: number;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  isRTL?: boolean;
}

export function BackendSection({ 
  icon: Icon, 
  title, 
  count, 
  subtitle, 
  children, 
  defaultOpen = false,
  actions,
  isRTL = false
}: BackendSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-border/50 dark:border-white/10 rounded-xl overflow-hidden bg-card/50 dark:bg-white/5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 dark:hover:bg-white/5 transition-colors",
          isRTL && "flex-row-reverse"
        )}
      >
        <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
          <div className="p-2 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20">
            <Icon className="h-4 w-4 text-indigo-500" />
          </div>
          <div className={cn("text-left", isRTL && "text-right")}>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              {typeof count === 'number' && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                  {count}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        
        <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
          {actions && (
            <div onClick={(e) => e.stopPropagation()}>
              {actions}
            </div>
          )}
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>
      
      {isOpen && (
        <div className="border-t border-border/50 dark:border-white/10">
          {children}
        </div>
      )}
    </div>
  );
}
