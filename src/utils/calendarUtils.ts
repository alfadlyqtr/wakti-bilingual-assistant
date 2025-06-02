
export type CalendarView = 'month' | 'week' | 'year';

export const getCalendarViewTitle = (view: CalendarView, date: Date): string => {
  const options: Intl.DateTimeFormatOptions = 
    view === 'year' ? { year: 'numeric' } :
    view === 'month' ? { month: 'long', year: 'numeric' } :
    { day: 'numeric', month: 'long', year: 'numeric' };
  
  return date.toLocaleDateString('en-US', options);
};

export const isToday = (date: Date): boolean => {
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

export const isSameMonth = (date1: Date, date2: Date): boolean => {
  return date1.getMonth() === date2.getMonth() && 
         date1.getFullYear() === date2.getFullYear();
};
