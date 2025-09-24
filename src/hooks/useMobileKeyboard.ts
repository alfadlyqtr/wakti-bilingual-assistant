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
      // Use visual viewport when available (iOS Safari 13+)
      const vv = window.visualViewport;
      const vvH = vv?.height ?? window.innerHeight;
      const vvTop = vv?.offsetTop ?? 0;
      
      // Calculate keyboard height more accurately
      const raw = Math.max(0, window.innerHeight - (vvH + vvTop));
      const height = Math.ceil(raw);

      // Check if an editable element is focused
      const ae = document.activeElement as HTMLElement | null;
      const isEditableActive = !!ae && (
        ae.tagName === 'INPUT' ||
        ae.tagName === 'TEXTAREA' ||
        ae.getAttribute('contenteditable') === 'true'
      );

      // More reliable keyboard detection
      const threshold = 150;
      const viewportShrank = window.innerHeight - vvH > threshold;
      const visible = isEditableActive && (height > threshold || viewportShrank);
      const clamped = visible ? Math.max(height, 0) : 0;

      setIsKeyboardVisible(visible);
      setKeyboardHeight(clamped);

      // Set CSS custom properties
      const root = document.documentElement;
      root.style.setProperty('--keyboard-height', `${clamped}px`);
      root.style.setProperty('--viewport-height', `${vvH}px`);
      root.style.setProperty('--visual-viewport-height', `${vvH}px`);
      root.style.setProperty('--is-keyboard-visible', visible ? '1' : '0');
      
      document.body.style.setProperty('--keyboard-height', `${clamped}px`);
      document.body.style.setProperty('--viewport-height', `${vvH}px`);

      if (visible) {
        document.body.classList.add('keyboard-visible');
        document.body.style.height = `${vvH}px`;
      } else {
        document.body.classList.remove('keyboard-visible');
        document.body.style.height = '';
      }

      window.dispatchEvent(new CustomEvent('mobile-keyboard-change', {
        detail: { 
          isVisible: visible, 
          height: clamped, 
          viewportHeight: vvH,
          windowHeight: window.innerHeight 
        }
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
      // Ensure variables are explicitly reset so no layout reserves space after unmount
      try {
        document.documentElement.style.setProperty('--keyboard-height', '0px');
        document.documentElement.style.setProperty('--is-keyboard-visible', '0');
        document.documentElement.style.removeProperty('--viewport-height');
        document.body.classList.remove('keyboard-visible');
      } catch {}
    };
  }, [enabled]);

  return { isKeyboardVisible, keyboardHeight };
}