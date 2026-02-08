/**
 * Natively Location Bridge
 * Full SDK integration for foreground location with permission handling
 * Docs: https://docs.buildnatively.com/features/geolocation
 */

declare global {
  interface Window {
    NativelyLocation?: new () => NativelyLocationInstance;
  }
}

interface NativelyLocationInstance {
  current: (
    minAccuracy: number,
    accuracyType: string,
    priorityAndroid: string,
    callback: (resp: NativelyLocationResponse) => void,
    fallbackToSettings?: boolean
  ) => void;
  start: (
    interval: number,
    minAccuracy: number,
    accuracyType: string,
    priorityAndroid: string,
    callback: (resp: NativelyLocationResponse) => void,
    fallbackToSettings?: boolean
  ) => void;
  stop: () => void;
  permission: (
    callback: (resp: { status: string }) => void
  ) => void;
}

interface NativelyLocationResponse {
  status: 'Success' | 'Timeout' | 'Error';
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  city?: string;
  country?: string;
}

export interface NativeLocationResult {
  latitude: number;
  longitude: number;
  accuracy?: number;
  city?: string;
  country?: string;
  source: 'native' | 'cached' | 'browser';
}

export type LocationPermissionStatus = 'IN_USE' | 'ALWAYS' | 'DENIED' | 'UNKNOWN';

const LOCATION_CACHE_KEY = 'wakti_native_location_cache';
const LOCATION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes for fresh location
const BRIDGE_READY_TIMEOUT = 5000; // max ms to wait for native iOS/Android bridge

/**
 * Wait for the Natively NATIVE BRIDGE to be connected (not just CDN script loaded).
 *
 * The CDN script (natively-frontend.min.js) loads and defines window.NativelyLocation
 * immediately, but the actual native bridge (window.$agent) connects later when the
 * iOS/Android app calls natively.notify(). Until then, natively.injected === false
 * and all SDK calls are silently queued (callbacks never fire).
 *
 * We use the SDK's own addObserver() which fires when the bridge connects,
 * with a timeout safety net.
 */
function waitForNativeBridge(timeoutMs: number = BRIDGE_READY_TIMEOUT): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);

  const natively = (window as any).natively;

  // No SDK at all (running in regular browser, not Natively WebView)
  if (!natively) {
    console.warn('[NativelyLocation] window.natively not found — not a Natively app');
    return Promise.resolve(false);
  }

  // Bridge already connected
  if (natively.injected === true) {
    console.log('[NativelyLocation] ✅ Native bridge already connected (natively.injected=true)');
    return Promise.resolve(true);
  }

  // Check if this is even a native app (user agent check)
  const isNativeApp = natively.isIOSApp === true || natively.isAndroidApp === true;
  if (!isNativeApp) {
    console.warn('[NativelyLocation] Not running inside Natively app (UA check failed)');
    return Promise.resolve(false);
  }

  // Bridge not connected yet — use SDK's own observer pattern to wait
  console.log('[NativelyLocation] ⏳ Waiting for native bridge to connect (natively.addObserver)...');
  return new Promise((resolve) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        // Check one more time in case it connected but observer didn't fire
        if (natively.injected === true) {
          console.log('[NativelyLocation] ✅ Native bridge connected (detected at timeout check)');
          resolve(true);
        } else {
          console.warn(`[NativelyLocation] ❌ Native bridge not connected after ${timeoutMs}ms`);
          resolve(false);
        }
      }
    }, timeoutMs);

    // The SDK's addObserver() fires when natively.notify() is called by the native app
    try {
      natively.addObserver(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          console.log('[NativelyLocation] ✅ Native bridge connected (addObserver fired)');
          resolve(true);
        }
      });
    } catch (err) {
      console.error('[NativelyLocation] addObserver() failed:', err);
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(false);
      }
    }
  });
}

function logNativelyRuntimeStatus(context: string): void {
  if (typeof window === 'undefined') return;
  const natively = (window as any).natively;
  const isNativeApp = natively?.isNativeApp === true || natively?.isIOSApp === true || natively?.isAndroidApp === true;
  console.log('[NativelyLocation] Runtime status:', {
    context,
    nativelyInjected: natively?.injected,
    hasAgent: !!(window as any).$agent,
    isNativeApp,
    hasNativelyLocation: typeof (window as any).NativelyLocation !== 'undefined',
  });
}

