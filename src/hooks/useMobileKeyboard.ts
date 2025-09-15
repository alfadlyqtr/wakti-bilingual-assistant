import { useState, useEffect, useRef } from 'react';

interface UseMobileKeyboardOptions {
  enabled?: boolean;
}

export function useMobileKeyboard({ enabled = true }: UseMobileKeyboardOptions = {}) {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const initialViewportHeightRef = useRef<number | null>(null);
  const lastHeightRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const debounceIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    initialViewportHeightRef.current = window.visualViewport?.height || window.innerHeight;

    const cancelTimers = () => {
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      if (debounceIdRef.current != null) window.clearTimeout(debounceIdRef.current);
      rafIdRef.current = null;
      debounceIdRef.current = null;
    };

    const applyChange = () => {
      const base = initialViewportHeightRef.current ?? (window.visualViewport?.height || window.innerHeight);
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      const diffRaw = Math.max(0, base - currentHeight);

      // Hysteresis to avoid flicker: ignore tiny oscillations < 24px
      const last = lastHeightRef.current;
      const diff = Math.abs(diffRaw - last) < 24 ? last : diffRaw;

      const visible = diff > 100; // threshold for keyboard visibility
      lastHeightRef.current = diff;

      setIsKeyboardVisible(visible);
      setKeyboardHeight(visible ? Math.min(Math.max(diff, 100), 500) : 0);

      // Update CSS Custom Properties for layouts relying on them
      document.documentElement.style.setProperty('--keyboard-height', visible ? `${Math.min(Math.max(diff, 100), 500)}px` : '0px');
      document.documentElement.style.setProperty('--viewport-height', `${currentHeight}px`);
      document.documentElement.style.setProperty('--is-keyboard-visible', visible ? '1' : '0');

      if (visible) {
        document.body.classList.add('keyboard-visible');
      } else {
        document.body.classList.remove('keyboard-visible');
      }

      window.dispatchEvent(new CustomEvent('mobile-keyboard-change', {
        detail: {
          isVisible: visible,
          height: visible ? Math.min(Math.max(diff, 100), 500) : 0,
          viewportHeight: currentHeight,
        }
      }));
    };

    const scheduleChange = () => {
      // Debounce to 120ms to let the OS animation settle
      if (debounceIdRef.current != null) window.clearTimeout(debounceIdRef.current);
      debounceIdRef.current = window.setTimeout(() => {
        if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(applyChange);
      }, 120);
    };

    const handleViewportChange = () => scheduleChange();

    // visualViewport is the most reliable API
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
    } else {
      window.addEventListener('resize', handleViewportChange);
      window.addEventListener('scroll', handleViewportChange, { passive: true });
    }

    // Focus/blur hints
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        scheduleChange();
      }
    };
    const handleFocusOut = () => scheduleChange();

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    // Initial measure (debounced)
    scheduleChange();

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

  return {
    isKeyboardVisible,
    keyboardHeight
  };
}