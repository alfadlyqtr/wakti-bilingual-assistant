/**
 * Natively HealthKit Bridge
 * Provides integration with Apple HealthKit via Natively SDK
 * 
 * HealthKit is only available on iPhone (not iPad or Android)
 * Requires user permission for each data type
 * 
 * Docs: https://docs.buildnatively.com/guides/integration/healthkit
 */

// HealthKit data types
// Per Natively docs, these are the ONLY valid Quantity Types:
// https://docs.buildnatively.com/guides/integration/healthkit
export type HealthKitQuantityType = 
  | 'HRV'           // Heart Rate Variability SDNN (milliseconds)
  | 'RHR'           // Resting Heart Rate (count/s)
  | 'BMI'           // Body Mass Index (count)
  | 'HEIGHT'        // Height (centimeters)
  | 'BODY_MASS'     // Body Mass (kilograms)
  | 'STEPS'         // Steps (count)
  | 'HEART_RATE'    // Heart Rate (count/min)
  | 'ACTIVE_ENERGY' // Active Energy Burned (kilocalories)
  | 'BLOOD_OXYGEN'; // Blood Oxygen (percent)
// NOTE: Basal/Resting Energy is ONLY available in WORKOUTS data, not as a standalone quantity type

export type HealthKitCharacteristicType = 
  | 'DATE_OF_BIRTH' // Age in years
  | 'BLOOD_TYPE'    // AB- / AB+ / A- / B+ / B- / O- / O+ / NOT_SET
  | 'SEX'           // MEN / WOMAN / OTHER / NOT_SET
  | 'SKIN_TYPE'     // I / II / III / IV / V / VI / NOT_SET
  | 'WHEELCHAIR';   // YES / NO / NOT_SET

export type HealthKitCategoryType = 
  | 'SLEEP_ANALYSIS'
  | 'ACTIVITY_SUMMARY'
  | 'WORKOUTS';

export type HealthKitDataType = HealthKitQuantityType | HealthKitCharacteristicType | HealthKitCategoryType;

export type HealthKitInterval = 'SECOND' | 'MINUTE' | 'HOUR' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

// Response types
export interface HealthKitAvailabilityResult {
  status: boolean;
}

export interface HealthKitPermissionResult {
  status: boolean;
}

export interface HealthKitCharacteristics {
  age?: number;
  sex?: 'MEN' | 'WOMAN' | 'OTHER' | 'NOT_SET';
  blood?: string;
  skin?: string;
  wheelchair?: 'YES' | 'NO' | 'NOT_SET';
}

export interface HealthKitQuantityData {
  date: string;
  value: number;
}

export interface HealthKitSleepAnalysis {
  date: string;
  inBed?: number;      // minutes
  awake?: number;      // minutes
  asleep?: number;     // minutes
  asleepRem?: number;  // minutes
  asleepDeep?: number; // minutes
  asleepLight?: number;// minutes
}

export interface HealthKitActivitySummary {
  date: string;
  activeBurned?: number;    // kilocalories
  activeGoal?: number;      // kilocalories
  exerciseTime?: number;    // minutes
  exerciseGoal?: number;    // minutes
  moveTime?: number;        // minutes
  moveGoal?: number;        // minutes
  standHours?: number;      // count
  standGoal?: number;       // count
}

export interface HealthKitWorkout {
  startDate: number;        // timestamp
  endDate: number;          // timestamp
  duration: number;         // seconds
  workoutName: string;
  totalBurned?: number;     // kilocalories
  activeBurned?: number;    // kilocalories (iOS 16+)
  basalBurned?: number;     // kilocalories (iOS 16+)
  heartRate?: number;       // count/min (iOS 16+)
}

interface NativelyHealthInstance {
  // Check if HealthKit is available on device
  available: (callback: (result: HealthKitAvailabilityResult, error?: string) => void) => void;
  
  // Request permissions - write types first, then read types
  requestAuthorization: (
    write: HealthKitDataType[],
    read: HealthKitDataType[],
    callback: (result: HealthKitPermissionResult, error?: string) => void
  ) => void;
  
