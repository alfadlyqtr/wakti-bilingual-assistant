const ACTIVE_USER_STORAGE_KEY = 'homescreen_active_uid';

const scopedKey = (base: string, uid: string) => `${base}__${uid}`;

export function getActiveScopedUserId(explicitUid?: string | null): string {
  if (explicitUid) return explicitUid;
  try {
    return localStorage.getItem(ACTIVE_USER_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setActiveScopedUserId(uid: string): void {
  try {
    localStorage.setItem(ACTIVE_USER_STORAGE_KEY, uid);
  } catch {
    // non-fatal
  }
}

export function getUserScopedStorageKey(base: string, explicitUid?: string | null): string {
  return scopedKey(base, getActiveScopedUserId(explicitUid));
}

export function getScopedStorageItem(base: string, explicitUid?: string | null, legacyKey?: string): string | null {
  try {
    const uid = getActiveScopedUserId(explicitUid);
    if (uid) {
      const scoped = localStorage.getItem(scopedKey(base, uid));
      if (scoped !== null) return scoped;
    }
    return legacyKey ? localStorage.getItem(legacyKey) : localStorage.getItem(base);
  } catch {
    return null;
  }
}

export function setScopedStorageItem(base: string, value: string, explicitUid?: string | null): void {
  try {
    const uid = getActiveScopedUserId(explicitUid);
    if (!uid) return;
    localStorage.setItem(scopedKey(base, uid), value);
  } catch {
    // non-fatal
  }
}

export function removeScopedStorageItem(base: string, explicitUid?: string | null, legacyKey?: string): void {
  try {
    const uid = getActiveScopedUserId(explicitUid);
    if (uid) localStorage.removeItem(scopedKey(base, uid));
    if (legacyKey) localStorage.removeItem(legacyKey);
    else localStorage.removeItem(base);
  } catch {
    // non-fatal
  }
}

export function migrateLegacyScopedStorage(base: string, explicitUid?: string | null, legacyKey?: string): void {
  try {
    const uid = getActiveScopedUserId(explicitUid);
    if (!uid) return;
    const fromKey = legacyKey || base;
    const scopedStorageKey = scopedKey(base, uid);
    const existingScoped = localStorage.getItem(scopedStorageKey);
    if (existingScoped !== null) return;
    const legacyValue = localStorage.getItem(fromKey);
    if (legacyValue === null) return;
    localStorage.setItem(scopedStorageKey, legacyValue);
    localStorage.removeItem(fromKey);
  } catch {
    // non-fatal
  }
}

export { ACTIVE_USER_STORAGE_KEY };
