// ThinkingTimer - Lovable-style thinking timer display
// Part of Group A Enhancement: UI/UX Design

import React, { useState, useEffect } from 'react';
import { Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThinkingTimerProps {
  startTime: number;
  isRTL: boolean;
}

export function ThinkingTimer({ startTime, isRTL }: ThinkingTimerProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const initialElapsed = Math.floor((Date.now() - startTime) / 1000);
    setElapsedSeconds(initialElapsed);

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const label = isRTL ? `فكّر لمدة ${elapsedSeconds} ث` : `Thought for ${elapsedSeconds}s`;

  return (
    <div className={cn(
      "flex items-center gap-2 mb-3 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 animate-in fade-in slide-in-from-left-2 duration-500 shadow-sm",
      isRTL ? "flex-row-reverse" : ""
    )}>
      <div className="relative">
        <div className="absolute inset-0 bg-amber-500/40 rounded-full animate-ping" />
        <Lightbulb className="h-3.5 w-3.5 text-amber-500 relative z-10" />
      </div>
      <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
        {label}
      </span>
    </div>
  );
}
