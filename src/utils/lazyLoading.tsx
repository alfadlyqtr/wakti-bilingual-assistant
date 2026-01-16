import React, { Suspense, lazy, ComponentType } from 'react';
import { SkeletonPulse } from '@/components/ui/AnimatedContainer';

// Lazy loading utilities for code splitting

/**
 * Create a lazy-loaded component with a fallback
 */
export function lazyWithFallback<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = lazy(importFn);
  
  return function LazyWrapper(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={fallback || <DefaultFallback />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

/**
 * Default loading fallback
 */
function DefaultFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="space-y-4 w-full max-w-md">
        <SkeletonPulse className="h-8 w-3/4" />
        <SkeletonPulse className="h-4 w-full" />
        <SkeletonPulse className="h-4 w-5/6" />
        <SkeletonPulse className="h-4 w-2/3" />
      </div>
    </div>
  );
}

/**
 * Loading skeleton for cards
 */
export function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 space-y-4 border border-zinc-200 dark:border-zinc-800">
      <SkeletonPulse className="h-6 w-1/2" />
      <SkeletonPulse className="h-4 w-full" />
      <SkeletonPulse className="h-4 w-3/4" />
      <div className="flex gap-2 pt-2">
        <SkeletonPulse className="h-8 w-20 rounded-lg" />
        <SkeletonPulse className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Loading skeleton for lists
 */
export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <SkeletonPulse className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <SkeletonPulse className="h-4 w-1/3" />
            <SkeletonPulse className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Loading skeleton for chat messages
 */
export function ChatSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {/* User message */}
      <div className="flex justify-end">
        <SkeletonPulse className="h-12 w-2/3 rounded-2xl rounded-br-md" />
      </div>
      {/* Assistant message */}
      <div className="flex justify-start">
        <div className="space-y-2">
          <SkeletonPulse className="h-16 w-80 rounded-2xl rounded-bl-md" />
        </div>
      </div>
      {/* User message */}
      <div className="flex justify-end">
        <SkeletonPulse className="h-10 w-1/2 rounded-2xl rounded-br-md" />
      </div>
    </div>
  );
}

/**
 * Loading skeleton for code editor
 */
export function CodeEditorSkeleton() {
  return (
    <div className="bg-zinc-900 rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
        <SkeletonPulse className="h-3 w-3 rounded-full" />
        <SkeletonPulse className="h-3 w-3 rounded-full" />
        <SkeletonPulse className="h-3 w-3 rounded-full" />
        <SkeletonPulse className="h-4 w-24 ml-4" />
      </div>
      <div className="space-y-1.5 pt-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <SkeletonPulse className="h-4 w-6" />
            <SkeletonPulse 
              className={`h-4 w-[${Math.floor(Math.random() * 50 + 30)}%]`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Full page loading state
 */
export function PageLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <SkeletonPulse className="h-8 w-48" />
          <div className="flex gap-2">
            <SkeletonPulse className="h-10 w-10 rounded-lg" />
            <SkeletonPulse className="h-10 w-10 rounded-lg" />
          </div>
        </div>
        
        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <div className="space-y-4">
            <CardSkeleton />
            <ListSkeleton count={3} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Intersection Observer hook for lazy loading
 */
export function useLazyLoad(
  ref: React.RefObject<HTMLElement>,
  options?: IntersectionObserverInit
) {
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px',
        ...options,
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [ref, options]);

  return isVisible;
}

/**
 * Lazy loading wrapper component
 */
interface LazyLoadWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
}

export function LazyLoadWrapper({ children, fallback, className }: LazyLoadWrapperProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const isVisible = useLazyLoad(ref);

  return (
    <div ref={ref} className={className}>
      {isVisible ? children : (fallback || <DefaultFallback />)}
    </div>
  );
}
