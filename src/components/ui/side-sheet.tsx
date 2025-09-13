import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';

export type SideSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: 'left' | 'right';
  className?: string;
  overlayClassName?: string;
  children: React.ReactNode;
};

// A lightweight, dependency-free side sheet that slides horizontally between
// the fixed AppHeader and bottom tab bar. It avoids any vertical slide-in.
export function SideSheet({
  open,
  onOpenChange,
  side = 'right',
  className,
  overlayClassName,
  children,
}: SideSheetProps) {
  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  return (
    <>
      {/* Overlay constrained between header and bottom bar */}
      <div
        aria-hidden
        className={cn(
          'fixed inset-y-0 z-[850] bg-black/20 backdrop-blur-md transition-opacity duration-300',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
          overlayClassName,
        )}
        style={{
          top: 'var(--app-header-h)',
          bottom: 'var(--app-bottom-tabs-h)',
          left: 0,
          right: 0,
        }}
        onClick={() => onOpenChange(false)}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        className={cn(
          'fixed inset-y-0 z-[900] w-96 max-w-[92vw] bg-background shadow-lg focus:outline-none flex flex-col',
          side === 'right' ? 'right-0' : 'left-0',
          // Force horizontal slide only
          'translate-y-0',
          open
            ? 'translate-x-0'
            : side === 'right'
              ? 'translate-x-full'
              : '-translate-x-full',
          'transition-transform duration-300 ease-out',
          className,
        )}
        style={{
          top: 'var(--app-header-h)',
          bottom: 'var(--app-bottom-tabs-h)',
        }}
      >
        <div
          className="flex-1 overflow-hidden px-3 sm:px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0)+12px)]"
        >
          {children}
        </div>
      </aside>
    </>
  );
}
