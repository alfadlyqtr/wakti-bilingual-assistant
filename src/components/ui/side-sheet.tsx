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
          'fixed inset-x-0 z-[12000] md:z-[998] bg-black/50 backdrop-blur-2xl saturate-150 transition-opacity duration-300',
          'top-[var(--app-header-h)] bottom-0',
          'md:top-0 md:bottom-0 md:right-0',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
          overlayClassName,
        )}
        style={{ 
          backdropFilter: 'blur(16px) saturate(150%)', 
          WebkitBackdropFilter: 'blur(16px) saturate(150%)',
          left: isMobile ? 0 : 'calc(var(--current-sidebar-width, 70px) + 0.5rem)'
        }}
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
          'fixed inset-x-auto z-[12010] md:z-[12010] bg-background focus:outline-none flex flex-col',
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
            ? 'translate-x-0 opacity-100 pointer-events-auto shadow-2xl'
            : side === 'right'
              ? 'translate-x-full opacity-0 pointer-events-none shadow-none'
              : '-translate-x-[110%] opacity-0 pointer-events-none shadow-none',
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
