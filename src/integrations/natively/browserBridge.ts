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

export function isInNativeApp(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const NativelyInfo = (window as any).NativelyInfo;
    if (NativelyInfo) {
      const info = new NativelyInfo();
      const browserInfo = info.browserInfo();
      if (browserInfo && browserInfo.isNativeApp) {
        return true;
      }
    }
  } catch {
    // ignore
  }

  if ((window as any).NativelyPurchases || (window as any).NativelyNotifications) {
    return true;
  }

  if (window.matchMedia?.('(display-mode: standalone)')?.matches) return true;
  if ((navigator as any).standalone === true) return true;

  return isNativelyApp();
}

/**
 * Open URL in external Safari browser (not in-app browser)
 * This is needed for .pkpass files which Safari handles natively
 */
export function openInSafari(url: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    // The Natively SDK openExternalURL(url, useExternal):
    //   true  → view:"external" → opens in system Safari
    //   false → view:"web"     → opens in-app browser (Google blocks this)
    const natively = window.natively || window.Natively;
    if (natively && typeof natively.openExternalURL === 'function') {
      console.log('[NativelyBrowser] natively.openExternalURL(url, true) → Safari');
      natively.openExternalURL(url, true);
      return true;
    }

    // Fallback: x-safari-https scheme
    if (url.startsWith('https://')) {
      console.log('[NativelyBrowser] x-safari-https fallback');
      window.location.href = url.replace('https://', 'x-safari-https://');
      return true;
    }

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