function getInstance(): NativelyLocationInstance | null {
  if (typeof window === 'undefined') return null;
  try {
    // Check if Natively SDK is loaded at all
    const natively = (window as any).natively;
    const isNativeApp = natively?.isNativeApp === true || natively?.isIOSApp === true || natively?.isAndroidApp === true;
    console.log('[NativelyLocation] Checking SDK availability:', {
      hasNatively: !!natively,
      isNativeApp,
      hasNativelyLocation: typeof (window as any).NativelyLocation !== 'undefined',
      nativelyReady: (window as any).__nativelyReady,
    });
    
    const Ctor = (window as any).NativelyLocation;
    if (!Ctor) {
      console.log('[NativelyLocation] NativelyLocation class not found on window');
      // Log what IS available on window for debugging
      const nativelyKeys = Object.keys(window).filter(k => k.toLowerCase().includes('natively') || k.toLowerCase().includes('native'));
      if (nativelyKeys.length > 0) {
        console.log('[NativelyLocation] Found Native-related keys on window:', nativelyKeys.slice(0, 20));
      }
      return null;
    }
    console.log('[NativelyLocation] SDK found, creating instance...');
    const instance = new Ctor();
    console.log('[NativelyLocation] Instance created. Methods available:', {
      hasCurrent: typeof instance.current === 'function',
      hasStart: typeof instance.start === 'function',
      hasStop: typeof instance.stop === 'function',
      hasGetCurrentPosition: typeof instance.getCurrentPosition === 'function',
    });
    return instance;
  } catch (err) {
    console.warn('[NativelyLocation] Failed to create instance:', err);
    return null;
  }
}

/**
 * Check if Natively Location SDK is available
 */
export function isNativeLocationAvailable(): boolean {
  return getInstance() !== null;
}

/**
 * Get cached location if still fresh
 */
function getCachedLocation(): NativeLocationResult | null {
  try {
    const raw = localStorage.getItem(LOCATION_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached || typeof cached !== 'object') return null;
    const age = Date.now() - (cached.timestamp || 0);
    if (age > LOCATION_CACHE_TTL) return null;
    if (typeof cached.latitude !== 'number' || typeof cached.longitude !== 'number') return null;
    return {
      latitude: cached.latitude,
      longitude: cached.longitude,
      accuracy: cached.accuracy,
      city: cached.city,
      country: cached.country,
      source: 'cached',
    };
  } catch {
    return null;
  }
}

/**
 * Save location to cache
 */
function setCachedLocation(loc: NativeLocationResult): void {
  try {
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({
      ...loc,
      timestamp: Date.now(),
    }));
  } catch {}
}

/**
 * Clear cached location (call when user wants fresh location)
 */
export function clearLocationCache(): void {
  try {
    localStorage.removeItem(LOCATION_CACHE_KEY);
  } catch {}
}

/**
 * Check location permission status via Natively SDK.
 * Returns: 'IN_USE' | 'ALWAYS' | 'DENIED' | 'UNKNOWN'
 */
function checkPermission(instance: NativelyLocationInstance, timeoutMs: number = 3000): Promise<LocationPermissionStatus> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        console.warn('[NativelyLocation] Permission check timed out');
        resolve('UNKNOWN');
      }
    }, timeoutMs);

    try {
      instance.permission((resp) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const status = (resp?.status || 'UNKNOWN').toUpperCase();
        console.log('[NativelyLocation] Permission status:', status);
        if (status === 'IN_USE' || status === 'ALWAYS') resolve(status as LocationPermissionStatus);
        else if (status === 'DENIED') resolve('DENIED');
        else resolve('UNKNOWN');
      });
    } catch (err) {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        console.warn('[NativelyLocation] Permission check error:', err);
        resolve('UNKNOWN');
      }
    }
  });
}

/**
 * Get location using foreground tracking (start → wait for fix → stop).
 * This is the "WhatsApp-style" approach: lets the OS acquire a real GPS fix.
 */
