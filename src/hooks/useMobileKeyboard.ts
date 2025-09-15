import { useState, useEffect } from 'react';

interface UseMobileKeyboardOptions {
  enabled?: boolean;
}

export function useMobileKeyboard({ enabled = true }: UseMobileKeyboardOptions = {}) {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    // Skip on desktop
    if (window.innerWidth >= 768) return;

    let initialViewportHeight = window.visualViewport?.height || window.innerHeight;
    let timeoutId: NodeJS.Timeout;
    let isInitialized = false;

    const handleViewportChange = () => {
      // Clear any pending updates
      if (timeoutId) clearTimeout(timeoutId);
      
      // Immediate update for better responsiveness, then stabilization check
      timeoutId = setTimeout(() => {
        const currentHeight = window.visualViewport?.height || window.innerHeight;
        const heightDifference = initialViewportHeight - currentHeight;
        
        // More sensitive detection for mobile keyboards (80px threshold)
        const keyboardVisible = heightDifference > 80;
        
        // Only update if there's a meaningful change to prevent flickering
        if (!isInitialized || keyboardVisible !== isKeyboardVisible) {
          setIsKeyboardVisible(keyboardVisible);
          setKeyboardHeight(keyboardVisible ? heightDifference : 0);
          
          // Mobile-only CSS variables for native-like positioning
          document.documentElement.style.setProperty(
            '--mobile-keyboard-height',
            keyboardVisible ? `${heightDifference}px` : '0px'
          );
          document.documentElement.style.setProperty(
            '--mobile-viewport-height',
            `${currentHeight}px`
          );
          document.documentElement.style.setProperty(
            '--mobile-keyboard-visible',
            keyboardVisible ? '1' : '0'
          );
          
          // Body classes for mobile keyboard state
          if (keyboardVisible) {
            document.body.classList.add('mobile-keyboard-visible');
            document.body.classList.remove('mobile-keyboard-hidden');
          } else {
            document.body.classList.remove('mobile-keyboard-visible');
            document.body.classList.add('mobile-keyboard-hidden');
          }
          
          // Dispatch event for other components
          window.dispatchEvent(new CustomEvent('mobile-keyboard-change', {
            detail: { 
              isVisible: keyboardVisible, 
              height: keyboardVisible ? heightDifference : 0,
              viewportHeight: currentHeight 
            }
          }));
          
          isInitialized = true;
        }
      }, 25); // Faster response for native feel
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
      
      // Clean up mobile CSS properties
      document.documentElement.style.removeProperty('--mobile-keyboard-height');
      document.documentElement.style.removeProperty('--mobile-viewport-height');
      document.documentElement.style.removeProperty('--mobile-keyboard-visible');
      document.body.classList.remove('mobile-keyboard-visible', 'mobile-keyboard-hidden');
    };
  }, [enabled]);

  return {
    isKeyboardVisible,
    keyboardHeight
  };
}