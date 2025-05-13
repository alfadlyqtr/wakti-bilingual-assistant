
import { Task, Reminder } from "@/contexts/TaskReminderContext";

export enum EntryType {
  TASK = "task",
  EVENT = "event",
  REMINDER = "reminder",
  MANUAL_NOTE = "manual_note"
}

export interface CalendarEntry {
  id: string;
  title: string;
  description?: string;
  date: string;
  type: EntryType;
  priority?: "urgent" | "high" | "medium" | "low";
  due?: string;
}

export type CalendarView = "day" | "week" | "month" | "year";

// Convert tasks to calendar entries
const tasksToCalendarEntries = (tasks: Task[]): CalendarEntry[] => {
  return tasks.map(task => ({
    id: task.id,
    title: task.title,
    description: task.description,
    date: task.due_date,
    type: EntryType.TASK,
    priority: task.priority,
    due: task.due_time
  }));
};

// Convert reminders to calendar entries
const remindersToCalendarEntries = (reminders: Reminder[]): CalendarEntry[] => {
  return reminders.map(reminder => ({
    id: reminder.id,
    title: reminder.title,
    date: reminder.date,
    type: EntryType.REMINDER,
    due: reminder.time
  }));
};

// Convert events to calendar entries (assuming events have a similar structure)
const eventsToCalendarEntries = (events: any[]): CalendarEntry[] => {
  return events.map(event => ({
    id: event.id,
    title: event.title,
    description: event.description,
    date: event.date || event.start_date,
    type: EntryType.EVENT,
    due: event.time || event.start_time
  }));
};

// Combine all entries
export const getCalendarEntries = (
  tasks: Task[], 
  reminders: Reminder[], 
  manualEntries: CalendarEntry[] = [],
  events: any[] = []
): CalendarEntry[] => {
  return [
    ...tasksToCalendarEntries(tasks),
    ...remindersToCalendarEntries(reminders),
    ...eventsToCalendarEntries(events),
    ...manualEntries
  ];
};
