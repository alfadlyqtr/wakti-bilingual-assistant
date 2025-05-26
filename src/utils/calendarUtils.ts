
import { Task, Reminder } from "@/contexts/TaskReminderContext";
import { Maw3dEvent } from "@/types/maw3d";

export enum EntryType {
  TASK = "task",
  EVENT = "event",
  REMINDER = "reminder",
  MANUAL_NOTE = "manual_note",
  MAW3D_EVENT = "maw3d_event"
}

export interface CalendarEntry {
  id: string;
  title: string;
  description?: string;
  date: string;
  type: EntryType;
  priority?: "urgent" | "high" | "medium" | "low";
  due?: string;
  time?: string;
  location?: string;
  isAllDay?: boolean;
}

export type CalendarView = "day" | "week" | "month" | "year";

// Convert tasks to calendar entries
const tasksToCalendarEntries = (tasks: Task[]): CalendarEntry[] => {
  return tasks.map(task => ({
    id: task.id,
    title: task.title,
    description: task.description,
    date: task.due_date || new Date().toISOString().split('T')[0],
    type: EntryType.TASK,
    priority: task.priority,
    due: task.due_date
  }));
};

// Convert reminders to calendar entries
const remindersToCalendarEntries = (reminders: Reminder[]): CalendarEntry[] => {
  return reminders.map(reminder => ({
    id: reminder.id,
    title: reminder.title,
    date: reminder.due_date || new Date().toISOString().split('T')[0],
    type: EntryType.REMINDER,
    due: reminder.due_date
  }));
};

// Convert Maw3d events to calendar entries
const maw3dEventsToCalendarEntries = (events: Maw3dEvent[]): CalendarEntry[] => {
  return events.map(event => ({
    id: event.id,
    title: event.title,
    description: event.description,
    date: event.event_date,
    type: EntryType.MAW3D_EVENT,
    time: event.is_all_day ? undefined : event.start_time,
    location: event.location,
    isAllDay: event.is_all_day
  }));
};

// Convert events to calendar entries (assuming events have a similar structure)
const eventsToCalendarEntries = (events: any[]): CalendarEntry[] => {
  return events.map(event => ({
    id: event.id,
    title: event.title,
    description: event.description,
    date: event.date || event.start_date || event.event_date || new Date().toISOString().split('T')[0],
    type: EntryType.EVENT,
    time: event.time || event.start_time,
    location: event.location,
    isAllDay: event.is_all_day
  }));
};

// Combine all entries
export const getCalendarEntries = (
  tasks: Task[], 
  reminders: Reminder[], 
  manualEntries: CalendarEntry[] = [],
  events: any[] = [],
  maw3dEvents: Maw3dEvent[] = []
): CalendarEntry[] => {
  console.log('getCalendarEntries called with:', {
    tasks: tasks.length,
    reminders: reminders.length,
    manualEntries: manualEntries.length,
    events: events.length,
    maw3dEvents: maw3dEvents.length
  });

  // Log manual entries being processed
  console.log('Manual entries being processed:', manualEntries);

  const taskEntries = tasksToCalendarEntries(tasks);
  const reminderEntries = remindersToCalendarEntries(reminders);
  const eventEntries = eventsToCalendarEntries(events);
  const maw3dEntries = maw3dEventsToCalendarEntries(maw3dEvents);

  console.log('Converted entries:', {
    taskEntries: taskEntries.length,
    reminderEntries: reminderEntries.length,
    eventEntries: eventEntries.length,
    maw3dEntries: maw3dEntries.length,
    manualEntries: manualEntries.length
  });

  const allEntries = [
    ...taskEntries,
    ...reminderEntries,
    ...eventEntries,
    ...maw3dEntries,
    ...manualEntries // Make sure manual entries are included
  ];

  console.log('Total combined entries:', allEntries.length);
  
  // Log a sample of entries including manual ones
  const manualSample = allEntries.filter(e => e.type === EntryType.MANUAL_NOTE);
  console.log('Manual entries in final result:', manualSample);

  return allEntries;
};
