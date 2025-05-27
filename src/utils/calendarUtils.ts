
import { UserEventLinksService } from '@/services/userEventLinksService';

export interface CalendarEntry {
  id: string;
  title: string;
  time?: string;
  type: 'task' | 'event' | 'manual_note' | 'maw3d_event' | 'reminder' | 'linked_event';
  date: string;
  priority?: 'low' | 'medium' | 'high';
  status?: 'open' | 'in progress' | 'done' | 'canceled';
  location?: string;
  description?: string;
  isAllDay?: boolean;
}

export enum EntryType {
  TASK = 'task',
  EVENT = 'event',
  MANUAL_NOTE = 'manual_note',
  MAW3D_EVENT = 'maw3d_event',
  REMINDER = 'reminder',
  LINKED_EVENT = 'linked_event'
}

export type CalendarView = 'month' | 'week' | 'year';

export const sortCalendarEntries = (entries: CalendarEntry[]): CalendarEntry[] => {
  return entries.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    if (a.time && b.time) {
      return a.time.localeCompare(b.time);
    }
    return 0;
  });
};

export const getCalendarEntries = async (
  tasks: any[] = [],
  reminders: any[] = [],
  manualEntries: CalendarEntry[] = [],
  legacyEvents: any[] = [],
  maw3dEvents: any[] = []
): Promise<CalendarEntry[]> => {
  const entries: CalendarEntry[] = [];

  // Add tasks
  tasks.forEach(task => {
    if (task.due_date) {
      const date = new Date(task.due_date).toISOString().split('T')[0];
      entries.push({
        id: task.id,
        title: task.title,
        time: task.due_date.includes('T') ? new Date(task.due_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
        type: 'task',
        date,
        priority: task.priority,
        status: task.status,
        description: task.description,
        isAllDay: false
      });
    }
  });

  // Add reminders
  reminders.forEach(reminder => {
    if (reminder.due_date) {
      const date = new Date(reminder.due_date).toISOString().split('T')[0];
      entries.push({
        id: reminder.id,
        title: reminder.title,
        time: reminder.due_date.includes('T') ? new Date(reminder.due_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
        type: 'reminder',
        date,
        priority: reminder.priority,
        description: reminder.description,
        isAllDay: false
      });
    }
  });

  // Add manual entries
  manualEntries.forEach(entry => {
    entries.push(entry);
  });

  // Add legacy events
  legacyEvents.forEach(event => {
    const date = new Date(event.start_time).toISOString().split('T')[0];
    entries.push({
      id: event.id,
      title: event.title,
      time: event.is_all_day ? 'All day' : new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'event',
      date,
      location: event.location,
      description: event.description,
      isAllDay: event.is_all_day
    });
  });

  // Add Maw3d events
  maw3dEvents.forEach(event => {
    const time = event.is_all_day 
      ? 'All day' 
      : event.start_time 
        ? `${event.start_time.slice(0, 5)}` 
        : undefined;
    
    entries.push({
      id: event.id,
      title: event.title,
      time,
      type: 'maw3d_event',
      date: event.event_date,
      location: event.location,
      description: event.description,
      isAllDay: event.is_all_day
    });
  });

  // Add linked events from other users
  try {
    const linkedEvents = await UserEventLinksService.getUserLinkedEvents();
    linkedEvents.forEach(link => {
      if (link.maw3d_events) {
        const event = link.maw3d_events;
        const time = event.is_all_day 
          ? 'All day' 
          : event.start_time 
            ? `${event.start_time.slice(0, 5)}` 
            : undefined;
        
        entries.push({
          id: `linked_${event.id}`,
          title: `📅 ${event.title}`, // Add icon to distinguish linked events
          time,
          type: 'linked_event',
          date: event.event_date,
          location: event.location,
          description: event.description,
          isAllDay: event.is_all_day
        });
      }
    });
  } catch (error) {
    console.error('Error fetching linked events:', error);
  }

  return entries.sort((a, b) => {
    // Sort by date first, then by time
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    if (a.time && b.time && a.time !== 'All day' && b.time !== 'All day') {
      return a.time.localeCompare(b.time);
    }
    return 0;
  });
};
