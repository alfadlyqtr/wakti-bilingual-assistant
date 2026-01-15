declare global {
  interface Window {
    NativelyCalendar?: any;
  }
}

export interface CalendarObject {
  id: string;
}

export interface CreateEventResult {
  status: 'SUCCESS' | 'FAILED';
  data?: {
    id: string;
    title: string;
    start: string;
    end: string;
  };
  error?: string;
}

export interface RetrieveCalendarsResult {
  status: 'SUCCESS' | 'FAILED';
  data?: CalendarObject[];
  error?: string;
}

function getInstance(): any | null {
  try {
    if (typeof window === 'undefined') {
      console.log('[NativelyCalendar] Window undefined - not in browser');
      return null;
    }
    
    // Check if we're in a Natively app context
    const natively = (window as any).natively;
    const isNativeApp = natively?.isNativeApp === true || natively?.isIOSApp === true || natively?.isAndroidApp === true;
    
    console.log('[NativelyCalendar] Checking SDK availability:', {
      hasNatively: !!natively,
      isNativeApp,
      hasNativelyCalendar: typeof (window as any).NativelyCalendar !== 'undefined',
      nativelyReady: (window as any).__nativelyReady,
    });
    
    const Ctor = (window as any).NativelyCalendar;
    if (!Ctor) {
      console.log('[NativelyCalendar] NativelyCalendar class not found on window - not in Natively app');
      // Log what IS available on window for debugging
      const nativelyKeys = Object.keys(window).filter(k => k.toLowerCase().includes('natively') || k.toLowerCase().includes('native') || k.toLowerCase().includes('calendar'));
      if (nativelyKeys.length > 0) {
        console.log('[NativelyCalendar] Found Native/Calendar-related keys on window:', nativelyKeys.slice(0, 20));
      }
      return null;
    }
    console.log('[NativelyCalendar] SDK found, creating instance...');
    const instance = new Ctor();
    console.log('[NativelyCalendar] Instance created. Methods available:', {
      hasRetrieveCalendars: typeof instance.retrieveCalendars === 'function',
      hasCreateCalendarEvent: typeof instance.createCalendarEvent === 'function',
    });
    return instance;
  } catch (err) {
    console.error('[NativelyCalendar] Error creating instance:', err);
    return null;
  }
}

/**
 * Check if Natively Calendar SDK is available
 */
export function isNativeCalendarAvailable(): boolean {
  return getInstance() !== null;
}

/**
 * Retrieve available calendars from the device
 */
export function retrieveCalendars(callback: (result: RetrieveCalendarsResult) => void): void {
  const cal = getInstance();
  if (!cal) {
    console.warn('[NativelyCalendar] Cannot retrieve calendars - SDK not available');
    callback({ status: 'FAILED', error: 'SDK not available' });
    return;
  }

  try {
    console.log('[NativelyCalendar] ========== CALLING retrieveCalendars ==========');
    
    // Set a timeout in case callback never fires
    let callbackFired = false;
    const timeoutId = setTimeout(() => {
      if (!callbackFired) {
        console.warn('[NativelyCalendar] retrieveCalendars timeout - callback never fired');
        callback({ status: 'FAILED', error: 'Timeout waiting for calendar response' });
      }
    }, 10000); // 10 second timeout
    
    cal.retrieveCalendars((resp: any) => {
      callbackFired = true;
      clearTimeout(timeoutId);
      
      console.log('[NativelyCalendar] ===== RETRIEVE CALENDARS RESPONSE =====');
      console.log('[NativelyCalendar] Raw resp:', JSON.stringify(resp));
      console.log('[NativelyCalendar] resp type:', typeof resp);
      console.log('[NativelyCalendar] resp.status:', resp?.status);
      console.log('[NativelyCalendar] resp.data:', JSON.stringify(resp?.data));
      console.log('[NativelyCalendar] resp.error:', resp?.error);
      console.log('[NativelyCalendar] resp.id:', resp?.id);
      console.log('[NativelyCalendar] ======================================');
      
      // Handle various response formats from Natively SDK
      let calendars: CalendarObject[] = [];
      
      // Try to extract calendars from response - check ALL possible locations
      if (Array.isArray(resp?.data)) {
        calendars = resp.data.filter((c: any) => c?.id).map((c: any) => ({ id: String(c.id) }));
      } else if (resp?.data?.id) {
        calendars = [{ id: String(resp.data.id) }];
      } else if (typeof resp?.data === 'string' && resp.data.length > 0) {
        calendars = [{ id: resp.data }];
      } else if (resp?.id) {
        calendars = [{ id: String(resp.id) }];
      } else if (Array.isArray(resp)) {
        // Response itself might be the array
        calendars = resp.filter((c: any) => c?.id).map((c: any) => ({ id: String(c.id) }));
      }
      
      console.log('[NativelyCalendar] Extracted calendars:', JSON.stringify(calendars));
      
      if (calendars.length > 0) {
        callback({ status: 'SUCCESS', data: calendars });
      } else if (resp?.status === 'SUCCESS') {
        callback({ status: 'SUCCESS', data: [] });
      } else {
        const errorMsg = resp?.error || resp?.message || 'Failed to retrieve calendars';
        callback({ status: 'FAILED', error: String(errorMsg) });
      }
    });
    
    console.log('[NativelyCalendar] retrieveCalendars called, waiting for callback...');
  } catch (err) {
    console.error('[NativelyCalendar] Error calling retrieveCalendars:', err);
    callback({ status: 'FAILED', error: String(err) });
  }
}

