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
    const Ctor = (window as any).NativelyCalendar;
    if (!Ctor) {
      console.log('[NativelyCalendar] NativelyCalendar class not found on window - not in Natively app');
      return null;
    }
    console.log('[NativelyCalendar] SDK found, creating instance');
    return new Ctor();
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
    cal.retrieveCalendars((resp: any) => {
      console.log('[NativelyCalendar] retrieveCalendars response:', JSON.stringify(resp));
      if (resp?.status === 'SUCCESS' || resp?.data) {
        callback({
          status: 'SUCCESS',
          data: resp.data || []
        });
      } else {
        callback({
          status: 'FAILED',
          error: resp?.error || 'Failed to retrieve calendars'
        });
      }
    });
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
 * @param startDate Date object for event start
 * @param endDate Date object for event end
 * @param timezone ISO 8601 timezone e.g. "Asia/Riyadh"
 * @param calendarId Calendar ID string (use empty string if not available)
 * @param description Event description (use empty string if none)
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
    // SDK expects strings for optional params - use empty string instead of null
    const calIdStr = calendarId || '';
    const descStr = description || '';
    
    // Try passing Date objects directly - SDK might convert them internally
    // The error "i.toISOString is not a function" suggests SDK expects Date objects
    console.log('[NativelyCalendar] Creating event with Date objects:', { 
      title, 
      endDate: endDate.toISOString(), 
      startDate: startDate.toISOString(), 
      timezone, 
      calendarId: calIdStr, 
      description: descStr 
    });
    
    // SDK signature: createCalendarEvent(title, endDate, startDate, timezone, calendarId, description, callback)
    // Passing Date objects directly since SDK seems to call .toISOString() internally
    cal.createCalendarEvent(
      title,
      endDate,
      startDate,
      timezone,
      calIdStr,
      descStr,
      (resp: any) => {
        console.log('[NativelyCalendar] createCalendarEvent response:', JSON.stringify(resp));
        if (resp?.status === 'SUCCESS' || resp?.data?.id) {
          callback({
            status: 'SUCCESS',
            data: {
              id: resp.data?.id || '',
              title: resp.data?.title || title,
              start: resp.data?.start || startDate.toISOString(),
              end: resp.data?.end || endDate.toISOString()
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