  // Check permission status for a specific type
  getPermissionStatus?: (
    type: HealthKitDataType,
    callback: (result: { status: boolean }, error?: string) => void
  ) => void;

  // On your device it's exposed as permissionStatus
  permissionStatus?: (
    type: HealthKitDataType,
    callback: (result: { status: boolean }, error?: string) => void
  ) => void;
  
  // Get all user characteristics (age, sex, blood type, etc.)
  getAllCharacteristics?: (
    callback: (result: HealthKitCharacteristics, error?: string) => void
  ) => void;
  
  // Get quantity data (steps, heart rate, etc.)
  // SDKs differ by version. On your device it's getStatisticQuantity.
  // Keep multiple aliases to support multiple SDK versions.
  getStatisticQuantity?: (
    dataType: HealthKitQuantityType,
    interval: HealthKitInterval,
    startDate: Date,
    endDate: Date,
    callback: (result: { result: HealthKitQuantityData[] }, error?: string) => void
  ) => void;

  // Older/other SDK versions
  getStatisticQuantityValues?: (
    dataType: HealthKitQuantityType,
    interval: HealthKitInterval,
    startDate: Date,
    endDate: Date,
    callback: (result: { result: HealthKitQuantityData[] }, error?: string) => void
  ) => void;
  
  // Legacy alias - some SDK versions use this name
  getQuantity?: (
    dataType: HealthKitQuantityType,
    interval: HealthKitInterval,
    startDate: Date,
    endDate: Date,
    callback: (result: { result: HealthKitQuantityData[] }, error?: string) => void
  ) => void;
  
  // Get sleep analysis - per docs: getDailySleepAnalysis(limit, endDate, startDate, callback)
  getDailySleepAnalysis?: (
    limit: number,
    endDate: Date,
    startDate: Date,
    callback: (result: { result: HealthKitSleepAnalysis[] }, error?: string) => void
  ) => void;
  
  // Legacy alias
  getSleepAnalysis?: (
    startDate: Date,
    endDate: Date,
    limit: number,
    callback: (result: { result: HealthKitSleepAnalysis[] }, error?: string) => void
  ) => void;
  
  // Get activity summary - per docs: getActivitySummary(endDate, startDate, callback)
  getActivitySummary?: (
    endDate: Date,
    startDate: Date,
    callback: (result: { result: HealthKitActivitySummary[] }, error?: string) => void
  ) => void;
  
  // Get workouts - per docs: getWorkouts(endDate, startDate, limit, callback)
  // Note: endDate comes BEFORE startDate in Natively SDK!
  getWorkouts?: (
    endDate: Date,
    startDate: Date,
    limit: number,
    callback: (result: { result: HealthKitWorkout[] }, error?: string) => void
  ) => void;
}

/**
 * Get HealthKit SDK instance
 * Per Natively docs: const health = NativelyHealth() - it's a function call, not a constructor
 */
