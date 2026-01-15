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
 * @param title Event title (required)
 * @param startDate ISO 8601 format e.g. "2025-07-10 14:00:00.000"
 * @param endDate ISO 8601 format e.g. "2025-07-10 15:00:00.000"
 * @param timezone ISO 8601 timezone e.g. "Asia/Riyadh"
 * @param calendarId Optional calendar ID (if not provided, uses default)
 * @param description Optional event description
 * @param callback Callback with result
 */
export function createCalendarEvent(
  title: string,
  startDate: string,
  endDate: string,
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

  try {
    console.log('[NativelyCalendar] Creating event:', { title, startDate, endDate, timezone, calendarId, description });
    // Note: Natively SDK signature is (title, endDate, startDate, timezone, calendarId, description, callback)
    // If calendarId is null/empty, pass null to let SDK use default calendar
    cal.createCalendarEvent(
      title,
      endDate,
      startDate,
      timezone,
      calendarId || null,
      description || null,
      (resp: any) => {
        console.log('[NativelyCalendar] createCalendarEvent response:', JSON.stringify(resp));
        if (resp?.status === 'SUCCESS' || resp?.data?.id) {
          callback({
            status: 'SUCCESS',
            data: {
              id: resp.data?.id || '',
              title: resp.data?.title || title,
              start: resp.data?.start || startDate,
              end: resp.data?.end || endDate
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