function getForegroundLocation(
  instance: NativelyLocationInstance,
  minAccuracy: number,
  accuracyType: string,
  priority: string,
  fallbackToSettings: boolean,
  timeoutMs: number
): Promise<NativeLocationResult | null> {
  return new Promise((resolve) => {
    let settled = false;
    const interval = 3000; // poll every 3s

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { instance.stop(); } catch {}
        console.warn('[NativelyLocation] Foreground tracking timed out after', timeoutMs, 'ms');
        resolve(null);
      }
    }, timeoutMs);

    const handleResponse = (resp: NativelyLocationResponse) => {
      console.log('[NativelyLocation] Foreground tracking response:', JSON.stringify(resp));

      if (settled) return;

      const lat = resp.latitude;
      const lng = resp.longitude;

      if ((resp.status === 'Success' || resp.status === 'Timeout') &&
          typeof lat === 'number' && typeof lng === 'number' &&
          lat !== 0 && lng !== 0) {
        settled = true;
        clearTimeout(timer);
        try { instance.stop(); } catch {}
        const result: NativeLocationResult = {
          latitude: lat,
          longitude: lng,
          accuracy: resp.accuracy,
          source: 'native',
        };
        setCachedLocation(result);
        console.log('[NativelyLocation] ✅ Foreground tracking got fix:', lat, lng, 'accuracy:', resp.accuracy);
        resolve(result);
        return;
      }

      if (resp.status === 'Error') {
        settled = true;
        clearTimeout(timer);
        try { instance.stop(); } catch {}
        console.warn('[NativelyLocation] Foreground tracking error');
        resolve(null);
      }
      // If Timeout without coords, keep waiting for next update
    };

    try {
      console.log('[NativelyLocation] Starting foreground tracking:', { interval, minAccuracy, accuracyType, priority });
      instance.start(interval, minAccuracy, accuracyType, priority, handleResponse, fallbackToSettings);
    } catch (err) {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        console.error('[NativelyLocation] start() threw:', err);
        resolve(null);
      }
    }
  });
}

/**
 * Get location using one-shot current() call.
 * Faster but may return coarse/stale location.
 */
function getCurrentLocation(
  instance: NativelyLocationInstance,
  minAccuracy: number,
  accuracyType: string,
  priority: string,
  fallbackToSettings: boolean,
  timeoutMs: number
): Promise<NativeLocationResult | null> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        console.warn('[NativelyLocation] current() timed out');
        resolve(null);
      }
    }, timeoutMs);

    const handleResponse = (resp: NativelyLocationResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      console.log('[NativelyLocation] current() response:', JSON.stringify(resp));

      if ((resp.status === 'Success' || resp.status === 'Timeout') &&
          typeof resp.latitude === 'number' && typeof resp.longitude === 'number') {
        const result: NativeLocationResult = {
          latitude: resp.latitude,
          longitude: resp.longitude,
          accuracy: resp.accuracy,
          source: 'native',
        };
        setCachedLocation(result);
        resolve(result);
        return;
      }
      console.warn('[NativelyLocation] current() failed:', resp.status);
      resolve(null);
    };

    try {
      console.log('[NativelyLocation] Calling current():', { minAccuracy, accuracyType, priority });
      instance.current(minAccuracy, accuracyType, priority, handleResponse, fallbackToSettings);
    } catch (err) {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        console.error('[NativelyLocation] current() threw:', err);
        resolve(null);
      }
    }
  });
}

/**
 * Browser geolocation fallback.
 * Used when Natively SDK is unavailable or fails.
 */
function getBrowserLocation(timeoutMs: number = 10000): Promise<NativeLocationResult | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      console.warn('[NativelyLocation] Browser geolocation not available');
      resolve(null);
      return;
    }
    console.log('[NativelyLocation] 🌐 Trying browser geolocation fallback...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const result: NativeLocationResult = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          source: 'browser',
        };
        setCachedLocation(result);
        console.log('[NativelyLocation] ✅ Browser geolocation:', result.latitude, result.longitude);
        resolve(result);
      },
      (err) => {
        console.warn('[NativelyLocation] Browser geolocation failed:', err.message);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );
  });
}

/**
 * Get current location — doc-accurate Natively SDK flow with browser fallback.
 *
 * Flow (per Natively docs):
 * 1. Check cache (unless skipCache)
 * 2. Wait for native bridge
 * 3. Check permission via permission()
 * 4. If skipCache (fresh GPS needed): use start()/stop() foreground tracking
 * 5. Otherwise: use current() one-shot
 * 6. If Natively SDK fails or unavailable: browser geolocation fallback
 */