function getInstance(): NativelyHealthInstance | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const natively = (window as any).natively;
    const isNativeApp = natively?.isNativeApp === true || natively?.isIOSApp === true;
    
    console.log('[NativelyHealth] Environment check:', {
      hasNatively: !!natively,
      isNativeApp,
      isIOSApp: natively?.isIOSApp,
      isAndroidApp: natively?.isAndroidApp,
      hasNativelyHealth: typeof (window as any).NativelyHealth !== 'undefined',
    });
    
    // HealthKit is iOS only
    if (natively?.isAndroidApp) {
      console.log('[NativelyHealth] HealthKit not available on Android');
      return null;
    }
    
    // Per Natively docs: const health = NativelyHealth() - function call, not constructor
    const NativelyHealthFn = (window as any).NativelyHealth;
    if (typeof NativelyHealthFn === 'function') {
      let instance: any = null;
      
      try {
        // Try as function call first (per docs)
        instance = NativelyHealthFn();
        console.log('[NativelyHealth] Created instance via NativelyHealth() function call');
      } catch (e1) {
        console.log('[NativelyHealth] Function call failed, trying constructor...', e1);
        try {
          instance = new NativelyHealthFn();
          console.log('[NativelyHealth] Created instance via new NativelyHealth()');
        } catch (e2) {
          console.warn('[NativelyHealth] Both patterns failed:', e1, e2);
        }
      }
      
      if (instance) {
        // Log ALL available methods - both own and prototype
        const ownMethods = Object.keys(instance).filter(k => typeof instance[k] === 'function');
        const protoMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(instance) || {})
          .filter(k => k !== 'constructor' && typeof instance[k] === 'function');
        const allMethods = [...new Set([...ownMethods, ...protoMethods])];
        
        console.log('[NativelyHealth] === SDK METHODS AVAILABLE ===');
        console.log('[NativelyHealth] Own methods:', ownMethods);
        console.log('[NativelyHealth] Prototype methods:', protoMethods);
        console.log('[NativelyHealth] All methods:', allMethods);
        
        // Check for specific methods we need
        const methodChecks = {
          'available': typeof instance.available,
          'requestAuthorization': typeof instance.requestAuthorization,
          'getStatisticQuantityValues': typeof instance.getStatisticQuantityValues,
          'getQuantity': typeof instance.getQuantity,
          'getDailySleepAnalysis': typeof instance.getDailySleepAnalysis,
          'getSleepAnalysis': typeof instance.getSleepAnalysis,
          'getActivitySummary': typeof instance.getActivitySummary,
          'getWorkouts': typeof instance.getWorkouts,
          'getAllCharacteristics': typeof instance.getAllCharacteristics,
          'getPermissionStatus': typeof instance.getPermissionStatus,
        };
        console.log('[NativelyHealth] Method type checks:', methodChecks);
        console.log('[NativelyHealth] ===========================');
        
        return instance;
      }
    }
    
    // Try natively.health direct property
    if (natively?.health) {
      console.log('[NativelyHealth] Using natively.health instance');
      const methods = Object.keys(natively.health).filter(k => typeof natively.health[k] === 'function');
      console.log('[NativelyHealth] natively.health methods:', methods);
      return natively.health;
    }
    
    // Log available window properties for debugging
    const healthKeys = Object.keys(window).filter(k => 
      k.toLowerCase().includes('health') || k.toLowerCase().includes('natively')
    );
    if (healthKeys.length > 0) {
      console.log('[NativelyHealth] Found related keys on window:', healthKeys.slice(0, 15));
    }
    
    console.log('[NativelyHealth] No HealthKit SDK instance found');
    return null;
  } catch (err) {
    console.error('[NativelyHealth] Error getting instance:', err);
    return null;
  }
}

/**
 * Check if running inside Natively iOS app
 */
export function isNativelyIOSApp(): boolean {
  if (typeof window === 'undefined') return false;
  const natively = window.natively;
  return !!(natively?.isIOSApp || natively?.isNativeApp);
}

/**
 * Debug function to log all available SDK info
 * Call this from console to diagnose issues
 */
