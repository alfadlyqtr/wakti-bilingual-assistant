declare global {
  interface Window {
    NativelyPurchases?: any;
  }
}

function getInstance(): any | null {
  try {
    if (typeof window === 'undefined') return null;
    const Ctor = (window as any).NativelyPurchases;
    if (!Ctor) return null;
    return new Ctor();
  } catch {
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

export function purchasePackage(packageIdOrObj: string | any, callback?: (resp: any) => void) {
  const p = getInstance();
  if (!p || !packageIdOrObj) return;
  // The Natively/RevenueCat SDK expects the full Package object when available.
  // Passing just the identifier string may resolve to the wrong product (e.g. standard $rc_monthly).
  // Always prefer the full object; fall back to string identifier only if no object is available.
  try { p.purchasePackage(packageIdOrObj, callback || function () {}); } catch {}
}

export function getOfferings(callback?: (resp: any) => void) {
  const p = getInstance();
  if (!p) return;
  try { p.getOfferings(callback || function () {}); } catch {}
}
