import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [mounted, setMounted] = useState(false);
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const [lastOpenedAt, setLastOpenedAt] = useState<number>(0);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setMounted(true);
    setPortalEl(typeof document !== 'undefined' ? document.body : null);
  }, []);
  useEffect(() => {
    if (open) setLastOpenedAt(Date.now());
  }, [open]);
  // Track viewport for mobile-specific sizing
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => setIsMobile(mq.matches);
    try { mq.addEventListener('change', apply); } catch { /* safari */ }
    apply();
    return () => { try { mq.removeEventListener('change', apply); } catch {} };
  }, []);
  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const content = (
    <>
      {/* Overlay constrained between header and bottom bar */}
      <div
        aria-hidden
        // Mobile: between header and bottom tabs; Desktop/Tablet: full height next to sidebar
        className={cn(
          'fixed inset-x-0 z-[12000] md:z-[850] bg-black/20 backdrop-blur-md ios-reduce-blur transition-opacity duration-300',
          'top-[var(--app-header-h)] bottom-0',
          'md:top-0 md:bottom-0 md:left-[var(--current-sidebar-width,0px)] md:right-0',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
          overlayClassName,
        )}
        onPointerDown={() => {
          // Prevent the tap that opened the sheet from immediately closing it
          if (Date.now() - lastOpenedAt < 250) return;
          onOpenChange(false);
        }}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        // Desktop/Tablet: full height; Mobile: constrained between header and tabs
        className={cn(
          'fixed inset-x-auto z-[12010] md:z-[900] bg-background focus:outline-none flex flex-col shadow-2xl',
          // Compact width on mobile; fixed width on desktop
          'w-[360px] max-w-[92vw] md:w-96',
          // Rounded edges visible on mobile
          'rounded-2xl',
          // Positioning: mobile uses offsets so height is not full; desktop stays full
          'top-[var(--app-header-h)] bottom-0',
          'md:top-0 md:bottom-0',
          side === 'right' ? 'right-0' : 'left-0 md:left-[var(--current-sidebar-width,0px)]',
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
        style={isMobile ? { 
          top: 'calc(var(--app-header-h) + 8px)',
          bottom: 'auto',
          maxHeight: 'calc(100dvh - var(--app-header-h) - 8px - 16px)'
        } : undefined}
      >
        <div
          className="overflow-y-auto px-3 sm:px-4 pt-3 pb-0 md:pb-2 md:flex-1"
          style={isMobile ? { maxHeight: 'inherit' } : undefined}
        >
          {children}
        </div>
      </aside>
    </>
  );

  if (!mounted || !portalEl) return null;
  return createPortal(content, portalEl);
}
