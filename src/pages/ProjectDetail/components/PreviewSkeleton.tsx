// PreviewSkeleton - Loading skeleton for Sandpack preview
// Part of Group A Enhancement: UI/UX Design

import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface PreviewSkeletonProps {
  deviceView?: 'desktop' | 'tablet' | 'mobile';
  isRTL?: boolean;
}

export function PreviewSkeleton({ deviceView = 'desktop', isRTL = false }: PreviewSkeletonProps) {
  // Calculate skeleton dimensions based on device view
  const getSkeletonStyle = () => {
    switch (deviceView) {
      case 'mobile':
        return 'w-[375px] h-[667px]';
      case 'tablet':
        return 'w-[768px] h-[1024px] max-h-[80vh]';
      default:
        return 'w-full h-full';
    }
  };

  return (
    <div className={cn(
      "flex items-center justify-center bg-zinc-900/50 rounded-xl overflow-hidden",
      getSkeletonStyle()
    )}>
      <div className="flex flex-col items-center gap-4 animate-pulse">
        {/* Branded loading spinner */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur-xl opacity-30 animate-pulse" />
          <div className="relative bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full p-4">
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          </div>
        </div>
        
        {/* Loading text */}
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-zinc-400">
            {isRTL ? 'جاري تحميل المعاينة...' : 'Loading preview...'}
          </p>
          <div className="flex items-center gap-1 justify-center">
            <div className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="h-1.5 w-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="h-1.5 w-1.5 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
        
        {/* Progress bar skeleton */}
        <div className="w-48 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full animate-shimmer" 
            style={{
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s ease-in-out infinite'
            }}
          />
        </div>
      </div>
      
      {/* Custom shimmer animation */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
