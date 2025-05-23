
import { format } from "date-fns";

export interface CalendarEvent {
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
}

// Generate ICS file content for Apple Calendar, Outlook, etc.
export const generateICSFile = (event: CalendarEvent): string => {
  const formatDate = (date: Date): string => {
    return format(date, "yyyyMMdd'T'HHmmss'Z'");
  };

  const escapeText = (text: string): string => {
    return text.replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  };

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WAKTI//Event Calendar//EN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@wakti.app`,
    `DTSTART:${formatDate(event.startTime)}`,
    `DTEND:${formatDate(event.endTime)}`,
    `SUMMARY:${escapeText(event.title)}`,
    event.description ? `DESCRIPTION:${escapeText(event.description)}` : '',
    event.location ? `LOCATION:${escapeText(event.location)}` : '',
    `CREATED:${formatDate(new Date())}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(line => line !== '').join('\r\n');

  return icsContent;
};

// Download ICS file
export const downloadICSFile = (event: CalendarEvent, filename: string = 'event.ics'): void => {
  const icsContent = generateICSFile(event);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

// Generate Google Calendar URL
export const generateGoogleCalendarUrl = (event: CalendarEvent): string => {
  const formatGoogleDate = (date: Date): string => {
    return format(date, "yyyyMMdd'T'HHmmss'Z'");
  };

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatGoogleDate(event.startTime)}/${formatGoogleDate(event.endTime)}`,
    details: event.description || '',
    location: event.location || ''
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

// Generate Outlook Calendar URL
export const generateOutlookCalendarUrl = (event: CalendarEvent): string => {
  const formatOutlookDate = (date: Date): string => {
    return date.toISOString();
  };

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: formatOutlookDate(event.startTime),
    enddt: formatOutlookDate(event.endTime),
    body: event.description || '',
    location: event.location || ''
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
};
