
import { addDays, startOfWeek, endOfWeek, format, isSameDay, parseISO } from 'date-fns';
import { Maw3dEvent } from '@/types/maw3d';
import { TRTask, TRReminder } from '@/services/trService';

export enum EntryType {
  EVENT = 'event',
  APPOINTMENT = 'appointment',
  MANUAL_NOTE = 'manual_note',
  MAW3D_EVENT = 'maw3d_event',
  TASK = 'task',
  REMINDER = 'reminder',
  JOURNAL = 'journal',
  PROJECT_BOOKING = 'project_booking',
  PHONE_CALENDAR = 'phone_calendar'
}

export type CalendarView = 'month' | 'week' | 'year';

export interface ProjectCalendarEntry {
  id: string;
  project_id: string;
  owner_id: string;
  source_type: string;
  source_id: string | null;
  title: string;
  description: string | null;
  entry_date: string;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  color: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CalendarEntry {
  id: string;
  title: string;
  date: string;
  time?: string;
  type: EntryType;
  description?: string;
  location?: string;
  isAllDay?: boolean;
  completed?: boolean;
  priority?: 'normal' | 'high' | 'urgent';
  color?: string;
}

export const getCalendarEntries = async (
  manualEntries: CalendarEntry[] = [],
  legacyEvents: any[] = [],
  maw3dEvents: Maw3dEvent[] = [],
  tasks: TRTask[] = [],
  reminders: TRReminder[] = [],
  journalOverlay: { date: string; mood_value: number | null }[] = [],
  projectCalendarEntries: ProjectCalendarEntry[] = [],
  phoneCalendarEvents: { id?: string; title: string; startDate: string; endDate: string }[] = []
): Promise<CalendarEntry[]> => {
  console.log('Getting calendar entries:', {
    manualEntries: manualEntries.length,
    legacyEvents: legacyEvents.length,
    maw3dEvents: maw3dEvents.length,
    tasks: tasks.length,
    reminders: reminders.length,
    journalDays: journalOverlay.length,
    projectCalendarEntries: projectCalendarEntries.length,
    phoneCalendarEvents: phoneCalendarEvents.length
  });

  const entries: CalendarEntry[] = [];

  // Add manual entries
  entries.push(...manualEntries);

  // Add Maw3d events (completely separate from project bookings)
  const maw3dEntries: CalendarEntry[] = maw3dEvents.map(event => ({
    id: `maw3d-${event.id}`,
    title: event.title,
    date: event.event_date,
    time: undefined,
    type: EntryType.MAW3D_EVENT,
    description: event.description || undefined,
    location: event.location || undefined,
    isAllDay: true
  }));

  entries.push(...maw3dEntries);

  // Add tasks with due dates
  const taskEntries: CalendarEntry[] = tasks
    .filter(task => task.due_date)
    .map(task => ({
      id: `task-${task.id}`,
      title: task.title,
      date: task.due_date,
      time: task.due_time || undefined,
      type: EntryType.TASK,
      description: task.description || undefined,
      completed: task.completed,
      priority: task.priority,
      isAllDay: !task.due_time
    }));

  entries.push(...taskEntries);

  // Add reminders with due dates
  const reminderEntries: CalendarEntry[] = reminders
    .filter(reminder => reminder.due_date)
    .map(reminder => ({
      id: `reminder-${reminder.id}`,
      title: reminder.title,
      date: reminder.due_date,
      time: reminder.due_time || undefined,
      type: EntryType.REMINDER,
      description: reminder.description || undefined,
      isAllDay: !reminder.due_time
    }));

  entries.push(...reminderEntries);

  // Add journal overlay entries (one per day)
  if (journalOverlay && journalOverlay.length > 0) {
    const journalEntries: CalendarEntry[] = journalOverlay.map((row, idx) => ({
      id: `journal-${row.date}-${idx}`,
      title: 'Journal',
      date: row.date,
      type: EntryType.JOURNAL,
      isAllDay: true
    }));
    entries.push(...journalEntries);
  }

  // Add project calendar entries (bookings from user's projects)
  if (projectCalendarEntries && projectCalendarEntries.length > 0) {
    const projectEntries: CalendarEntry[] = projectCalendarEntries.map(entry => ({
      id: `project-${entry.id}`,
      title: entry.title,
      date: entry.entry_date,
      time: entry.start_time || undefined,
      type: EntryType.PROJECT_BOOKING,
      description: entry.description || undefined,
      isAllDay: entry.is_all_day,
      color: entry.color
    }));
    entries.push(...projectEntries);
  }

  // Add phone calendar events (read-only)
  if (phoneCalendarEvents && phoneCalendarEvents.length > 0) {
    const phoneEntries: CalendarEntry[] = phoneCalendarEvents
      .filter(event => event.startDate)
      .map(event => {
        // Parse date properly - handle various formats from phone calendars
        let dateStr = event.startDate;
        // Try to extract just the date part if it's an ISO string
        if (dateStr.includes('T')) {
          dateStr = dateStr.split('T')[0];
        }
        // If format is like "2025-07-10 14:00:00.000" extract date part
        if (dateStr.includes(' ')) {
          dateStr = dateStr.split(' ')[0];
        }
        
        // Handle time extraction
        let timeStr: string | undefined = undefined;
        if (event.startDate.includes('T')) {
          const timePart = event.startDate.split('T')[1];
          if (timePart && timePart.includes(':')) {
            // Extract HH:MM format
            timeStr = timePart.substring(0, 5);
          }
        } else if (event.startDate.includes(' ')) {
          const timePart = event.startDate.split(' ')[1];
          if (timePart && timePart.includes(':')) {
            // Extract HH:MM format
            timeStr = timePart.substring(0, 5);
          }
        }
        
        console.log('Phone calendar event parsed:', {
          original: event.startDate,
          parsed: { date: dateStr, time: timeStr },
          title: event.title
        });
        
        return {
          id: `phone-${event.id || event.startDate}`,
          title: event.title,
          date: dateStr,
          time: timeStr,
          type: EntryType.PHONE_CALENDAR,
          isAllDay: !timeStr
        };
      });
      
    // Log the parsed phone entries
    console.log(`Parsed ${phoneEntries.length} phone calendar events:`, 
      phoneEntries.map(e => ({ title: e.title, date: e.date, time: e.time })));
      
    entries.push(...phoneEntries);
  }

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
