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

type LocationAccuracyType = 'BestForNavigation' | 'Best' | 'NearestTenMeters' | 'HundredMeters' | 'Kilometer' | 'ThreeKilometers';

interface GetLocationOptions {
  timeoutMs?: number;
  minAccuracy?: number;
  accuracyType?: LocationAccuracyType;
  priority?: 'BALANCED' | 'HIGH';
  fallbackToSettings?: boolean;
  skipCache?: boolean;
  allowBrowserFallback?: boolean;
}

export interface ExactLocationDebugInfo {
  flow: 'exact-near-me';
  bridgeReady?: boolean;
  nativeAttempted?: boolean;
  nativeStatus?: string;
  nativeSource?: 'foreground' | 'current';
  nativeLatitude?: number | null;
  nativeLongitude?: number | null;
  nativeAccuracy?: number | null;
  browserAttempted?: boolean;
  browserPermission?: BrowserPermissionState;
  browserStatus?: string;
  browserLatitude?: number | null;
  browserLongitude?: number | null;
  browserAccuracy?: number | null;
  finalStatus?: 'native' | 'browser' | 'none';
  finalReason?: string;
}

type BrowserPermissionState = 'granted' | 'prompt' | 'denied' | 'unknown';

const LOCATION_CACHE_KEY = 'wakti_native_location_cache';
const LOCATION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes for fresh location
const BRIDGE_READY_TIMEOUT = 5000; // max ms to wait for native iOS/Android bridge

const EXACT_BRIDGE_READY_TIMEOUT = 3000;
const EXACT_MIN_WATCH_MS = 2500;
const MIN_CONTEXT_ATTEMPT_TIMEOUT = 2500;
const MIN_EXACT_ATTEMPT_TIMEOUT = 4000;

// In-flight Promise cache: prevents multiple simultaneous GPS hardware calls
let pendingLocationPromise: Promise<NativeLocationResult | null> | null = null;
let pendingFreshLocationPromise: Promise<NativeLocationResult | null> | null = null;
let lastExactLocationDebug: ExactLocationDebugInfo | null = null;

function updateExactLocationDebug(patch: Partial<ExactLocationDebugInfo>): void {
  lastExactLocationDebug = {
    flow: 'exact-near-me',
    ...(lastExactLocationDebug || {}),
    ...patch,
  };
}

export function getLastExactLocationDebug(): ExactLocationDebugInfo | null {
  if (!lastExactLocationDebug) return null;
  return { ...lastExactLocationDebug };
}

function hasValidCoordinates(latitude: unknown, longitude: unknown): latitude is number {
  return typeof latitude === 'number'
    && typeof longitude === 'number'
    && Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude !== 0
    && longitude !== 0;
}

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

function logNativelyRuntimeStatus(_context: string): void {
  // Silenced: was causing Tracking Prevention console spam on every page load
}

function isRunningInsideNativelyApp(): boolean {
  if (typeof window === 'undefined') return false;
  const natively = (window as any).natively;
  return Boolean(natively && (natively.isIOSApp === true || natively.isAndroidApp === true));
}