/**
 * Create an event in the device calendar
 * SDK signature from docs: createCalendarEvent(title, endDate, startDate, timezone, calendarId, description, callback)
 * All date strings must be ISO 8601 format: "2025-07-10 14:00:00.000"
 * 
 * @param title Event title (required)
 * @param startDate Date object for event start (converted to ISO string)
 * @param endDate Date object for event end (converted to ISO string)
 * @param timezone ISO 8601 timezone e.g. "Asia/Riyadh"
 * @param calendarId Calendar ID string (use null if not available)
 * @param description Event description (use null if none)
 * @param callback Callback with result
 */
export function createCalendarEvent(
  title: string,
  startDate: Date,
  endDate: Date,
  timezone: string,
  calendarId: string | null,
  description: string | null,
  callback: (result: CreateEventResult) => void
): void {
  const cal = getInstance();
  if (!cal) {
    console.warn('[NativelyCalendar] Cannot create event - SDK not available');
    callback({ status: 'FAILED', error: 'SDK not available' });
    return;
  }

  if (!title || !startDate || !endDate || !timezone) {
    console.warn('[NativelyCalendar] Missing required parameters');
    callback({ status: 'FAILED', error: 'Missing required parameters' });
    return;
  }

  // Validate dates are actual Date objects
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
    console.warn('[NativelyCalendar] startDate and endDate must be Date objects');
    callback({ status: 'FAILED', error: 'Invalid date objects' });
    return;
  }

  try {
    // Prepare string parameters
    const timezoneStr = timezone?.trim() || 'UTC';
    const calendarIdStr = calendarId?.trim() || '';
    const descriptionStr = description?.trim() || '';
    
    // Validate dates are valid (not NaN)
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.warn('[NativelyCalendar] Invalid date values - NaN detected');
      callback({ status: 'FAILED', error: 'Invalid date values' });
      return;
    }
    
    // Format dates as strings in Natively expected format: "2025-07-10 14:00:00.000"
    const startDateStr = formatDateForNatively(startDate);
    const endDateStr = formatDateForNatively(endDate);
    
    // Also prepare ISO strings in case SDK expects standard ISO format
    const startDateISO = startDate.toISOString();
    const endDateISO = endDate.toISOString();

    console.log('[NativelyCalendar] ===== CREATE EVENT DEBUG =====');
    console.log('[NativelyCalendar] title:', title);
    console.log('[NativelyCalendar] startDate (Date object):', startDate);
    console.log('[NativelyCalendar] startDate (Natively format):', startDateStr);
    console.log('[NativelyCalendar] startDate (ISO):', startDateISO);
    console.log('[NativelyCalendar] endDate (Date object):', endDate);
    console.log('[NativelyCalendar] endDate (Natively format):', endDateStr);
    console.log('[NativelyCalendar] endDate (ISO):', endDateISO);
    console.log('[NativelyCalendar] timezone:', timezoneStr);
    console.log('[NativelyCalendar] calendarId:', calendarIdStr);
    console.log('[NativelyCalendar] description:', descriptionStr);
    console.log('[NativelyCalendar] ==============================');

    // SDK signature from docs: createCalendarEvent(title, endDate, startDate, timezone, calendarId, description, callback)
    // Try passing Date objects directly - SDK might call toISOString() internally
    cal.createCalendarEvent(
      title,
      endDate,      // Pass Date object
      startDate,    // Pass Date object
      timezoneStr,
      calendarIdStr,
      descriptionStr,
      (resp: any) => {
        console.log('[NativelyCalendar] createCalendarEvent response:', JSON.stringify(resp));
        if (resp?.status === 'SUCCESS' || resp?.data?.id) {
          callback({
            status: 'SUCCESS',
            data: {
              id: resp.data?.id || '',
              title: resp.data?.title || title,
              start: resp.data?.start || startDateStr,
              end: resp.data?.end || endDateStr
            }
          });
        } else {
          callback({
            status: 'FAILED',
            error: resp?.error || 'Failed to create event'
          });
        }
      }
    );
  } catch (err) {
    console.error('[NativelyCalendar] Error calling createCalendarEvent:', err);
    callback({ status: 'FAILED', error: String(err) });
  }
}

/**
 * Format a Date object to ISO 8601 string for Natively Calendar
 */
export function formatDateForNatively(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.000`;
}

/**
 * Get the user's timezone in ISO 8601 format
 */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/**
 * Check if the Natively debug console is available
 */
export function isNativelyConsoleAvailable(): boolean {
  try {
    return Boolean((window as any)?.natively?.openConsole);
  } catch {
    return false;
  }
}

/**
 * Open the Natively debug console (native app only)
 */
export function openNativelyConsole(): boolean {
  try {
    const natively = (window as any)?.natively;
    if (!natively?.openConsole) {
      console.warn('[NativelyCalendar] openConsole not available');
      return false;
    }
    natively.openConsole();
    return true;
  } catch (err) {
    console.warn('[NativelyCalendar] Failed to open console:', err);
    return false;
  }
}