export function debugHealthKitSDK(): void {
  console.log('=== HealthKit SDK Debug ===');
  
  if (typeof window === 'undefined') {
    console.log('Window not available');
    return;
  }
  
  const natively = (window as any).natively;
  console.log('natively object:', natively);
  console.log('natively.isIOSApp:', natively?.isIOSApp);
  console.log('natively.isNativeApp:', natively?.isNativeApp);
  console.log('natively.isAndroidApp:', natively?.isAndroidApp);
  console.log('natively.health:', natively?.health);
  
  const NativelyHealth = (window as any).NativelyHealth;
  console.log('NativelyHealth class:', NativelyHealth);
  
  if (NativelyHealth) {
    try {
      const instance = typeof NativelyHealth === 'function' ? (NativelyHealth() || new NativelyHealth()) : new NativelyHealth();
      console.log('NativelyHealth instance:', instance);
      console.log('Instance keys:', Object.keys(instance));
      console.log('Prototype keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(instance)));
      
      // Check each expected method
      const methods = ['available', 'requestAuthorization', 'getQuantity', 'getSleepAnalysis', 'getActivitySummary', 'getWorkouts', 'getAllCharacteristics'];
      methods.forEach(m => {
        console.log(`  ${m}:`, typeof instance[m]);
      });
    } catch (e) {
      console.log('Failed to create instance:', e);
    }
  }
  
  // Check for any health-related globals
  const healthKeys = Object.keys(window).filter(k => 
    k.toLowerCase().includes('health') || 
    k.toLowerCase().includes('natively') ||
    k.toLowerCase().includes('native')
  );
  console.log('Health-related window keys:', healthKeys);
  
  console.log('=== End Debug ===');
}

type HealthKitDiagnosticsResult = {
  text: string;
  data: any;
};

export async function runHealthKitDiagnostics(): Promise<HealthKitDiagnosticsResult> {
  const out: any = {
    timestamp: new Date().toISOString(),
    env: {
      hasWindow: typeof window !== 'undefined',
      hasNatively: typeof window !== 'undefined' ? !!(window as any).natively : false,
      isIOSApp: typeof window !== 'undefined' ? !!(window as any).natively?.isIOSApp : false,
      isNativeApp: typeof window !== 'undefined' ? !!(window as any).natively?.isNativeApp : false,
      isAndroidApp: typeof window !== 'undefined' ? !!(window as any).natively?.isAndroidApp : false,
      hasNativelyHealthGlobal: typeof window !== 'undefined' ? typeof (window as any).NativelyHealth !== 'undefined' : false,
    },
  };

  const instance: any = getInstance();
  
  // Get ALL methods including inherited ones
  const getAllMethods = (obj: any): string[] => {
    const methods: string[] = [];
    let current = obj;
    while (current && current !== Object.prototype) {
      const names = Object.getOwnPropertyNames(current);
      for (const name of names) {
        if (typeof obj[name] === 'function' && name !== 'constructor') {
          methods.push(name);
        }
      }
      current = Object.getPrototypeOf(current);
    }
    return [...new Set(methods)];
  };
  
  out.instance = {
    exists: !!instance,
    ownKeys: instance ? Object.keys(instance) : [],
    protoKeys: instance ? Object.getOwnPropertyNames(Object.getPrototypeOf(instance) || {}) : [],
    allMethods: instance ? getAllMethods(instance) : [],
    // Check specific method names
    methodChecks: instance ? {
      available: typeof instance.available,
      requestAuthorization: typeof instance.requestAuthorization,
      getStatisticQuantity: typeof instance.getStatisticQuantity,
      getStatisticQuantityValues: typeof instance.getStatisticQuantityValues,
      getQuantity: typeof instance.getQuantity,
      getActivitySummary: typeof instance.getActivitySummary,
      getDailySleepAnalysis: typeof instance.getDailySleepAnalysis,
      getWorkouts: typeof instance.getWorkouts,
    } : null,
  };

  if (!instance) {
    const text = JSON.stringify(out, null, 2);
    return { text, data: out };
  }

  const promisify = <T>(
    label: string,
    fn: (cb: (res: any, err?: any) => void) => void,
    timeoutMs: number = 15000
  ): Promise<{ label: string; res: any; err: any; timedOut: boolean; ms: number }> => {
    const started = Date.now();
    return new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        resolve({ label, res: null, err: `timeout_${timeoutMs}ms`, timedOut: true, ms: Date.now() - started });
      }, timeoutMs);
      try {
        fn((res, err) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve({ label, res, err: err ?? null, timedOut: false, ms: Date.now() - started });
        });
      } catch (e) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve({ label, res: null, err: e, timedOut: false, ms: Date.now() - started });
      }
    });
  };

  out.available = await promisify('available', (cb) => instance.available((res: any, err: any) => cb(res, err)));

  const types: HealthKitDataType[] = [
    'STEPS',
    'HEART_RATE',
    'ACTIVE_ENERGY',
    'HRV',
    'RHR',
    'SLEEP_ANALYSIS',
    'ACTIVITY_SUMMARY',
    'WORKOUTS',
  ];

  out.requestAuthorization = await promisify('requestAuthorization', (cb) =>
    instance.requestAuthorization([], types, (res: any, err: any) => cb(res, err))
  );

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  out.dates = { startOfDay: startOfDay.toISOString(), now: now.toISOString() };

  const quantityMethod =
    instance.getStatisticQuantity ||
    instance.getStatisticQuantityValues ||
    instance.getQuantity;
  out.quantity = {
    hasGetStatisticQuantity: typeof (instance as any).getStatisticQuantity,
    hasGetStatisticQuantityValues: typeof (instance as any).getStatisticQuantityValues,
    hasGetQuantity: typeof (instance as any).getQuantity,
  };

  if (quantityMethod) {
    const q = async (dataType: HealthKitQuantityType, interval: HealthKitInterval) => {
      const r1 = await promisify(`quantity_${dataType}_${interval}_start_end`, (cb) =>
        quantityMethod.call(instance, dataType, interval, startOfDay, now, (res: any, err: any) => cb(res, err))
      );
      const normalized1 = r1.res?.result?.data ?? r1.res?.result ?? r1.res?.data ?? null;

      let r2: any = null;
      if (Array.isArray(normalized1) && normalized1.length === 0) {
        r2 = await promisify(`quantity_${dataType}_${interval}_end_start`, (cb) =>
          quantityMethod.call(instance, dataType, interval, now, startOfDay, (res: any, err: any) => cb(res, err))
        );
      }

      return {
        first: r1,
        firstNormalized: normalized1,
        second: r2,
        secondNormalized: r2 ? r2.res?.result?.data ?? r2.res?.result ?? r2.res?.data ?? null : null,
      };
    };

    out.samples = {
      steps: await q('STEPS', 'DAY'),
      activeEnergy: await q('ACTIVE_ENERGY', 'DAY'),
      heartRate: await q('HEART_RATE', 'HOUR'),
      restingHeartRate: await q('RHR', 'DAY'),
      hrv: await q('HRV', 'DAY'),
    };
  } else {
    out.samples = { error: 'no_quantity_method' };
  }

  const text = JSON.stringify(out, null, 2);
  return { text, data: out };
}

