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

function logNativelyRuntimeStatus(context: string): void {
  if (typeof window === 'undefined') return;
  const natively = (window as any).natively;
  const isNativeApp = natively?.isNativeApp === true || natively?.isIOSApp === true || natively?.isAndroidApp === true;
  console.log('[NativelyLocation] Runtime status:', {
    context,
    nativelyReady: (window as any).__nativelyReady,
    hasNatively: !!natively,
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
    fallbackToSettings = true,
    skipCache = false,
  } = options || {};

  // When skipCache (forceFresh), use higher accuracy settings for real GPS
  const accuracyType = options?.accuracyType || (skipCache ? 'Best' : 'HundredMeters');
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

  // Try Natively SDK FIRST
  const instance = getInstance();
  if (!instance) {
    console.log('[NativelyLocation] Natively SDK not available, trying browser fallback');
    return getBrowserLocation(timeoutMs);
  }

  const sdkResult = await new Promise<NativeLocationResult | null>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        console.warn('[NativelyLocation] Timeout waiting for SDK location');
        resolve(null);
      }
    }, timeoutMs);

    const handleResponse = (resp: NativelyLocationResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      console.log('[NativelyLocation] SDK Response:', JSON.stringify(resp));

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

      console.warn('[NativelyLocation] SDK failed to get location:', resp.status);
      resolve(null);
    };

    try {
      // Try new SDK method first
      if (typeof instance.current === 'function') {
        console.log('[NativelyLocation] Using current() method with accuracy:', accuracyType, 'priority:', priority);
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
        console.warn('[NativelyLocation] No location method available on SDK instance');
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    } catch (err) {
      console.error('[NativelyLocation] Error calling SDK location method:', err);
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    }
  });

  // If SDK succeeded, return the result
  if (sdkResult) {
    return sdkResult;
  }

  // SDK failed/timed out — try browser geolocation as fallback
  console.log('[NativelyLocation] SDK failed, trying browser geolocation fallback...');
  return getBrowserLocation(timeoutMs);
}

/**
 * Browser geolocation fallback (works in Natively WebView too)
 */
async function getBrowserLocation(timeoutMs: number): Promise<NativeLocationResult | null> {
  console.log('[NativelyLocation] Trying browser geolocation fallback...');
  
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    console.log('[NativelyLocation] Browser geolocation not available');
    return null;
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.log('[NativelyLocation] Browser geolocation timeout');
      resolve(null);
    }, timeoutMs);

    console.log('[NativelyLocation] Calling navigator.geolocation.getCurrentPosition...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        console.log('[NativelyLocation] ✅ Browser geolocation success:', pos.coords.latitude, pos.coords.longitude);
        const result: NativeLocationResult = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          source: 'browser',
        };
        setCachedLocation(result);
        resolve(result);
      },
      (err) => {
        clearTimeout(timer);
        console.log('[NativelyLocation] ❌ Browser geolocation error:', err.code, err.message);
        resolve(null);
      },
      {
        enableHighAccuracy: true, // Request high accuracy since user granted permission
        timeout: timeoutMs,
        maximumAge: 60000, // Accept cached position up to 1 minute old
      }
    );
  });
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
