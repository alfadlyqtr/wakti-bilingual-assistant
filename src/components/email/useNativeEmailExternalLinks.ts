import { RefObject, useEffect } from 'react';
import { isInNativeApp } from '@/integrations/natively/browserBridge';

function shouldOpenOutside(url: URL): boolean {
  const protocol = url.protocol.toLowerCase();
  return protocol === 'http:'
    || protocol === 'https:'
    || protocol === 'mailto:'
    || protocol === 'tel:'
    || protocol === 'sms:';
}

export function useNativeEmailExternalLinks(containerRef: RefObject<HTMLElement>, enabled: boolean) {
  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (!isInNativeApp()) return;

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (!container.contains(anchor)) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (!shouldOpenOutside(url)) return;

      const nativeWindow = window as Window & typeof globalThis & {
        natively?: { openExternalURL?: (url: string, useExternal?: boolean) => void };
        Natively?: { openExternalURL?: (url: string, useExternal?: boolean) => void };
      };
      const natively = nativeWindow.natively || nativeWindow.Natively;

      anchor.rel = 'noopener noreferrer';
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        anchor.target = '_blank';
      }

      if (!natively || typeof natively.openExternalURL !== 'function') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      natively.openExternalURL(url.toString(), true);
    };

    container.addEventListener('click', handleClick, true);
    return () => {
      container.removeEventListener('click', handleClick, true);
    };
  }, [containerRef, enabled]);
}