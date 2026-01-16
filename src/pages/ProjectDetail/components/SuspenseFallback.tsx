// SuspenseFallback - Loading states for lazy-loaded components
// Part of Group A Enhancement: UX Design - Skeleton loaders

import React from 'react';
import { Loader2, Code2, ImageIcon, FormInput, Database, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SuspenseFallbackProps {
  type?: 'default' | 'backend' | 'stockPhoto' | 'wizard' | 'modal' | 'editor';
  message?: string;
  isRTL?: boolean;
}

/**
 * Generic loading fallback for Suspense boundaries.
 * Use with lazy-loaded components.
 */
export function SuspenseFallback({ 
  type = 'default', 
  message,
  isRTL = false 
}: SuspenseFallbackProps) {
  const getIcon = () => {
    switch (type) {
      case 'backend':
        return <Database className="w-6 h-6" />;
      case 'stockPhoto':
        return <ImageIcon className="w-6 h-6" />;
      case 'wizard':
        return <FormInput className="w-6 h-6" />;
      case 'editor':
        return <Code2 className="w-6 h-6" />;
      case 'modal':
        return <Settings className="w-6 h-6" />;
      default:
        return <Loader2 className="w-6 h-6 animate-spin" />;
    }
  };

  const getMessage = () => {
    if (message) return message;
    switch (type) {
      case 'backend':
        return isRTL ? 'جاري تحميل لوحة التحكم...' : 'Loading dashboard...';
      case 'stockPhoto':
        return isRTL ? 'جاري تحميل الصور...' : 'Loading photos...';
      case 'wizard':
        return isRTL ? 'جاري تحميل المعالج...' : 'Loading wizard...';
      case 'editor':
        return isRTL ? 'جاري تحميل المحرر...' : 'Loading editor...';
      case 'modal':
        return isRTL ? 'جاري التحميل...' : 'Loading...';
      default:
        return isRTL ? 'جاري التحميل...' : 'Loading...';
    }
  };

  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-8 gap-4",
      "text-muted-foreground animate-in fade-in duration-200"
    )}>
      <div className="relative">
        {/* Animated ring */}
        <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
        {/* Icon container */}
        <div className="relative w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          {getIcon()}
        </div>
      </div>
      <p className="text-sm font-medium">{getMessage()}</p>
    </div>
  );
}

/**
 * Full-page loading state for when the entire content area is loading.
 */
export function FullPageLoader({ isRTL = false }: { isRTL?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <SuspenseFallback type="default" isRTL={isRTL} />
    </div>
  );
}

/**
 * Inline skeleton loader for chat messages or content areas.
 */
export function InlineLoader({ isRTL = false }: { isRTL?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground py-2">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span className="text-xs">{isRTL ? 'جاري التحميل...' : 'Loading...'}</span>
    </div>
  );
}