// Expose to window for console debugging
if (typeof window !== 'undefined') {
  (window as any).debugHealthKitSDK = debugHealthKitSDK;
}

/**
 * Check if HealthKit SDK is available
 */
export function isHealthKitSDKAvailable(): boolean {
  return getInstance() !== null;
}

/**
 * Check if HealthKit is available on this device
 * Returns false on iPad, Android, or non-Natively environments
 */
export async function checkHealthKitAvailability(): Promise<boolean> {
  const instance = getInstance();
  if (!instance) return false;
  
  return new Promise((resolve) => {
    try {
      instance.available((result, error) => {
        if (error) {
          console.warn('[NativelyHealth] Availability check error:', error);
          resolve(false);
          return;
        }
        console.log('[NativelyHealth] Availability:', result.status);
        resolve(result.status);
      });
    } catch (err) {
      console.error('[NativelyHealth] Error checking availability:', err);
      resolve(false);
    }
  });
}

/**
 * Request HealthKit permissions for specified data types
 */
export async function requestHealthKitPermissions(
  readTypes: HealthKitDataType[]
): Promise<boolean> {
  const instance = getInstance();
  if (!instance) return false;
  
  return new Promise((resolve) => {
    try {
      // We only request read permissions (empty write array)
      instance.requestAuthorization([], readTypes, (result, error) => {
        if (error) {
          console.warn('[NativelyHealth] Permission request error:', error);
          resolve(false);
          return;
        }
        console.log('[NativelyHealth] Permission result:', result.status);
        resolve(result.status);
      });
    } catch (err) {
      console.error('[NativelyHealth] Error requesting permissions:', err);
      resolve(false);
    }
  });
}

/**
 * Get user characteristics (age, sex, blood type, etc.)
 */
export async function getCharacteristics(): Promise<HealthKitCharacteristics | null> {
  const instance = getInstance();
  if (!instance?.getAllCharacteristics) return null;
  
  return new Promise((resolve) => {
    try {
      instance.getAllCharacteristics!((result, error) => {
        if (error) {
          console.warn('[NativelyHealth] Characteristics error:', error);
          resolve(null);
          return;
        }
        console.log('[NativelyHealth] Characteristics:', result);
        resolve(result);
      });
    } catch (err) {
      console.error('[NativelyHealth] Error getting characteristics:', err);
      resolve(null);
    }
  });
}

