import React from 'react';
import { Code2 } from 'lucide-react';

interface SandpackSkeletonProps {
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  isRTL?: boolean;
}

export function SandpackSkeleton({ 
  isLoading = true, 
  isError = false, 
  errorMessage,
  isRTL = false 
}: SandpackSkeletonProps) {
  if (isError) {
    return (
      <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center shadow-lg shadow-red-500/30 mb-4">
          <Code2 className="w-8 h-8 text-white" />
        </div>
        <p className="text-sm text-red-400 font-medium">
          {isRTL ? 'خطأ في التوليد' : 'Generation Error'}
        </p>
        <p className="mt-2 text-xs text-gray-500 text-center max-w-xs px-4">
          {errorMessage || (isRTL 
            ? 'أعاد الذكاء الاصطناعي كوداً غير صالح. يرجى المحاولة مرة أخرى.'
            : 'The AI returned invalid code. Please try again with a different prompt.'
          )}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center">
        <div className="relative">
          {/* Animated rings */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full border-2 border-indigo-500/30 animate-ping" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-2 border-purple-500/50 animate-pulse" />
          </div>
          {/* Center icon */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Code2 className="w-6 h-6 text-white animate-pulse" />
          </div>
        </div>
        <p className="mt-6 text-sm text-gray-400 animate-pulse">
          {isRTL ? 'جارٍ بناء مشروعك...' : 'Building your project...'}
        </p>
        <p className="mt-2 text-xs text-gray-600">
          {isRTL ? 'قد يستغرق هذا حتى 3 دقائق' : 'This may take up to 3 minutes'}
        </p>
      </div>
    );
  }

  // Waiting state (no files yet)
  return (
    <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center">
      <div className="relative">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <Code2 className="w-6 h-6 text-white animate-pulse" />
        </div>
      </div>
      <p className="mt-6 text-sm text-gray-400 animate-pulse">
        {isRTL ? 'في انتظار الكود...' : 'Waiting for code...'}
      </p>
    </div>
  );
}

/**
 * Skeleton loader for the preview panel during Sandpack initialization
 */
export function SandpackPreviewSkeleton({ isRTL = false }: { isRTL?: boolean }) {
  return (
    <div className="absolute inset-0 bg-slate-950 flex flex-col p-4 animate-pulse">
      {/* Header skeleton */}
      <div className="h-12 bg-zinc-800/50 rounded-lg mb-4" />
      
      {/* Content skeleton */}
      <div className="flex-1 flex gap-4">
        {/* Sidebar skeleton */}
        <div className="w-1/4 space-y-3">
          <div className="h-8 bg-zinc-800/50 rounded" />
          <div className="h-8 bg-zinc-800/50 rounded w-4/5" />
          <div className="h-8 bg-zinc-800/50 rounded w-3/5" />
          <div className="h-8 bg-zinc-800/50 rounded w-4/5" />
        </div>
        
        {/* Main content skeleton */}
        <div className="flex-1 bg-zinc-800/30 rounded-lg p-4">
          <div className="h-6 bg-zinc-700/50 rounded w-1/3 mb-4" />
          <div className="h-4 bg-zinc-700/30 rounded w-full mb-2" />
          <div className="h-4 bg-zinc-700/30 rounded w-5/6 mb-2" />
          <div className="h-4 bg-zinc-700/30 rounded w-4/6 mb-4" />
          
          <div className="h-32 bg-zinc-700/20 rounded mb-4" />
          
          <div className="h-4 bg-zinc-700/30 rounded w-2/3 mb-2" />
          <div className="h-4 bg-zinc-700/30 rounded w-1/2" />
        </div>
      </div>
      
      {/* Status indicator */}
      <div className="mt-4 flex items-center justify-center gap-2">
        <div className="w-3 h-3 bg-indigo-500 rounded-full animate-ping" />
        <span className="text-xs text-zinc-500">
          {isRTL ? 'جارٍ تهيئة المعاينة...' : 'Initializing preview...'}
        </span>
      </div>
    </div>
  );
}
