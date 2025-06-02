
import { addDays, startOfWeek, endOfWeek, format, isSameDay, parseISO } from 'date-fns';
import { Maw3dEvent } from '@/types/maw3d';

export enum EntryType {
  EVENT = 'event',
  APPOINTMENT = 'appointment',
  MANUAL_NOTE = 'manual_note',
  MAW3D_EVENT = 'maw3d_event'
}

export type CalendarView = 'month' | 'week' | 'year';

export interface CalendarEntry {
  id: string;
  title: string;
  date: string;
  time?: string;
  type: EntryType;
  description?: string;
  location?: string;
  isAllDay?: boolean;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

export const getCalendarEntries = async (
  manualEntries: CalendarEntry[] = [],
  legacyEvents: any[] = [],
  maw3dEvents: Maw3dEvent[] = []
): Promise<CalendarEntry[]> => {
  console.log('Getting calendar entries:', {
    manualEntries: manualEntries.length,
    legacyEvents: legacyEvents.length,
    maw3dEvents: maw3dEvents.length
  });

  const entries: CalendarEntry[] = [];

  // Add manual entries
  entries.push(...manualEntries);

  // Add Maw3d events
  const maw3dEntries: CalendarEntry[] = maw3dEvents.map(event => ({
    id: `maw3d-${event.id}`,
    title: event.title,
    date: event.event_date,
    time: event.event_time || undefined,
    type: EntryType.MAW3D_EVENT,
    description: event.description || undefined,
    location: event.location || undefined,
    isAllDay: !event.event_time
  }));

  entries.push(...maw3dEntries);

  console.log('Total calendar entries:', entries.length);
  return entries;
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
