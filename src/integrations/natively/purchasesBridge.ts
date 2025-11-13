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
  if (!p) return;
  try { p.restore(callback || function () {}); } catch {}
}

export function purchasePackage(packageId: string, callback?: (resp: any) => void) {
  const p = getInstance();
  if (!p || !packageId) return;
  try { p.purchasePackage(packageId, callback || function () {}); } catch {}
}

export function getOfferings(callback?: (resp: any) => void) {
  const p = getInstance();
  if (!p) return;
  try { p.getOfferings(callback || function () {}); } catch {}
}
