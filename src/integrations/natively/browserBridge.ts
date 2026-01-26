/**
 * Natively Browser Bridge
 * Provides integration with external browser (Safari) via Natively SDK
 */

declare global {
  interface Window {
    NativelyBrowser?: any;
    natively?: any;
    Natively?: any;
  }
}

/**
 * Check if running inside Natively wrapper
 */
export function isNativelyApp(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(
    window.natively || 
    window.Natively || 
    window.NativelyBrowser ||
    navigator.userAgent.includes('Natively')
  );
}

/**
 * Open URL in external Safari browser (not in-app browser)
 * This is needed for .pkpass files which Safari handles natively
 */
export function openInSafari(url: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    // Try Natively SDK methods
    const natively = window.natively || window.Natively;
    
    if (natively) {
      // Method 1: Direct openExternalURL
      if (typeof natively.openExternalURL === 'function') {
        natively.openExternalURL(url);
        return true;
      }
      
      // Method 2: Browser module
      if (natively.browser?.openExternalURL) {
        natively.browser.openExternalURL(url);
        return true;
      }
      
      // Method 3: openURL with external flag
      if (typeof natively.openURL === 'function') {
        natively.openURL(url, { external: true });
        return true;
      }
    }

    // Method 4: NativelyBrowser class
    if (window.NativelyBrowser) {
      const browser = new window.NativelyBrowser();
      if (typeof browser.openExternalURL === 'function') {
        browser.openExternalURL(url);
        return true;
      }
    }

    // Fallback: Use window.open with _system target (works in some wrappers)
    // For iOS Safari, this should trigger the native handler
    const opened = window.open(url, '_system');
    if (opened) return true;

    // Last resort: direct location change
    window.location.href = url;
    return true;
  } catch (e) {
    console.error('[NativelyBrowser] Error opening URL:', e);
    return false;
  }
}

/**
 * Open URL in in-app browser (WebView)
 */
export function openInAppBrowser(url: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const natively = window.natively || window.Natively;
    
    if (natively?.browser?.open) {
      natively.browser.open(url);
      return true;
    }

    // Fallback to new window
    window.open(url, '_blank');
    return true;
  } catch (e) {
    console.error('[NativelyBrowser] Error opening in-app browser:', e);
    return false;
  }
}
