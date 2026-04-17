declare global {
  interface Window {
    NativelyPurchases?: any;
  }
}

function listFunctionNames(target: any): string[] {
  if (!target) return [];
  const names = new Set<string>();
  let current = target;
  let depth = 0;
  while (current && depth < 3) {
    for (const name of Object.getOwnPropertyNames(current)) {
      if (name === 'constructor') continue;
      try {
        if (typeof current[name] === 'function') names.add(name);
      } catch {}
    }
    current = Object.getPrototypeOf(current);
    depth += 1;
  }
  return Array.from(names).sort();
}

function getInstance(): any | null {
  try {
    if (typeof window === 'undefined') return null;
    const Ctor = (window as any).NativelyPurchases;
    if (!Ctor) {
      console.warn('[PurchasesBridge] NativelyPurchases not on window - SDK not loaded');
      return null;
    }
    const instance = new Ctor();
    if (!instance) {
      console.warn('[PurchasesBridge] new NativelyPurchases() returned null/undefined');
      return null;
    }
    return instance;
  } catch (err) {
    console.error('[PurchasesBridge] getInstance() threw:', err);
    return null;
  }
}

export function purchasesLogin(userId: string, email: string) {
  const p = getInstance();
  if (!p || !userId) return;
  try { p.login(userId, email || '', function () {}); } catch {}
}

export function purchasesLogout() {
  const p = getInstance();
  if (!p) return;
  try { p.logout(function () {}); } catch {}
}

export function purchasesWarmup() {
  const p = getInstance();
  if (!p) return;
  try { p.customerId(function () {}); } catch {}
}

export function showPaywallIfNeeded(
  entitlementId: string,
  showCloseButton = true,
  offeringId?: string,
  callback?: (resp: any) => void
) {
  const p = getInstance();
  if (!p || !entitlementId) return;
  try {
    p.showPaywallIfNeeded(
      entitlementId,
      showCloseButton,
      offeringId,
      callback || function () {}
    );
  } catch {}
}

export function restorePurchases(callback?: (resp: any) => void) {
  const p = getInstance();
  if (!p) {
    // SDK not available (running in browser, not native app)
    // Call callback with FAILED status so UI can handle it
    console.warn('[Purchases] NativelyPurchases SDK not available - not running in native app');
    if (callback) {
      callback({ status: 'FAILED', error: 'Not running in native app', customerId: null });
    }
    return;
  }
  try {
    p.restore(callback || function () {});
  } catch (err) {
    console.error('[Purchases] restore() threw error:', err);
    if (callback) {
      callback({ status: 'FAILED', error: String(err), customerId: null });
    }
  }
}

export function getPurchasesShellSnapshot() {
  try {
    if (typeof window === 'undefined') {
      return {
        hasWindow: false,
        hasCtor: false,
        instanceCreated: false,
      };
    }

    const ctor = (window as any).NativelyPurchases;
    const instance = getInstance();
    const scripts = typeof document !== 'undefined'
      ? Array.from(document.scripts || []).map(script => script.src).filter(Boolean)
      : [];
    const nativelyScript = scripts.find(src => src.includes('natively')) || null;
    const instanceMethods = listFunctionNames(instance);

    return {
      hasWindow: true,
      hasCtor: !!ctor,
      ctorName: ctor?.name || null,
      ctorKeys: ctor ? Object.getOwnPropertyNames(ctor).sort() : [],
      instanceCreated: !!instance,
      instanceOwnKeys: instance ? Object.keys(instance).sort() : [],
      instanceMethods,
      capabilities: {
        login: instanceMethods.includes('login'),
        logout: instanceMethods.includes('logout'),
        customerId: instanceMethods.includes('customerId'),
        purchasePackage: instanceMethods.includes('purchasePackage'),
        restore: instanceMethods.includes('restore'),
        showPaywall: instanceMethods.includes('showPaywall'),
        showPaywallIfNeeded: instanceMethods.includes('showPaywallIfNeeded'),
        getOfferings: instanceMethods.includes('getOfferings'),
      },
      nativelyReady: !!(window as any).__nativelyReady,
      nativelyFlags: {
        isIOSApp: !!(window as any).natively?.isIOSApp,
        isAndroidApp: !!(window as any).natively?.isAndroidApp,
      },
      scriptCount: scripts.length,
      nativelyScript,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    };
  } catch (err) {
    return {
      hasWindow: typeof window !== 'undefined',
      hasCtor: !!(window as any)?.NativelyPurchases,
      instanceCreated: false,
      snapshotError: err instanceof Error ? err.message : String(err),
    };
  }
}

export function purchasePackage(packageIdOrObj: string | any, callback?: (resp: any) => void) {
  const p = getInstance();
  if (!p || !packageIdOrObj) {
    if (callback) callback({ status: 'FAILED', error: 'SDK not ready' });
    return;
  }
  try { p.purchasePackage(packageIdOrObj, callback || function () {}); } catch {
    if (callback) callback({ status: 'FAILED', error: 'SDK call failed' });
  }
}

export function getOfferings(callback?: (resp: any) => void) {
  const p = getInstance();
  if (!p) return;
  try { p.getOfferings(callback || function () {}); } catch {}
}

export function showPaywall(
  showCloseButton = true,
  offeringId?: string,
  callback?: (resp: any) => void
) {
  const p = getInstance();
  if (!p) {
    if (callback) callback({ status: 'FAILED', error: 'SDK not ready' });
    return;
  }
  try {
    p.showPaywall(showCloseButton, offeringId, callback || function () {});
  } catch {
    if (callback) callback({ status: 'FAILED', error: 'SDK call failed' });
  }
}
