export type StudioGuestFeature = 'music' | 'video' | 'image' | 'qrcode';

const STORAGE_PREFIX = 'wakti_studio_guest_draft_';
export const STUDIO_GUEST_RESTORE_QUERY_KEY = 'guestStudioRestore';

export function saveStudioGuestDraft<T>(feature: StudioGuestFeature, payload: T): void {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${feature}`, JSON.stringify({ payload, savedAt: Date.now() }));
  } catch {}
}

export function readStudioGuestDraft<T>(feature: StudioGuestFeature): T | null {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${feature}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { payload?: T };
    return parsed?.payload ?? null;
  } catch {
    return null;
  }
}

export function clearStudioGuestDraft(feature: StudioGuestFeature): void {
  try {
    window.localStorage.removeItem(`${STORAGE_PREFIX}${feature}`);
  } catch {}
}

export function buildStudioGuestRestorePath(
  feature: StudioGuestFeature,
  params: Record<string, string | null | undefined> = {},
): string {
  const searchParams = new URLSearchParams();
  searchParams.set(STUDIO_GUEST_RESTORE_QUERY_KEY, feature);

  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') return;
    searchParams.set(key, value);
  });

  return `/music?${searchParams.toString()}`;
}
