
// Utility functions for handling timezone conversions between UTC (database) and local time (form inputs)

/**
 * Converts a UTC datetime string from the database to a local datetime string for datetime-local inputs
 * @param utcDateString - UTC datetime string from database (e.g., "2024-01-15T10:00:00Z")
 * @returns Local datetime string for input (e.g., "2024-01-15T15:00" if local is UTC+5)
 */
export function utcToLocalDateTime(utcDateString: string): string {
  if (!utcDateString) return '';
  
  const utcDate = new Date(utcDateString);
  
  // Get the local timezone offset in minutes
  const timezoneOffset = utcDate.getTimezoneOffset();
  
  // Create a new date that represents the local time
  const localDate = new Date(utcDate.getTime() - (timezoneOffset * 60 * 1000));
  
  // Return in the format required by datetime-local input (YYYY-MM-DDTHH:mm)
  return localDate.toISOString().slice(0, 16);
}

/**
 * Converts a local datetime string from datetime-local input to UTC for database storage
 * @param localDateString - Local datetime string from input (e.g., "2024-01-15T15:00")
 * @returns UTC datetime string for database (e.g., "2024-01-15T10:00:00.000Z" if local is UTC+5)
 */
export function localToUtcDateTime(localDateString: string): string {
  if (!localDateString) return '';
  
  // Create a date object treating the input as local time
  const localDate = new Date(localDateString);
  
  // Return as UTC ISO string
  return localDate.toISOString();
}

/**
 * Gets the current date and time in local timezone formatted for datetime-local input
 * @returns Current local datetime string (e.g., "2024-01-15T15:30")
 */
export function getCurrentLocalDateTime(): string {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - (timezoneOffset * 60 * 1000));
  return localDate.toISOString().slice(0, 16);
}

/**
 * Creates start and end times for all-day events in local timezone
 * @returns Object with start and end times for all-day events
 */
export function getAllDayLocalTimes(): { start: string; end: string } {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59);
  
  const timezoneOffset = now.getTimezoneOffset();
  const startLocal = new Date(startOfDay.getTime() - (timezoneOffset * 60 * 1000));
  const endLocal = new Date(endOfDay.getTime() - (timezoneOffset * 60 * 1000));
  
  return {
    start: startLocal.toISOString().slice(0, 16),
    end: endLocal.toISOString().slice(0, 16)
  };
}
