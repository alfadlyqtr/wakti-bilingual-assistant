import { useState, useEffect, useRef } from 'react';

interface UseMobileKeyboardOptions {
  enabled?: boolean;
}

export function useMobileKeyboard({ enabled = true }: UseMobileKeyboardOptions = {}) {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const lastHeightRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const debounceIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const cancelTimers = () => {
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      if (debounceIdRef.current != null) window.clearTimeout(debounceIdRef.current);
      rafIdRef.current = null;
      debounceIdRef.current = null;
    };

    const measureKeyboard = () => {
      const vv = window.visualViewport;
      const vvH = vv?.height ?? window.innerHeight;
      const vvTop = vv?.offsetTop ?? 0;
      // Exact free viewport space from bottom (includes iOS accessory bar)
      const raw = Math.max(0, window.innerHeight - (vvH + vvTop));

      // Remove hysteresis to avoid underestimation gaps; round up to prevent 1px seams
      const height = Math.ceil(raw);
      lastHeightRef.current = height;

      const visible = height > 60; // detect earlier and reliably
      const clamped = visible ? Math.min(Math.max(height, 60), 700) : 0;

      setIsKeyboardVisible(visible);
      setKeyboardHeight(clamped);

      // Expose as CSS vars for layout consumers
      document.documentElement.style.setProperty('--keyboard-height', `${clamped}px`);
      document.documentElement.style.setProperty('--viewport-height', `${vvH}px`);
      document.documentElement.style.setProperty('--is-keyboard-visible', visible ? '1' : '0');

      if (visible) document.body.classList.add('keyboard-visible');
      else document.body.classList.remove('keyboard-visible');

      window.dispatchEvent(new CustomEvent('mobile-keyboard-change', {
        detail: { isVisible: visible, height: clamped, viewportHeight: vvH }
      }));
    };

    const scheduleMeasure = () => {
      if (debounceIdRef.current != null) window.clearTimeout(debounceIdRef.current);
      debounceIdRef.current = window.setTimeout(() => {
        if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(() => {
          measureKeyboard();
          // Second pass to catch iOS accessory/prediction bar settling
          window.setTimeout(measureKeyboard, 140);
        });
      }, 100);
    };

    const handleViewportChange = () => scheduleMeasure();

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
    } else {
      window.addEventListener('resize', handleViewportChange);
      window.addEventListener('scroll', handleViewportChange, { passive: true });
    }

    const handleFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.getAttribute('contenteditable') === 'true')) {
        scheduleMeasure();
      }
    };
    const handleFocusOut = () => scheduleMeasure();

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    // Initial measurement (debounced)
    scheduleMeasure();

    return () => {
      cancelTimers();
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
        window.visualViewport.removeEventListener('scroll', handleViewportChange);
      } else {
        window.removeEventListener('resize', handleViewportChange);
        window.removeEventListener('scroll', handleViewportChange);
      }
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      document.documentElement.style.removeProperty('--keyboard-height');
      document.documentElement.style.removeProperty('--is-keyboard-visible');
    };
  }, [enabled]);

  return { isKeyboardVisible, keyboardHeight };
}