function getInstance(): NativelyLocationInstance | null {
  if (typeof window === 'undefined') return null;
  try {
    const Ctor = (window as any).NativelyLocation;
    if (!Ctor) return null;
    return new Ctor();
  } catch {
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
 * Get location using foreground tracking (start → wait for fix → stop).
 * This is the "WhatsApp-style" approach: lets the OS acquire a real GPS fix.
 */
function getForegroundLocation(
  instance: NativelyLocationInstance,
  minAccuracy: number,
  accuracyType: string,
  priority: string,
  fallbackToSettings: boolean,
  timeoutMs: number,
  minimumWatchMs: number = 0
): Promise<NativeLocationResult | null> {
  return new Promise((resolve) => {
    let settled = false;
    const interval = 3000; // poll every 3s
    const startedAt = Date.now();
    let delayedFix: NativeLocationResult | null = null;
    let delayedFixAt = 0;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { instance.stop(); } catch {}
        if (delayedFix && (delayedFixAt - startedAt) >= minimumWatchMs) {
          updateExactLocationDebug({
            nativeStatus: 'Success',
            nativeLatitude: delayedFix.latitude,
            nativeLongitude: delayedFix.longitude,
            nativeAccuracy: delayedFix.accuracy ?? null,
          });
          setCachedLocation(delayedFix);
          console.log('[NativelyLocation] ✅ Foreground tracking settled on delayed fix:', delayedFix.latitude, delayedFix.longitude, 'accuracy:', delayedFix.accuracy);
          resolve(delayedFix);
          return;
        }
        updateExactLocationDebug({ nativeStatus: 'Timeout' });
        console.warn('[NativelyLocation] Foreground tracking timed out after', timeoutMs, 'ms');
        resolve(null);
      }
    }, timeoutMs);

    const handleResponse = (resp: NativelyLocationResponse) => {
      console.log('[NativelyLocation] Foreground tracking response:', JSON.stringify(resp));

      if (settled) return;

      const lat = resp.latitude;
      const lng = resp.longitude;

      if (resp.status === 'Success' && hasValidCoordinates(lat, lng)) {
        const result: NativeLocationResult = {
          latitude: lat,
          longitude: lng,
          accuracy: resp.accuracy,
          source: 'native',
        };
        updateExactLocationDebug({
          nativeStatus: 'Success',
          nativeLatitude: lat,
          nativeLongitude: lng,
          nativeAccuracy: resp.accuracy ?? null,
        });
        const elapsedMs = Date.now() - startedAt;
        if (minimumWatchMs > 0 && elapsedMs < minimumWatchMs) {
          delayedFix = result;
          delayedFixAt = Date.now();
          console.log('[NativelyLocation] Foreground tracking provisional fix:', lat, lng, 'accuracy:', resp.accuracy, 'elapsed:', elapsedMs);
          return;
        }
        settled = true;
        clearTimeout(timer);
        try { instance.stop(); } catch {}
        setCachedLocation(result);
        console.log('[NativelyLocation] ✅ Foreground tracking got fix:', lat, lng, 'accuracy:', resp.accuracy);
        resolve(result);
        return;
      }

      if (resp.status === 'Error') {
        settled = true;
        clearTimeout(timer);
        try { instance.stop(); } catch {}
        updateExactLocationDebug({ nativeStatus: 'Error' });
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

      if (resp.status === 'Success' && hasValidCoordinates(resp.latitude, resp.longitude)) {
        const result: NativeLocationResult = {
          latitude: resp.latitude,
          longitude: resp.longitude,
          accuracy: resp.accuracy,
          city: resp.city,
          country: resp.country,
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
async function getBrowserPermissionState(): Promise<BrowserPermissionState> {
  try {
    const permissionsApi = (navigator as any)?.permissions;
    if (!permissionsApi || typeof permissionsApi.query !== 'function') return 'unknown';
    const status = await permissionsApi.query({ name: 'geolocation' });
    const state = typeof status?.state === 'string' ? status.state : 'unknown';
    if (state === 'granted' || state === 'prompt' || state === 'denied') return state;
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function getBrowserLocation(timeoutMs: number = 10000): Promise<NativeLocationResult | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      updateExactLocationDebug({ browserAttempted: true, browserStatus: 'unavailable' });
      console.warn('[NativelyLocation] Browser geolocation not available');
      resolve(null);
      return;
    }
    void (async () => {
      const permissionState = await getBrowserPermissionState();
      updateExactLocationDebug({ browserAttempted: true, browserPermission: permissionState });
      console.log('[NativelyLocation] Browser geolocation permission:', permissionState);
      if (permissionState === 'denied') {
        updateExactLocationDebug({ browserStatus: 'denied' });
        console.warn('[NativelyLocation] Browser geolocation permission denied');
        resolve(null);
        return;
      }

      console.log('[NativelyLocation] 🌐 Trying browser geolocation fallback...');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!hasValidCoordinates(pos.coords.latitude, pos.coords.longitude)) {
            updateExactLocationDebug({ browserStatus: 'invalid' });
            console.warn('[NativelyLocation] Browser geolocation returned invalid coordinates');
            resolve(null);
            return;
          }
          const result: NativeLocationResult = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            source: 'browser',
          };
          updateExactLocationDebug({
            browserStatus: 'Success',
            browserLatitude: pos.coords.latitude,
            browserLongitude: pos.coords.longitude,
            browserAccuracy: pos.coords.accuracy,
          });
          setCachedLocation(result);
          console.log('[NativelyLocation] ✅ Browser geolocation:', result.latitude, result.longitude, 'accuracy:', result.accuracy);
          resolve(result);
        },
        (err) => {
          updateExactLocationDebug({ browserStatus: err?.code === 3 ? 'Timeout' : (err?.message || 'error') });
          console.warn('[NativelyLocation] Browser geolocation failed:', err.message);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
      );
    })();
  });
}

function getContextAttemptTimeout(timeoutMs: number): number {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return MIN_CONTEXT_ATTEMPT_TIMEOUT;
  return Math.max(MIN_CONTEXT_ATTEMPT_TIMEOUT, Math.min(Math.round(timeoutMs * 0.6), timeoutMs));
}

function getExactAttemptTimeout(timeoutMs: number): number {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return MIN_EXACT_ATTEMPT_TIMEOUT;
  return Math.max(MIN_EXACT_ATTEMPT_TIMEOUT, timeoutMs);
}

async function tryNativeSdkLocation(options: {
  mode: 'context' | 'exact';
  timeoutMs: number;
  bridgeTimeoutMs: number;
  minAccuracy: number;
  accuracyType: LocationAccuracyType;
  priority: 'BALANCED' | 'HIGH';
  fallbackToSettings: boolean;
  useForeground: boolean;
  minimumWatchMs: number;
  allowCurrentFallback: boolean;
}): Promise<NativeLocationResult | null> {
  const bridgeReady = await waitForNativeBridge(options.bridgeTimeoutMs);
  if (options.mode === 'exact') {
    updateExactLocationDebug({
      bridgeReady,
      nativeAttempted: true,
      nativeSource: options.useForeground ? 'foreground' : 'current',
    });
  }
  if (!bridgeReady) {
    console.warn(`[NativelyLocation] ${options.mode} flow: native bridge not available`);
    return null;
  }

  const instance = getInstance();
  if (!instance) {
    console.warn(`[NativelyLocation] ${options.mode} flow: SDK instance creation failed`);
    return null;
  }

  let result: NativeLocationResult | null = null;
  if (options.useForeground) {
    console.log(`[NativelyLocation] ${options.mode} flow: using foreground GPS first...`);
    result = await getForegroundLocation(
      instance,
      options.minAccuracy,
      options.accuracyType,
      options.priority,
      options.fallbackToSettings,
      options.timeoutMs,
      options.minimumWatchMs,
    );
    if (!result && options.allowCurrentFallback) {
      console.warn(`[NativelyLocation] ${options.mode} flow: foreground GPS unavailable — trying current()`);
    }
  }

  if (!result && options.allowCurrentFallback) {
    console.log(`[NativelyLocation] ${options.mode} flow: using current() one-shot...`);
    result = await getCurrentLocation(
      instance,
      options.minAccuracy,
      options.accuracyType,
      options.priority,
      options.fallbackToSettings,
      options.timeoutMs,
    );
  }

  return result;
}

export function getExactLocation(options?: GetLocationOptions): Promise<NativeLocationResult | null> {
  if (pendingFreshLocationPromise) {
    return pendingFreshLocationPromise;
  }

  pendingFreshLocationPromise = _doGetExactLocation(options).finally(() => {
    pendingFreshLocationPromise = null;
  });
  return pendingFreshLocationPromise;
}

async function _doGetExactLocation(options?: GetLocationOptions): Promise<NativeLocationResult | null> {
  const {
    timeoutMs = 8000,
    minAccuracy = 50,
    fallbackToSettings = true,
    allowBrowserFallback = true,
  } = options || {};

  lastExactLocationDebug = {
    flow: 'exact-near-me',
    nativeAttempted: false,
    browserAttempted: false,
  };
  clearLocationCache();
  const accuracyType = options?.accuracyType || 'Best';
  const priority = options?.priority || 'HIGH';
  const nativeTimeoutMs = getExactAttemptTimeout(timeoutMs);
  const browserTimeoutMs = getExactAttemptTimeout(timeoutMs);

  logNativelyRuntimeStatus('getExactLocation');
  console.log('[NativelyLocation] Exact location flow: trying Natively GPS first');

  const nativeWinner = await tryNativeSdkLocation({
    mode: 'exact',
    timeoutMs: nativeTimeoutMs,
    bridgeTimeoutMs: Math.min(EXACT_BRIDGE_READY_TIMEOUT, nativeTimeoutMs),
    minAccuracy,
    accuracyType,
    priority,
    fallbackToSettings,
    useForeground: true,
    minimumWatchMs: EXACT_MIN_WATCH_MS,
    allowCurrentFallback: false,
  }).catch((err) => {
    console.warn('[NativelyLocation] Exact native path threw:', err);
    return null;
  });

  if (nativeWinner && typeof nativeWinner.latitude === 'number' && typeof nativeWinner.longitude === 'number') {
    updateExactLocationDebug({
      finalStatus: 'native',
      finalReason: 'native_fix_accepted',
    });
    console.log('[NativelyLocation] ✅ Exact native location:', nativeWinner.latitude, nativeWinner.longitude);
    setCachedLocation(nativeWinner);
    return nativeWinner;
  }

  const shouldUseBrowserFallback = allowBrowserFallback || !isRunningInsideNativelyApp();
  if (!shouldUseBrowserFallback) {
    updateExactLocationDebug({
      finalStatus: 'none',
      finalReason: 'browser_fallback_disabled',
    });
    console.warn('[NativelyLocation] Exact flow: browser fallback disabled for this request');
    return null;
  }

  console.log(`[NativelyLocation] Exact flow: native unavailable, trying browser geolocation (${browserTimeoutMs}ms)`);
  const browserWinner = await getBrowserLocation(browserTimeoutMs).catch((err) => {
    console.warn('[NativelyLocation] Exact browser path threw:', err);
    return null;
  });

  if (browserWinner && typeof browserWinner.latitude === 'number' && typeof browserWinner.longitude === 'number') {
    updateExactLocationDebug({
      finalStatus: 'browser',
      finalReason: 'browser_fix_accepted',
    });
    console.log('[NativelyLocation] ✅ Exact browser fallback location:', browserWinner.latitude, browserWinner.longitude);
    setCachedLocation(browserWinner);
    return browserWinner;
  }

  updateExactLocationDebug({
    finalStatus: 'none',
    finalReason: 'no_usable_location',
  });
  console.warn('[NativelyLocation] ❌ Exact flow: no location from Natively SDK or browser fallback');
  return null;
}

export function getNativeLocation(options?: GetLocationOptions): Promise<NativeLocationResult | null> {
  const skipCache = options?.skipCache === true;
  if (skipCache) {
    return getExactLocation(options);
  }

  // If a GPS request is already in-flight, return the same promise — no duplicate hardware calls
  if (pendingLocationPromise) {
    return pendingLocationPromise;
  }

  pendingLocationPromise = _doGetNativeLocation(options).finally(() => {
    pendingLocationPromise = null;
  });
  return pendingLocationPromise;
}

async function _doGetNativeLocation(options?: GetLocationOptions): Promise<NativeLocationResult | null> {
  const {
    timeoutMs = 10000,
    minAccuracy = 50,
    fallbackToSettings = true,
    skipCache = false,
    allowBrowserFallback = true,
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

  const nativeTimeoutMs = getContextAttemptTimeout(timeoutMs);
  const browserTimeoutMs = getContextAttemptTimeout(timeoutMs);
 
  console.log(`[NativelyLocation] Context location flow: trying Natively first (${nativeTimeoutMs}ms)`);
 
  const nativeWinner = await tryNativeSdkLocation({
    mode: 'context',
    timeoutMs: nativeTimeoutMs,
    bridgeTimeoutMs: Math.min(BRIDGE_READY_TIMEOUT, nativeTimeoutMs),
    minAccuracy,
    accuracyType,
    priority,
    fallbackToSettings,
    useForeground: false,
    minimumWatchMs: 0,
    allowCurrentFallback: true,
  }).catch((err) => {
    console.warn('[NativelyLocation] Context native path threw:', err);
    return null;
  });

  if (nativeWinner && typeof nativeWinner.latitude === 'number' && typeof nativeWinner.longitude === 'number') {
    console.log('[NativelyLocation] ✅ Context native location:', nativeWinner.latitude, nativeWinner.longitude);
    setCachedLocation(nativeWinner);
    return nativeWinner;
  }

  const shouldUseBrowserFallback = allowBrowserFallback || !isRunningInsideNativelyApp();
  if (!shouldUseBrowserFallback) {
    console.warn('[NativelyLocation] Context flow: browser fallback disabled for this request');
    return null;
  }

  console.log(`[NativelyLocation] Context flow: native unavailable, trying browser geolocation (${browserTimeoutMs}ms)`);

  const browserWinner = await getBrowserLocation(browserTimeoutMs).catch((err) => {
    console.warn('[NativelyLocation] Context browser path threw:', err);
    return null;
  });

  if (browserWinner && typeof browserWinner.latitude === 'number' && typeof browserWinner.longitude === 'number') {
    console.log('[NativelyLocation] ✅ Context browser fallback location:', browserWinner.latitude, browserWinner.longitude);
    setCachedLocation(browserWinner);
    return browserWinner;
  }

  console.warn('[NativelyLocation] ❌ Context flow: no location from Natively SDK or browser fallback');
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