export async function getNativeLocation(options?: {
  timeoutMs?: number;
  minAccuracy?: number;
  accuracyType?: 'BestForNavigation' | 'Best' | 'NearestTenMeters' | 'HundredMeters' | 'Kilometer' | 'ThreeKilometers';
  priority?: 'BALANCED' | 'HIGH';
  fallbackToSettings?: boolean;
  skipCache?: boolean;
}): Promise<NativeLocationResult | null> {
  const {
    timeoutMs = 10000,
    minAccuracy = 50,
    fallbackToSettings = true,
    skipCache = false,
  } = options || {};

  // When skipCache (forceFresh), use higher accuracy settings for real GPS
  const accuracyType = options?.accuracyType || (skipCache ? 'Best' : 'NearestTenMeters');
  const priority = options?.priority || (skipCache ? 'HIGH' : 'BALANCED');

  logNativelyRuntimeStatus('getNativeLocation');

  // Check cache first (unless skipCache)
  if (!skipCache) {
    const cached = getCachedLocation();
    if (cached) {
      console.log('[NativelyLocation] Using cached location:', cached);
      return cached;
    }
  }

  // ── ATTEMPT 1: Natively SDK (native device GPS) ──
  const bridgeReady = await waitForNativeBridge();
  if (bridgeReady) {
    const instance = getInstance();
    if (instance) {
      // Check permission first (per docs)
      const perm = await checkPermission(instance);
      console.log('[NativelyLocation] Permission:', perm);

      if (perm === 'IN_USE' || perm === 'ALWAYS') {
        // Permission granted — get location
        let result: NativeLocationResult | null = null;

        if (skipCache) {
          // Fresh GPS needed (search/near-me) → foreground tracking (WhatsApp-style)
          console.log('[NativelyLocation] 🛰️ Using foreground tracking for fresh GPS...');
          result = await getForegroundLocation(instance, minAccuracy, accuracyType, priority, fallbackToSettings, timeoutMs);
        }

        if (!result) {
          // Either not skipCache, or foreground tracking failed → try current() one-shot
          console.log('[NativelyLocation] Using current() one-shot...');
          result = await getCurrentLocation(instance, minAccuracy, accuracyType, priority, fallbackToSettings, timeoutMs);
        }

        if (result) {
          return result;
        }
        console.warn('[NativelyLocation] SDK returned no usable coordinates');
      } else if (perm === 'DENIED') {
        console.warn('[NativelyLocation] ⚠️ Location permission DENIED — trying current() with fallbackToSettings=true');
        // Try current() anyway — it will show the "open settings" prompt if fallbackToSettings is true
        const result = await getCurrentLocation(instance, minAccuracy, accuracyType, priority, true, timeoutMs);
        if (result) return result;
      } else {
        // UNKNOWN — try current() anyway, SDK may handle it
        console.log('[NativelyLocation] Permission unknown — trying current() anyway...');
        const result = await getCurrentLocation(instance, minAccuracy, accuracyType, priority, fallbackToSettings, timeoutMs);
        if (result) return result;
      }
    } else {
      console.warn('[NativelyLocation] SDK instance creation failed');
    }
  } else {
    console.warn('[NativelyLocation] Native bridge not available');
  }

  // ── ATTEMPT 2: Browser geolocation fallback ──
  console.log('[NativelyLocation] Natively SDK did not return location — trying browser fallback...');
  const browserResult = await getBrowserLocation(timeoutMs);
  if (browserResult) {
    return browserResult;
  }

  console.warn('[NativelyLocation] ❌ All location methods failed — returning null');
  return null;
}

/**
 * Detect if user query contains "near me" patterns (EN/AR)
 * AGGRESSIVE detection - when in doubt, get fresh location
 */
export function containsNearMePattern(query: string): boolean {
  if (!query || typeof query !== 'string') return false;
  const lower = query.toLowerCase();
  
  // English patterns - expanded for better coverage
  const enPatterns = [
    'near me',
    'nearby',
    'around me',
    'close to me',
    'closest',
    'nearest',
    'in my area',
    'where is the',
    'find me',
    'locate',
    'around here',
    'close by',
    'in this area',
    'local',
    'walking distance',
    'within',
    'miles from',
    'km from',
    'minutes away',
    'here',
    'my location',
    'current location',
    'where i am',
    'from here',
    'to here',
  ];
  
  // Arabic patterns - expanded
  const arPatterns = [
    'قريب',
    'بالقرب',
    'حولي',
    'أقرب',
    'قريب مني',
    'بجانبي',
    'في منطقتي',
    'وين أقرب',
    'فين أقرب',
    'هنا',
    'من هنا',
    'الى هنا',
    'موقعي',
    'مكاني',
    'حوالين',
    'جنبي',
    'قدامي',
  ];
  
  for (const p of enPatterns) {
    if (lower.includes(p)) return true;
  }
  for (const p of arPatterns) {
    if (query.includes(p)) return true;
  }
  
  return false;
}