/**
 * Get quantity data (steps, heart rate, etc.)
 * Per Natively Bubble docs: getStatisticQuantity(data_type, interval, start_date, end_date, callback)
 * 
 * IMPORTANT: The Natively SDK uses HKStatisticsCollectionQuery which aggregates data
 * over time intervals. For DAY interval, it returns one value per day.
 */
export async function getQuantityData(
  dataType: HealthKitQuantityType,
  interval: HealthKitInterval,
  startDate: Date,
  endDate: Date
): Promise<HealthKitQuantityData[]> {
  const instance = getInstance();
  
  // Try all known method names
  const quantityMethod =
    (instance as any)?.getStatisticQuantity ||
    (instance as any)?.getStatisticQuantityValues ||
    (instance as any)?.getQuantity;
  
  console.log(`[NativelyHealth] getQuantityData called:`, {
    dataType,
    interval,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    hasInstance: !!instance,
    methodFound: !!quantityMethod,
    availableMethods: instance ? Object.getOwnPropertyNames(Object.getPrototypeOf(instance) || {}).filter(k => k !== 'constructor') : [],
  });
  
  if (!quantityMethod) {
    console.warn(`[NativelyHealth] No quantity method available on instance`);
    return [];
  }
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn(`[NativelyHealth] ${dataType} callback timeout after 15s`);
      resolve([]);
    }, 15000);
    
    try {
      console.log(`[NativelyHealth] Calling getStatisticQuantity for ${dataType} with interval ${interval}...`);
      
      // Per Natively Bubble docs for getStatisticQuantity: (data_type, interval, start_date, end_date, callback)
      // Note: Other methods like getWorkouts use (end_date, start_date) but quantity uses (start, end)
      quantityMethod.call(instance, dataType, interval, startDate, endDate, (res: any, error: string | undefined) => {
        clearTimeout(timeout);
        
        console.log(`[NativelyHealth] ${dataType} RAW response:`, JSON.stringify(res).substring(0, 1000));
        
        if (error) {
          console.warn(`[NativelyHealth] ${dataType} error:`, error);
          resolve([]);
          return;
        }
        
        // Normalize across SDK versions:
        // The response structure can vary:
        // - { result: [...] }
        // - { result: { data: [...] } }
        // - { data: [...] }
        // - [...] (direct array)
        let data: any[] = [];
        if (Array.isArray(res)) {
          data = res;
        } else if (Array.isArray(res?.result)) {
          data = res.result;
        } else if (Array.isArray(res?.result?.data)) {
          data = res.result.data;
        } else if (Array.isArray(res?.data)) {
          data = res.data;
        }
        
        console.log(`[NativelyHealth] ${dataType} normalized data:`, {
          count: data.length,
          firstItem: data[0] || null,
        });
        
        resolve(data);
      });
    } catch (err) {
      clearTimeout(timeout);
      console.error(`[NativelyHealth] Error getting ${dataType}:`, err);
      resolve([]);
    }
  });
}

/**
 * Get today's step count
 */
export async function getTodaySteps(): Promise<number> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const data = await getQuantityData('STEPS', 'DAY', startOfDay, now);
  if (data.length > 0) {
    return Math.round(data[0].value);
  }
  return 0;
}

/**
 * Get today's heart rate readings
 */
export async function getTodayHeartRate(): Promise<{ avg: number; latest: number } | null> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const data = await getQuantityData('HEART_RATE', 'HOUR', startOfDay, now);
  if (data.length === 0) return null;
  
  const values = data.map(d => d.value).filter(v => v > 0);
  if (values.length === 0) return null;
  
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const latest = Math.round(values[values.length - 1]);
  
  return { avg, latest };
}

/**
 * Get today's resting heart rate
 */
export async function getTodayRestingHeartRate(): Promise<number | null> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const data = await getQuantityData('RHR', 'DAY', startOfDay, now);
  if (data.length === 0) return null;
  
  return Math.round(data[0].value);
}

