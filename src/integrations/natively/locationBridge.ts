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
  // Legacy method (some SDK versions)
  getCurrentPosition?: (
    onSuccess: (position: any) => void,
    onError?: (err?: unknown) => void
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
  source: 'native' | 'browser' | 'cached';
}

export type LocationPermissionStatus = 'IN_USE' | 'ALWAYS' | 'DENIED' | 'UNKNOWN';

const LOCATION_CACHE_KEY = 'wakti_native_location_cache';
const LOCATION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes for fresh location

function getInstance(): NativelyLocationInstance | null {
  if (typeof window === 'undefined') return null;
  try {
    const Ctor = window.NativelyLocation;
    if (!Ctor) {
      console.log('[NativelyLocation] SDK not available (not in Natively app). window.NativelyLocation =', typeof window.NativelyLocation);
      // Log what IS available on window for debugging
      const nativelyKeys = Object.keys(window).filter(k => k.toLowerCase().includes('natively'));
      if (nativelyKeys.length > 0) {
        console.log('[NativelyLocation] Found Natively-related keys on window:', nativelyKeys);
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
 * Get current location using Natively SDK
 * Uses foreground location only (no background tracking)
 * 
 * @param options.timeoutMs - Timeout in milliseconds (default 10000)
 * @param options.minAccuracy - Minimum accuracy in meters (default 100)
 * @param options.accuracyType - iOS accuracy type (default 'HundredMeters')
 * @param options.priority - Android priority (default 'BALANCED')
 * @param options.fallbackToSettings - Show settings prompt if denied (default true)
 * @param options.skipCache - Force fresh location fetch (default false)
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
    minAccuracy = 100,
    accuracyType = 'HundredMeters',
    priority = 'BALANCED',
    fallbackToSettings = true,
    skipCache = false,
  } = options || {};

  // Check cache first (unless skipCache)
  if (!skipCache) {
    const cached = getCachedLocation();
    if (cached) {
      console.log('[NativelyLocation] Using cached location:', cached);
      return cached;
    }
  }

  const instance = getInstance();
  if (!instance) {
    console.log('[NativelyLocation] SDK not available, trying browser fallback');
    return getBrowserLocation(timeoutMs);
  }

  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        console.warn('[NativelyLocation] Timeout waiting for location');
        resolve(null);
      }
    }, timeoutMs);

    const handleResponse = (resp: NativelyLocationResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      console.log('[NativelyLocation] Response:', resp);

      if (resp.status === 'Success' || resp.status === 'Timeout') {
        const lat = resp.latitude;
        const lng = resp.longitude;
        if (typeof lat === 'number' && typeof lng === 'number') {
          const result: NativeLocationResult = {
            latitude: lat,
            longitude: lng,
            accuracy: resp.accuracy,
            city: resp.city,
            country: resp.country,
            source: 'native',
          };
          setCachedLocation(result);
          resolve(result);
          return;
        }
      }

      console.warn('[NativelyLocation] Failed to get location:', resp.status);
      resolve(null);
    };

    try {
      // Try new SDK method first
      if (typeof instance.current === 'function') {
        console.log('[NativelyLocation] Using current() method');
        instance.current(
          minAccuracy,
          accuracyType,
          priority,
          handleResponse,
          fallbackToSettings
        );
      } 
      // Fallback to legacy method
      else if (typeof instance.getCurrentPosition === 'function') {
        console.log('[NativelyLocation] Using legacy getCurrentPosition() method');
        instance.getCurrentPosition(
          (pos: any) => {
            const coords = pos?.coords || pos || {};
            handleResponse({
              status: 'Success',
              latitude: coords.latitude ?? coords.lat,
              longitude: coords.longitude ?? coords.lng,
              accuracy: coords.accuracy,
              city: pos?.city || coords?.city,
              country: pos?.country || coords?.country,
            });
          },
          () => {
            handleResponse({ status: 'Error' });
          }
        );
      } else {
        console.warn('[NativelyLocation] No location method available');
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    } catch (err) {
      console.error('[NativelyLocation] Error calling location method:', err);
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    }
  });
}

/**
 * Browser geolocation fallback (for web testing)
 */
async function getBrowserLocation(timeoutMs: number): Promise<NativeLocationResult | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        const result: NativeLocationResult = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          source: 'browser',
        };
        setCachedLocation(result);
        resolve(result);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      {
        enableHighAccuracy: false,
        timeout: timeoutMs,
        maximumAge: LOCATION_CACHE_TTL,
      }
    );
  });
}

/**
 * Detect if user query contains "near me" patterns (EN/AR)
 */
export function containsNearMePattern(query: string): boolean {
  if (!query || typeof query !== 'string') return false;
  const lower = query.toLowerCase();
  
  // English patterns
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
  ];
  
  // Arabic patterns
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
 * Check if query needs fresh location (near me, weather, traffic)
 */
export function queryNeedsFreshLocation(query: string): boolean {
  return containsNearMePattern(query) || containsWeatherPattern(query) || containsTrafficPattern(query);
}
