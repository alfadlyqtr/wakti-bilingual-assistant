import { useState, useEffect } from 'react';

interface UseMobileKeyboardOptions {
  enabled?: boolean;
}

export function useMobileKeyboard({ enabled = true }: UseMobileKeyboardOptions = {}) {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    let initialViewportHeight = window.visualViewport?.height || window.innerHeight;
    let timeoutId: NodeJS.Timeout;

    const handleViewportChange = () => {
      // Clear any pending updates
      if (timeoutId) clearTimeout(timeoutId);
      
      // Small delay to ensure viewport measurement is stable
      timeoutId = setTimeout(() => {
        const currentHeight = window.visualViewport?.height || window.innerHeight;
        const heightDifference = initialViewportHeight - currentHeight;
        
        // Consider keyboard visible if viewport shrunk by more than 150px
        // This threshold helps avoid false positives from browser UI changes
        const keyboardVisible = heightDifference > 150;
        
        setIsKeyboardVisible(keyboardVisible);
        setKeyboardHeight(keyboardVisible ? heightDifference : 0);
        
        // Update CSS custom properties for use in components
        document.documentElement.style.setProperty(
          '--keyboard-height',
          keyboardVisible ? `${heightDifference}px` : '0px'
        );
        document.documentElement.style.setProperty(
          '--is-keyboard-visible',
          keyboardVisible ? '1' : '0'
        );
        
        // Dispatch custom event for other components to listen to
        window.dispatchEvent(new CustomEvent('mobile-keyboard-change', {
          detail: { isVisible: keyboardVisible, height: keyboardVisible ? heightDifference : 0 }
        }));
      }, 100);
    };

    // Listen to visual viewport changes (most reliable for keyboard detection)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
    } else {
      // Fallback for older browsers
      window.addEventListener('resize', handleViewportChange);
    }

    // Also listen to focus/blur events on input elements as additional signals
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        // Small delay to let the keyboard animation start
        setTimeout(handleViewportChange, 300);
      }
    };

    const handleFocusOut = () => {
      // Small delay to let the keyboard hide animation complete
      setTimeout(handleViewportChange, 300);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    // Initial check
    handleViewportChange();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
      } else {
        window.removeEventListener('resize', handleViewportChange);
      }
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      
      // Clean up CSS properties
      document.documentElement.style.removeProperty('--keyboard-height');
      document.documentElement.style.removeProperty('--is-keyboard-visible');
    };
  }, [enabled]);

  return {
    isKeyboardVisible,
    keyboardHeight
  };
}