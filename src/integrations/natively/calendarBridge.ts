export {};

declare global {
  interface Window {
    NativelyCalendar?: any;
  }
}

export interface CreateCalendarResult {
  status: 'SUCCESS' | 'FAILED';
  id?: string;
  error?: string;
}

export interface PhoneCalendarEvent {
  id?: string;
  title: string;
  startDate: string;
  endDate: string;
  calendarId?: string;
}

export interface RetrieveCalendarEventsResult {
  status: 'SUCCESS' | 'FAILED';
  data?: PhoneCalendarEvent[];
  error?: string;
}

export function retrieveCalendarEventsIfSupported(
  callback: (result: RetrieveCalendarEventsResult) => void
): void {
  const cal = getInstance();
  if (!cal) {
    callback({ status: 'FAILED', error: 'SDK not available' });
    return;
  }

  const fn =
    cal.retrieveCalendarEvents ||
    cal.getCalendarEvents ||
    cal.retrieveEvents ||
    cal.getEvents ||
    cal.readCalendarEvents;

  if (typeof fn !== 'function') {
    callback({ status: 'FAILED', error: 'retrieveCalendarEvents not available' });
    return;
  }

  const normalizeEvents = (resp: any): PhoneCalendarEvent[] => {
    const raw = resp?.data || resp?.events || resp?.items || resp;
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .map((event: any) => {
        const title = event?.title || event?.name || event?.summary || 'Untitled';
        const startDate =
          event?.start || event?.startDate || event?.start_time || event?.startTime || '';
        const endDate =
          event?.end || event?.endDate || event?.end_time || event?.endTime || '';
        const calendarId = event?.calendarId || event?.calendar_id || event?.calendar || undefined;
        const id = event?.id || event?.eventId || event?.uid || undefined;

        if (!startDate || !endDate) {
          return null;
        }

        return {
          id: id ? String(id) : undefined,
          title: String(title),
          startDate: String(startDate),
          endDate: String(endDate),
          calendarId: calendarId ? String(calendarId) : undefined
        } as PhoneCalendarEvent;
      })
      .filter(Boolean) as PhoneCalendarEvent[];
  };

  const callWithCallbackOnly = () =>
    fn.call(cal, (resp: any) => {
      const events = normalizeEvents(resp);
      if (events.length > 0) {
        callback({ status: 'SUCCESS', data: events });
      } else if (resp?.status === 'SUCCESS') {
        callback({ status: 'SUCCESS', data: [] });
      } else {
        callback({ status: 'FAILED', error: resp?.error || resp?.message || 'Failed to retrieve events' });
      }
    });

  try {
    callWithCallbackOnly();
  } catch (err) {
    callback({ status: 'FAILED', error: String(err) });
  }
}

export function createCalendarIfSupported(name: string, callback: (result: CreateCalendarResult) => void): void {
  const cal = getInstance();
  if (!cal || typeof cal.createCalendar !== 'function') {
    callback({ status: 'FAILED', error: 'createCalendar not available' });
    return;
  }

  try {
    cal.createCalendar(name, (resp: any) => {
      const id = resp?.data?.id || resp?.id || resp?.data || resp?.calendarId;
      if (resp?.status === 'SUCCESS' || id) {
        callback({ status: 'SUCCESS', id: id ? String(id) : '' });
      } else {
        callback({
          status: 'FAILED',
          error: resp?.error || resp?.message || 'Failed to create calendar'
        });
      }
    });
  } catch (err) {
    callback({ status: 'FAILED', error: String(err) });
  }
}

export interface CalendarObject {
  id: string;
  name?: string;
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
    
    console.log('[NativelyCalendar] Environment check:', {
      hasNatively: !!natively,
      isNativeApp,
      nativelyReady: (window as any).__nativelyReady,
      hasCalendarSDK: !!(window as any).NativelyCalendar || !!(window as any).nativeCalendar || !!natively?.calendar
    });
    
    // Try all possible calendar SDK locations
    let calendarInstance = null;
    
    // 1. Try window.NativelyCalendar constructor
    const Ctor = (window as any).NativelyCalendar;
    if (Ctor) {
      try {
        calendarInstance = new Ctor();
        console.log('[NativelyCalendar] Successfully created instance from NativelyCalendar class');
      } catch (e) {
        console.warn('[NativelyCalendar] Failed to create instance from class:', e);
      }
    }
    
    // 2. Try natively.calendar direct property
    if (!calendarInstance && natively?.calendar) {
      calendarInstance = natively.calendar;
      console.log('[NativelyCalendar] Using natively.calendar instance');
    }
    
    // 3. Try window.nativeCalendar direct property
    if (!calendarInstance && (window as any).nativeCalendar) {
      calendarInstance = (window as any).nativeCalendar;
      console.log('[NativelyCalendar] Using window.nativeCalendar instance');
    }
    
    // If we have an instance, verify it has the methods we need
    if (calendarInstance) {
      // Check required methods
      const methods = {
        retrieveCalendars: typeof calendarInstance.retrieveCalendars === 'function',
        createCalendarEvent: typeof calendarInstance.createCalendarEvent === 'function',
        retrieveEvents: typeof calendarInstance.retrieveEvents === 'function',
        getEvents: typeof calendarInstance.getEvents === 'function',
        readCalendarEvents: typeof calendarInstance.readCalendarEvents === 'function'
      };
      
      console.log('[NativelyCalendar] Available methods:', methods);
      
      // Need at least one way to create events and one way to retrieve them
      const hasCreateMethod = methods.createCalendarEvent;
      const hasRetrieveMethod = methods.retrieveEvents || methods.getEvents || methods.readCalendarEvents;
      
      if (hasCreateMethod && hasRetrieveMethod) {
        console.log('[NativelyCalendar] Found valid calendar instance with required methods');
        return calendarInstance;
      } else {
        console.warn('[NativelyCalendar] Instance missing required methods. Need both create and retrieve capabilities.');
      }
    }
    
