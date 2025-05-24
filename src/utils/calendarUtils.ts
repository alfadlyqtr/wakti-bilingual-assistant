
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  hasItems: boolean;
}

export interface CalendarItem {
  id: string;
  title: string;
  date: Date;
  type: 'task' | 'reminder';
  completed?: boolean;
}

export interface CalendarEntry {
  id: string;
  title: string;
  description?: string;
  date: string;
  type: EntryType;
  due?: string;
  priority?: 'urgent' | 'high' | 'medium' | 'low';
}

export type CalendarView = 'month' | 'week' | 'year' | 'agenda';

export enum EntryType {
  TASK = 'task',
  EVENT = 'event',
  REMINDER = 'reminder',
  MANUAL_NOTE = 'manual_note'
}

export const generateCalendarDays = (currentDate: Date): CalendarDay[] => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const today = new Date();

  return days.map(date => ({
    date,
    isCurrentMonth: isSameMonth(date, currentDate),
    isToday: isSameDay(date, today),
    hasItems: false, // Will be updated based on actual items
  }));
};

export const getItemsForDate = (items: CalendarItem[], date: Date): CalendarItem[] => {
  return items.filter(item => isSameDay(item.date, date));
};

export const updateCalendarDaysWithItems = (
  calendarDays: CalendarDay[], 
  items: CalendarItem[]
): CalendarDay[] => {
  return calendarDays.map(day => ({
    ...day,
    hasItems: getItemsForDate(items, day.date).length > 0
  }));
};

export const formatCalendarDate = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

export const navigateMonth = (currentDate: Date, direction: 'prev' | 'next'): Date => {
  return direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1);
};
