const loadPromiseByVersion = new Map<string, Promise<void>>();

/**
 * Loads the Google Maps JS SDK on demand.
 * Safe to call multiple times — only loads once.
 */
export function loadGoogleMaps(version: 'alpha' | 'beta' = 'beta'): Promise<void> {
  const existingPromise = loadPromiseByVersion.get(version);
  if (existingPromise) return existingPromise;

  if (typeof window.google !== 'undefined' && window.google.maps) {
    const resolved = Promise.resolve();
    loadPromiseByVersion.set(version, resolved);
    return resolved;
  }

  const loadPromise = new Promise<void>((resolve, reject) => {
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
    if (!key) {
      console.error('[Maps] VITE_GOOGLE_MAPS_API_KEY is missing');
      reject(new Error('VITE_GOOGLE_MAPS_API_KEY is missing'));
      return;
    }

    const existingScript = document.querySelector('script[data-google-maps]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Google Maps failed to load')));
      return;
    }

    const script = document.createElement('script');
    script.setAttribute('data-google-maps', 'true');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places,marker&v=${encodeURIComponent(version)}&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(script);
  });

  loadPromiseByVersion.set(version, loadPromise);
  return loadPromise;
}