    // If we get here, no valid calendar instance was found
    console.error('[NativelyCalendar] No valid calendar instance found. Available window properties:', 
      Object.keys(window)
        .filter(k => k.toLowerCase().includes('native') || k.toLowerCase().includes('calendar'))
        .join(', ')
    );
    
    return null;
  } catch (err) {
    console.error('[NativelyCalendar] Error getting calendar instance:', err);
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
        calendars = resp.data
          .filter((c: any) => c?.id)
          .map((c: any) => ({ id: String(c.id), name: c?.name ? String(c.name) : undefined }));
      } else if (resp?.data?.id) {
        calendars = [{ id: String(resp.data.id), name: resp.data?.name ? String(resp.data.name) : undefined }];
      } else if (typeof resp?.data === 'string' && resp.data.length > 0) {
        calendars = [{ id: resp.data }];
      } else if (resp?.data && typeof resp.data === 'object') {
        const ids = Object.keys(resp.data).filter((key) => key && key.length > 0);
        calendars = ids.map((id) => ({ id, name: typeof resp.data[id] === 'string' ? resp.data[id] : undefined }));
      } else if (resp?.id) {
        calendars = [{ id: String(resp.id) }];
      } else if (Array.isArray(resp)) {
        // Response itself might be the array
        calendars = resp
          .filter((c: any) => c?.id)
          .map((c: any) => ({ id: String(c.id), name: c?.name ? String(c.name) : undefined }));
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
    
    // Format dates based on platform
    const natively = (window as any).natively;
    const isIOS = natively?.isIOSApp === true;
    const isAndroid = natively?.isAndroidApp === true;
    
    let startDateStr: string | Date = startDate;
    let endDateStr: string | Date = endDate;
    
    if (isIOS) {
      // iOS expects ISO strings
      startDateStr = startDate.toISOString();
      endDateStr = endDate.toISOString();
    } else if (isAndroid) {
      // Android expects yyyy-MM-dd HH:mm:ss.SSS
      startDateStr = formatDateForNatively(startDate);
      endDateStr = formatDateForNatively(endDate);
    }
    
    console.log('[NativelyCalendar] Creating event:', {
      title,
      startDate: startDateStr,
      endDate: endDateStr,
      timezone: timezoneStr,
      calendarId: calendarIdStr,
      description: descriptionStr,
      platform: isIOS ? 'iOS' : isAndroid ? 'Android' : 'Unknown'
    });

    // First try the standard method signature
    if (typeof cal.createCalendarEvent === 'function') {
      cal.createCalendarEvent(
        title,
        startDateStr,
        endDateStr,
        timezoneStr,
        calendarIdStr,
        descriptionStr,
        (resp: any) => {
          console.log('[NativelyCalendar] Response:', resp);
          if (resp?.status === 'SUCCESS' || resp?.data?.id || resp?.eventId) {
            callback({
              status: 'SUCCESS',
              data: {
                id: resp?.data?.id || resp?.eventId || '',
                title: resp?.data?.title || title,
                start: resp?.data?.start || String(startDateStr),
                end: resp?.data?.end || String(endDateStr)
              }
            });
          } else {
            callback({
              status: 'FAILED',
              error: resp?.error || resp?.message || 'Failed to create event'
            });
          }
        }
      );
    }
    // Fallback to alternative method names
    else if (typeof cal.addEvent === 'function') {
      cal.addEvent({
        title,
        start: startDateStr,
        end: endDateStr,
        timezone: timezoneStr,
        calendarId: calendarIdStr,
        description: descriptionStr
      }, (resp: any) => {
        if (resp?.success || resp?.id) {
          callback({
            status: 'SUCCESS',
            data: {
              id: resp?.id || '',
              title,
              start: String(startDateStr),
              end: String(endDateStr)
            }
          });
        } else {
          callback({
            status: 'FAILED',
            error: resp?.error || 'Failed to add event'
          });
        }
      });
    } else {
      callback({
        status: 'FAILED',
        error: 'No compatible calendar event creation method found'
      });
    }
  } catch (err) {
    console.error('[NativelyCalendar] Error creating event:', err);
    callback({ status: 'FAILED', error: String(err) });
  }
}

/**
 * Format a Date object for Natively Calendar
 * Tries multiple formats in order of preference
 */
export function formatDateForNatively(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  
  // Try to detect if we're in iOS or Android context
  const natively = (window as any)?.natively;
  const isIOS = natively?.isIOSApp === true;
  const isAndroid = natively?.isAndroidApp === true;
  
  if (isIOS) {
    // iOS prefers ISO format
    return date.toISOString();
  } else if (isAndroid) {
    // Android prefers yyyy-MM-dd HH:mm:ss.SSS format
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.000`;
  } else {
    // Fallback - try both formats
    try {
      // First try ISO
      const isoStr = date.toISOString();
      if (isoStr) return isoStr;
    } catch {}
    
    // Fallback to yyyy-MM-dd HH:mm:ss.SSS
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.000`;
  }
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
