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
export type HealthKitQuantityType = 
  | 'HRV'           // Heart Rate Variability (milliseconds)
  | 'RHR'           // Resting Heart Rate (count/s)
  | 'BMI'           // Body Mass Index (count)
  | 'HEIGHT'        // Height (centimeters)
  | 'BODY_MASS'     // Body Mass (kilograms)
  | 'STEPS'         // Steps (count)
  | 'HEART_RATE'    // Heart Rate (count/min)
  | 'ACTIVE_ENERGY' // Active Energy Burned (kilocalories)
  | 'BLOOD_OXYGEN'; // Blood Oxygen (percent)

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
  available: (callback: (result: HealthKitAvailabilityResult, error?: string) => void) => void;
  requestAuthorization: (
    write: HealthKitDataType[],
    read: HealthKitDataType[],
    callback: (result: HealthKitPermissionResult, error?: string) => void
  ) => void;
  getPermissionStatus?: (
    type: HealthKitDataType,
    callback: (result: { status: boolean }, error?: string) => void
  ) => void;
  getAllCharacteristics?: (
    callback: (result: HealthKitCharacteristics, error?: string) => void
  ) => void;
  getQuantity?: (
    dataType: HealthKitQuantityType,
    interval: HealthKitInterval,
    startDate: Date,
    endDate: Date,
    callback: (result: { data: HealthKitQuantityData[] }, error?: string) => void
  ) => void;
  getSleepAnalysis?: (
    startDate: Date,
    endDate: Date,
    limit: number,
    callback: (result: { data: HealthKitSleepAnalysis[] }, error?: string) => void
  ) => void;
  getActivitySummary?: (
    startDate: Date,
    endDate: Date,
    callback: (result: { data: HealthKitActivitySummary[] }, error?: string) => void
  ) => void;
  getWorkouts?: (
    startDate: Date,
    endDate: Date,
    limit: number,
    callback: (result: { data: HealthKitWorkout[] }, error?: string) => void
  ) => void;
}

/**
 * Get HealthKit SDK instance
 */
function getInstance(): NativelyHealthInstance | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const natively = window.natively;
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
    
    // Try NativelyHealth constructor
    const Ctor = (window as any).NativelyHealth;
    if (Ctor) {
      try {
        const instance = new Ctor();
        console.log('[NativelyHealth] Created instance from NativelyHealth class');
        return instance;
      } catch (e) {
        console.warn('[NativelyHealth] Failed to create instance:', e);
      }
    }
    
    // Try natively.health direct property
    if (natively?.health) {
      console.log('[NativelyHealth] Using natively.health instance');
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
 */
export async function getQuantityData(
  dataType: HealthKitQuantityType,
  interval: HealthKitInterval,
  startDate: Date,
  endDate: Date
): Promise<HealthKitQuantityData[]> {
  const instance = getInstance();
  if (!instance?.getQuantity) return [];
  
  return new Promise((resolve) => {
    try {
      instance.getQuantity!(dataType, interval, startDate, endDate, (result, error) => {
        if (error) {
          console.warn(`[NativelyHealth] ${dataType} error:`, error);
          resolve([]);
          return;
        }
        console.log(`[NativelyHealth] ${dataType} data:`, result.data?.length || 0, 'records');
        resolve(result.data || []);
      });
    } catch (err) {
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
 * Get sleep analysis data
 */
export async function getSleepAnalysis(
  startDate: Date,
  endDate: Date,
  limit: number = 7
): Promise<HealthKitSleepAnalysis[]> {
  const instance = getInstance();
  if (!instance?.getSleepAnalysis) return [];
  
  return new Promise((resolve) => {
    try {
      instance.getSleepAnalysis!(startDate, endDate, limit, (result, error) => {
        if (error) {
          console.warn('[NativelyHealth] Sleep analysis error:', error);
          resolve([]);
          return;
        }
        console.log('[NativelyHealth] Sleep data:', result.data?.length || 0, 'records');
        resolve(result.data || []);
      });
    } catch (err) {
      console.error('[NativelyHealth] Error getting sleep:', err);
      resolve([]);
    }
  });
}

/**
 * Get activity summary (rings data)
 */
export async function getActivitySummary(
  startDate: Date,
  endDate: Date
): Promise<HealthKitActivitySummary[]> {
  const instance = getInstance();
  if (!instance?.getActivitySummary) return [];
  
  return new Promise((resolve) => {
    try {
      instance.getActivitySummary!(startDate, endDate, (result, error) => {
        if (error) {
          console.warn('[NativelyHealth] Activity summary error:', error);
          resolve([]);
          return;
        }
        console.log('[NativelyHealth] Activity data:', result.data?.length || 0, 'records');
        resolve(result.data || []);
      });
    } catch (err) {
      console.error('[NativelyHealth] Error getting activity:', err);
      resolve([]);
    }
  });
}

/**
 * Get workouts
 */
export async function getWorkouts(
  startDate: Date,
  endDate: Date,
  limit: number = 10
): Promise<HealthKitWorkout[]> {
  const instance = getInstance();
  if (!instance?.getWorkouts) return [];
  
  return new Promise((resolve) => {
    try {
      instance.getWorkouts!(startDate, endDate, limit, (result, error) => {
        if (error) {
          console.warn('[NativelyHealth] Workouts error:', error);
          resolve([]);
          return;
        }
        console.log('[NativelyHealth] Workouts data:', result.data?.length || 0, 'records');
        resolve(result.data || []);
      });
    } catch (err) {
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
  activity: HealthKitActivitySummary | null;
}> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const [steps, heartRate, activeEnergyData, activityData] = await Promise.all([
    getTodaySteps(),
    getTodayHeartRate(),
    getQuantityData('ACTIVE_ENERGY', 'DAY', startOfDay, now),
    getActivitySummary(startOfDay, now),
  ]);
  
  return {
    steps,
    heartRate,
    activeEnergy: activeEnergyData.length > 0 ? Math.round(activeEnergyData[0].value) : 0,
    activity: activityData.length > 0 ? activityData[0] : null,
  };
}
