// ChatSkeleton - Loading skeleton for chat panel
// Part of Group A Enhancement: UI/UX Design

import React from 'react';
import { cn } from '@/lib/utils';

interface ChatSkeletonProps {
  isRTL?: boolean;
}

export function ChatSkeleton({ isRTL = false }: ChatSkeletonProps) {
  return (
    <div className={cn(
      "space-y-4 p-4 animate-pulse",
      isRTL ? "direction-rtl" : ""
    )}>
      {/* User message skeleton */}
      <div className={cn("flex", isRTL ? "justify-start" : "justify-end")}>
        <div className="w-3/4 max-w-md">
          <div className="h-16 bg-zinc-800/50 rounded-2xl" />
        </div>
      </div>
      
      {/* Assistant message skeleton */}
      <div className={cn("flex", isRTL ? "justify-end" : "justify-start")}>
        <div className="w-full max-w-lg">
          <div className="h-8 bg-zinc-800/50 rounded-lg mb-2 w-3/4" />
          <div className="h-24 bg-zinc-800/50 rounded-2xl" />
        </div>
      </div>
      
      {/* Another user message */}
      <div className={cn("flex", isRTL ? "justify-start" : "justify-end")}>
        <div className="w-2/3 max-w-sm">
          <div className="h-12 bg-zinc-800/50 rounded-2xl" />
        </div>
      </div>
      
      {/* Another assistant message */}
      <div className={cn("flex", isRTL ? "justify-end" : "justify-start")}>
        <div className="w-full max-w-lg">
          <div className="h-6 bg-zinc-800/50 rounded-lg mb-2 w-1/2" />
          <div className="h-32 bg-zinc-800/50 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
