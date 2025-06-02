
import { addDays, startOfWeek, endOfWeek, format, isSameDay, parseISO } from 'date-fns';

export interface CalendarEntry {
  id: string;
  title: string;
  date: string;
  time?: string;
  type: EntryType;
  description?: string;
  location?: string;
}

export type EntryType = 'event' | 'appointment';

export const getCalendarEntries = async (): Promise<CalendarEntry[]> => {
  // Return empty array since we removed tasks and reminders
  // Only events from Maw3d system will be shown
  return [];
};

export const formatCalendarDate = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

export const getWeekRange = (date: Date) => {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return { start, end };
};

export const generateWeekDays = (weekStart: Date) => {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
};