/**
 * Get today's heart rate variability (HRV)
 */
export async function getTodayHRV(): Promise<number | null> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const data = await getQuantityData('HRV', 'DAY', startOfDay, now);
  if (data.length === 0) return null;
  
  return Math.round(data[0].value);
}

/**
 * Get sleep analysis data
 * Per Natively docs: getDailySleepAnalysis(limit, endDate, startDate, callback)
 */
export async function getSleepAnalysis(
  startDate: Date,
  endDate: Date,
  limit: number = 7
): Promise<HealthKitSleepAnalysis[]> {
  const instance = getInstance();
  
  // Try both method names
  const sleepMethod = instance?.getDailySleepAnalysis || instance?.getSleepAnalysis;
  
  if (!sleepMethod) {
    console.warn('[NativelyHealth] No sleep analysis method available');
    return [];
  }
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn('[NativelyHealth] Sleep analysis callback timeout after 10s');
      resolve([]);
    }, 10000);
    
    try {
      // Per docs: getDailySleepAnalysis(limit, endDate, startDate, callback)
      // Note the reversed date order!
      if (instance?.getDailySleepAnalysis) {
        instance.getDailySleepAnalysis(limit, endDate, startDate, (res: any, error: string | undefined) => {
          clearTimeout(timeout);
          const data = res?.result || res?.data || [];
          if (error) {
            console.warn('[NativelyHealth] Sleep analysis error:', error);
            resolve([]);
            return;
          }
          console.log('[NativelyHealth] Sleep data:', data?.length || 0, 'records');
          resolve(data);
        });
      } else {
        // Legacy method signature
        instance!.getSleepAnalysis!(startDate, endDate, limit, (res: any, error: string | undefined) => {
          clearTimeout(timeout);
          const data = res?.result || res?.data || [];
          if (error) {
            console.warn('[NativelyHealth] Sleep analysis error:', error);
            resolve([]);
            return;
          }
          console.log('[NativelyHealth] Sleep data:', data?.length || 0, 'records');
          resolve(data);
        });
      }
    } catch (err) {
      clearTimeout(timeout);
      console.error('[NativelyHealth] Error getting sleep:', err);
      resolve([]);
    }
  });
}

/**
 * Get activity summary (rings data)
 * Per Natively docs: getActivitySummary(endDate, startDate, callback)
 * Note: endDate comes BEFORE startDate!
 */
export async function getActivitySummary(
  startDate: Date,
  endDate: Date
): Promise<HealthKitActivitySummary[]> {
  const instance = getInstance();
  
  console.log('[NativelyHealth] getActivitySummary called:', {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    hasInstance: !!instance,
    hasMethod: !!instance?.getActivitySummary,
  });
  
  if (!instance?.getActivitySummary) {
    console.warn('[NativelyHealth] getActivitySummary method not available');
    return [];
  }
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn('[NativelyHealth] Activity summary callback timeout after 10s');
      resolve([]);
    }, 10000);
    
    try {
      console.log('[NativelyHealth] Calling getActivitySummary...');
      // Per docs: getActivitySummary(endDate, startDate, callback) - dates reversed!
      instance.getActivitySummary!(endDate, startDate, (res: any, error: string | undefined) => {
        clearTimeout(timeout);
        
        // Per Natively docs, result comes in res.result
        const data = res?.result || res?.data || [];
        
        console.log('[NativelyHealth] Activity summary callback:', {
          hasRes: !!res,
          hasResult: !!res?.result,
          hasData: !!res?.data,
          dataLength: data?.length,
          error,
          rawResult: JSON.stringify(res).substring(0, 500),
        });
        
        if (error) {
          console.warn('[NativelyHealth] Activity summary error:', error);
          resolve([]);
          return;
        }
        console.log('[NativelyHealth] Activity data:', data?.length || 0, 'records');
        resolve(data);
      });
    } catch (err) {
      clearTimeout(timeout);
      console.error('[NativelyHealth] Error getting activity:', err);
      resolve([]);
    }
  });
}

