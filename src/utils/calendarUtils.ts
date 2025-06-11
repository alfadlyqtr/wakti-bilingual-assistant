
import { addDays, startOfWeek, endOfWeek, format, isSameDay, parseISO } from 'date-fns';
import { Maw3dEvent } from '@/types/maw3d';
import { TRTask, TRReminder } from '@/services/trService';

export enum EntryType {
  EVENT = 'event',
  APPOINTMENT = 'appointment',
  MANUAL_NOTE = 'manual_note',
  MAW3D_EVENT = 'maw3d_event',
  TASK = 'task',
  REMINDER = 'reminder'
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
  completed?: boolean;
  priority?: 'normal' | 'high' | 'urgent';
}

export const getCalendarEntries = async (
  manualEntries: CalendarEntry[] = [],
  legacyEvents: any[] = [],
  maw3dEvents: Maw3dEvent[] = [],
  tasks: TRTask[] = [],
  reminders: TRReminder[] = []
): Promise<CalendarEntry[]> => {
  console.log('Getting calendar entries:', {
    manualEntries: manualEntries.length,
    legacyEvents: legacyEvents.length,
    maw3dEvents: maw3dEvents.length,
    tasks: tasks.length,
    reminders: reminders.length
  });

  const entries: CalendarEntry[] = [];

  // Add manual entries
  entries.push(...manualEntries);

  // Add Maw3d events
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
