declare global {
  interface Window {
    NativelyLocation?: {
      getCurrentPosition?: (
        onSuccess: (position: { latitude?: number; longitude?: number; coords?: { latitude?: number; longitude?: number; accuracy?: number }; city?: string; country?: string }) => void,
        onError?: (err?: unknown) => void
      ) => void;
    };
  }
}

export interface NativeLocationResult {
  latitude: number;
  longitude: number;
  accuracy?: number;
  city?: string;
  country?: string;
}

function getInstance(): any | null {
  if (typeof window === 'undefined') return null;
  try {
    const Ctor = (window as any).NativelyLocation;
    if (!Ctor) return null;
    return new Ctor();
  } catch (err) {
    console.warn('[NativelyLocation] Failed to create instance:', err);
    return null;
  }
}

export async function getNativeLocation(timeoutMs = 8000): Promise<NativeLocationResult | null> {
  const instance = getInstance();
  if (!instance || typeof instance.getCurrentPosition !== 'function') {
    return null;
  }

  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);

    try {
      instance.getCurrentPosition(
        (pos: any) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          const coords = pos?.coords || pos || {};
          const latitude = typeof coords.latitude === 'number' ? coords.latitude : coords.lat;
          const longitude = typeof coords.longitude === 'number' ? coords.longitude : coords.lng;
          if (typeof latitude === 'number' && typeof longitude === 'number') {
            resolve({
              latitude,
              longitude,
              accuracy: typeof coords.accuracy === 'number' ? coords.accuracy : undefined,
              city: pos?.city || coords?.city,
              country: pos?.country || coords?.country,
            });
          } else {
            resolve(null);
          }
        },
        () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(null);
        }
      );
    } catch (err) {
      console.warn('[NativelyLocation] Error calling getCurrentPosition:', err);
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(null);
    }
  });
}