/**
 * Get workouts
 * Per Natively docs: getWorkouts(endDate, startDate, limit, callback)
 * Note: endDate comes BEFORE startDate!
 */
export async function getWorkouts(
  startDate: Date,
  endDate: Date,
  limit: number = 10
): Promise<HealthKitWorkout[]> {
  const instance = getInstance();
  if (!instance?.getWorkouts) {
    console.warn('[NativelyHealth] getWorkouts method not available');
    return [];
  }
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn('[NativelyHealth] Workouts callback timeout after 10s');
      resolve([]);
    }, 10000);
    
    try {
      // Per docs: getWorkouts(endDate, startDate, limit, callback) - dates reversed!
      instance.getWorkouts!(endDate, startDate, limit, (res: any, error: string | undefined) => {
        clearTimeout(timeout);
        
        // Per Natively docs, result comes in res.result
        const data = res?.result || res?.data || [];
        
        if (error) {
          console.warn('[NativelyHealth] Workouts error:', error);
          resolve([]);
          return;
        }
        console.log('[NativelyHealth] Workouts data:', data?.length || 0, 'records');
        resolve(data);
      });
    } catch (err) {
      clearTimeout(timeout);
      console.error('[NativelyHealth] Error getting workouts:', err);
      resolve([]);
    }
  });
}

/**
 * Get a comprehensive health summary for today
 */
export async function getTodayHealthSummary(): Promise<{
  steps: number;
  heartRate: { avg: number; latest: number } | null;
  activeEnergy: number;
  basalEnergy: number; // Derived from activity summary or workouts, not a standalone quantity
  activity: HealthKitActivitySummary | null;
  restingHeartRate: number | null;
  hrv: number | null;
}> {
  console.log('[NativelyHealth] getTodayHealthSummary called');
  
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Option B: Use end of day for DAY interval queries to get full day aggregates
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  
  console.log('[NativelyHealth] Date range:', {
    startOfDay: startOfDay.toISOString(),
    endOfDay: endOfDay.toISOString(),
    now: now.toISOString(),
  });
  
  // Fetch all data in parallel
  // NOTE: BASAL_ENERGY is NOT a valid Natively quantity type - it only exists in WORKOUTS data
  const results = await Promise.allSettled([
    getTodaySteps(),
    getTodayHeartRate(),
    getQuantityData('ACTIVE_ENERGY', 'DAY', startOfDay, endOfDay),
    getActivitySummary(startOfDay, endOfDay),
    getTodayRestingHeartRate(),
    getTodayHRV(),
  ]);
  
  // Log each result
  const labels = ['steps', 'heartRate', 'activeEnergy', 'activity', 'restingHeartRate', 'hrv'];
  results.forEach((result, i) => {
    console.log(`[NativelyHealth] ${labels[i]} result:`, {
      status: result.status,
      value: result.status === 'fulfilled' ? result.value : undefined,
      reason: result.status === 'rejected' ? result.reason : undefined,
    });
  });
  
  const steps = results[0].status === 'fulfilled' ? results[0].value as number : 0;
  const heartRate = results[1].status === 'fulfilled' ? results[1].value as { avg: number; latest: number } | null : null;
  const activeEnergyData = results[2].status === 'fulfilled' ? results[2].value as HealthKitQuantityData[] : [];
  const activityData = results[3].status === 'fulfilled' ? results[3].value as HealthKitActivitySummary[] : [];
  const restingHeartRate = results[4].status === 'fulfilled' ? results[4].value as number | null : null;
  const hrv = results[5].status === 'fulfilled' ? results[5].value as number | null : null;
  
  // basalEnergy is not available as a standalone quantity in Natively SDK
  // It would need to be calculated from workouts or estimated
  const summary = {
    steps,
    heartRate,
    activeEnergy: activeEnergyData.length > 0 ? Math.round(activeEnergyData[0].value) : 0,
    basalEnergy: 0, // Not available as standalone - only in WORKOUTS data
    activity: activityData.length > 0 ? activityData[0] : null,
    restingHeartRate,
    hrv,
  };
  
  console.log('[NativelyHealth] Final summary:', summary);
  
  return summary;
}
