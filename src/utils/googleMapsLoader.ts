let loadPromise: Promise<void> | null = null;

/**
 * Loads the Google Maps JS SDK on demand.
 * Safe to call multiple times — only loads once.
 */
export function loadGoogleMaps(): Promise<void> {
  if (loadPromise) return loadPromise;

  if (typeof window.google !== 'undefined' && window.google.maps) {
    loadPromise = Promise.resolve();
    return loadPromise;
  }

  loadPromise = new Promise<void>((resolve, reject) => {
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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places,marker&v=beta&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(script);
  });

  return loadPromise;
}
