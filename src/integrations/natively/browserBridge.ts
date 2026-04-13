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
    // Method 1: NativelyBrowser class instance (matches pattern of all other Natively bridges)
    if (window.NativelyBrowser) {
      const browser = new window.NativelyBrowser();
      if (typeof browser.openExternalURL === 'function') {
        console.log('[NativelyBrowser] Using new NativelyBrowser().openExternalURL');
        browser.openExternalURL(url);
        return true;
      }
      if (typeof browser.openInExternalBrowser === 'function') {
        console.log('[NativelyBrowser] Using new NativelyBrowser().openInExternalBrowser');
        browser.openInExternalBrowser(url);
        return true;
      }
    }

    // Method 2: natively global object methods
    const natively = window.natively || window.Natively;
    if (natively) {
      if (typeof natively.openExternalURL === 'function') {
        console.log('[NativelyBrowser] Using natively.openExternalURL');
        natively.openExternalURL(url);
        return true;
      }
      if (natively.browser?.openExternalURL) {
        console.log('[NativelyBrowser] Using natively.browser.openExternalURL');
        natively.browser.openExternalURL(url);
        return true;
      }
      if (typeof natively.openURL === 'function') {
        console.log('[NativelyBrowser] Using natively.openURL external');
        natively.openURL(url, { external: true });
        return true;
      }
      if (typeof natively.openInExternalBrowser === 'function') {
        console.log('[NativelyBrowser] Using natively.openInExternalBrowser');
        natively.openInExternalBrowser(url);
        return true;
      }
    }

    // Method 3: x-safari-https scheme — forces iOS Safari directly
    if (url.startsWith('https://')) {
      const safariUrl = url.replace('https://', 'x-safari-https://');
      console.log('[NativelyBrowser] Trying x-safari-https scheme');
      window.location.href = safariUrl;
      return true;
    }

    // Method 4: window.open _blank
    console.log('[NativelyBrowser] Fallback: window.open _blank');
    const opened = window.open(url, '_blank');
    if (opened) return true;

    console.log('[NativelyBrowser] Last resort: window.location.href');
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