/**
 * Detect if user query is weather-related (EN/AR)
 */
export function containsWeatherPattern(query: string): boolean {
  if (!query || typeof query !== 'string') return false;
  const lower = query.toLowerCase();
  
  const enPatterns = [
    'weather',
    'temperature',
    'rain',
    'sunny',
    'cloudy',
    'forecast',
    'humidity',
    'wind',
    'storm',
    'hot today',
    'cold today',
  ];
  
  const arPatterns = [
    'الطقس',
    'الجو',
    'درجة الحرارة',
    'مطر',
    'شمس',
    'غيوم',
    'رطوبة',
    'رياح',
    'عاصفة',
    'حار',
    'بارد',
  ];
  
  for (const p of enPatterns) {
    if (lower.includes(p)) return true;
  }
  for (const p of arPatterns) {
    if (query.includes(p)) return true;
  }
  
  return false;
}

/**
 * Detect if user query is traffic-related (EN/AR)
 */
export function containsTrafficPattern(query: string): boolean {
  if (!query || typeof query !== 'string') return false;
  const lower = query.toLowerCase();
  
  const enPatterns = [
    'traffic',
    'how long to',
    'how far',
    'directions to',
    'route to',
    'drive to',
    'get to',
    'commute',
    'eta',
    'travel time',
  ];
  
  const arPatterns = [
    'الزحمة',
    'المرور',
    'كم يبعد',
    'كيف أوصل',
    'الطريق إلى',
    'المسافة',
    'وقت الوصول',
  ];
  
  for (const p of enPatterns) {
    if (lower.includes(p)) return true;
  }
  for (const p of arPatterns) {
    if (query.includes(p)) return true;
  }
  
  return false;
}

/**
 * Detect if user query is asking about places/establishments (EN/AR)
 * These queries almost always need location context
 */
export function containsPlacePattern(query: string): boolean {
  if (!query || typeof query !== 'string') return false;
  const lower = query.toLowerCase();
  
  // English place patterns
  const enPatterns = [
    'restaurant',
    'cafe',
    'coffee',
    'hotel',
    'hospital',
    'pharmacy',
    'gas station',
    'petrol',
    'atm',
    'bank',
    'supermarket',
    'grocery',
    'mall',
    'shop',
    'store',
    'gym',
    'park',
    'beach',
    'airport',
    'station',
    'mosque',
    'church',
    'school',
    'university',
    'clinic',
    'dentist',
    'barber',
    'salon',
    'spa',
    'cinema',
    'theater',
    'museum',
    'library',
    'post office',
    'police',
    'fire station',
    'parking',
  ];
  
  // Arabic place patterns
  const arPatterns = [
    'مطعم',
    'كافيه',
    'قهوة',
    'فندق',
    'مستشفى',
    'صيدلية',
    'محطة بنزين',
    'صراف',
    'بنك',
    'سوبرماركت',
    'بقالة',
    'مول',
    'محل',
    'جيم',
    'حديقة',
    'شاطئ',
    'مطار',
    'محطة',
    'مسجد',
    'كنيسة',
    'مدرسة',
    'جامعة',
    'عيادة',
    'طبيب',
    'حلاق',
    'صالون',
    'سينما',
    'مسرح',
    'متحف',
    'مكتبة',
    'بريد',
    'شرطة',
    'مواقف',
  ];
  
  for (const p of enPatterns) {
    if (lower.includes(p)) return true;
  }
  for (const p of arPatterns) {
    if (query.includes(p)) return true;
  }
  
  return false;
}

/**
 * Check if query needs fresh location (near me, weather, traffic, places)
 * ALWAYS call the bridge for location-dependent queries
 */
export function queryNeedsFreshLocation(query: string): boolean {
  return containsNearMePattern(query) || containsWeatherPattern(query) || containsTrafficPattern(query) || containsPlacePattern(query);
}
