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
    console.log('[NativelyCalendar] Calling retrieveCalendars...');
    cal.retrieveCalendars((resp: any) => {
      console.log('[NativelyCalendar] ===== RETRIEVE CALENDARS DEBUG =====');
      console.log('[NativelyCalendar] Raw resp:', resp);
      console.log('[NativelyCalendar] resp type:', typeof resp);
      console.log('[NativelyCalendar] resp.status:', resp?.status);
      console.log('[NativelyCalendar] resp.data:', resp?.data);
      console.log('[NativelyCalendar] resp.error:', resp?.error);
      if (resp?.data && typeof resp.data === 'object') {
        console.log('[NativelyCalendar] resp.data.id:', resp.data?.id);
        console.log('[NativelyCalendar] Is resp.data array?:', Array.isArray(resp.data));
      }
      console.log('[NativelyCalendar] ====================================');
      
      // Handle both array format and single object format
      // Docs show resp.data.id (singular), so it might be a single object not an array
      if (resp?.status === 'SUCCESS') {
        let calendars: CalendarObject[] = [];
        if (Array.isArray(resp.data)) {
          calendars = resp.data;
        } else if (resp.data?.id) {
          // Single calendar object
          calendars = [{ id: resp.data.id }];
        }
        callback({
          status: 'SUCCESS',
          data: calendars
        });
      } else if (resp?.data?.id) {
        // Sometimes status might not be set but data exists
        callback({
          status: 'SUCCESS',
          data: [{ id: resp.data.id }]
        });
      } else {
        callback({
          status: 'FAILED',
          error: resp?.error || resp?.message || 'Failed to retrieve calendars'
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
    // SDK expects ALL STRING parameters - no nulls allowed per docs
    // Format: "2025-07-10 14:00:00.000" for dates
    const startDateStr = formatDateForNatively(startDate);
    const endDateStr = formatDateForNatively(endDate);
    const timezoneStr = timezone?.trim() || 'UTC';
    // calendarId MUST be a string - use empty string if not provided (SDK requires it)
    const calendarIdStr = calendarId?.trim() || '';
    const descriptionStr = description?.trim() || '';

    console.log('[NativelyCalendar] ===== CREATE EVENT DEBUG =====');
    console.log('[NativelyCalendar] title:', title, '| type:', typeof title);
    console.log('[NativelyCalendar] endDate:', endDateStr, '| type:', typeof endDateStr);
    console.log('[NativelyCalendar] startDate:', startDateStr, '| type:', typeof startDateStr);
    console.log('[NativelyCalendar] timezone:', timezoneStr, '| type:', typeof timezoneStr);
    console.log('[NativelyCalendar] calendarId:', calendarIdStr, '| type:', typeof calendarIdStr, '| length:', calendarIdStr.length);
    console.log('[NativelyCalendar] description:', descriptionStr, '| type:', typeof descriptionStr);
    console.log('[NativelyCalendar] ==============================');

    // SDK signature from docs: createCalendarEvent(title, endDate, startDate, timezone, calendarId, description, callback)
    // ALL params must be strings - no null/undefined
    cal.createCalendarEvent(
      title,
      endDateStr,
      startDateStr,
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
