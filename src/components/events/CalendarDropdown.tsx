
import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar, Download, ExternalLink } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

interface Event {
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
}

interface CalendarDropdownProps {
  event: Event;
}

export default function CalendarDropdown({ event }: CalendarDropdownProps) {
  const { language } = useTheme();

  const formatDateForCalendar = (date: string) => {
    return new Date(date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const createGoogleCalendarUrl = () => {
    const startDate = formatDateForCalendar(event.start_time);
    const endDate = formatDateForCalendar(event.end_time);
    
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title,
      dates: `${startDate}/${endDate}`,
      details: event.description || '',
      location: event.location || '',
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const createOutlookUrl = () => {
    const startDate = new Date(event.start_time).toISOString();
    const endDate = new Date(event.end_time).toISOString();
    
    const params = new URLSearchParams({
      subject: event.title,
      startdt: startDate,
      enddt: endDate,
      body: event.description || '',
      location: event.location || '',
    });

    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
  };

  const downloadICSFile = () => {
    const startDate = new Date(event.start_time);
    const endDate = new Date(event.end_time);
    
    const formatICSDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const escapeText = (text: string) => {
      return text.replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
    };

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//WAKTI//Event Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${Date.now()}@wakti.app`,
      `DTSTART:${formatICSDate(startDate)}`,
      `DTEND:${formatICSDate(endDate)}`,
      `SUMMARY:${escapeText(event.title)}`,
      event.description ? `DESCRIPTION:${escapeText(event.description)}` : '',
      event.location ? `LOCATION:${escapeText(event.location)}` : '',
      `CREATED:${formatICSDate(new Date())}`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      'END:VEVENT',
      'END:VCALENDAR'
    ].filter(line => line !== '').join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          {t("addToCalendar", language)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem 
          onClick={() => window.open(createGoogleCalendarUrl(), '_blank')}
          className="flex items-center gap-2"
        >
          <ExternalLink className="h-4 w-4" />
          {t("googleCalendar", language)}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => window.open(createOutlookUrl(), '_blank')}
          className="flex items-center gap-2"
        >
          <ExternalLink className="h-4 w-4" />
          {t("outlookCalendar", language)}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={downloadICSFile}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Apple Calendar (.ics)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
