import { RefObject, useEffect } from 'react';
import { isInNativeApp, openInSafari } from '@/integrations/natively/browserBridge';

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

      event.preventDefault();
      event.stopPropagation();

      openInSafari(url.toString());
    };

    container.addEventListener('click', handleClick, true);
    return () => {
      container.removeEventListener('click', handleClick, true);
    };
  }, [containerRef, enabled]);
}
