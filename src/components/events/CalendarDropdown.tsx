
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar, Download, ExternalLink, Plus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { t } from '@/utils/translations';
import { useAuth } from '@/contexts/AuthContext';
import { UserEventLinksService } from '@/services/userEventLinksService';

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
  eventId?: string;
  language?: string;
}

export default function CalendarDropdown({ event, eventId, language = 'en' }: CalendarDropdownProps) {
  const { user } = useAuth();
  const [isInCalendar, setIsInCalendar] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log('CalendarDropdown Debug Info:', {
      hasUser: !!user,
      userEmail: user?.email,
      eventId: eventId,
      eventTitle: event.title,
      shouldShowWaktiOption: !!(user && eventId)
    });
  }, [user, eventId, event.title]);

  useEffect(() => {
    if (user && eventId) {
      console.log('Checking if event is in calendar for eventId:', eventId);
      checkIfEventInCalendar();
    } else {
      console.log('Skipping calendar check - user or eventId missing:', { user: !!user, eventId });
    }
  }, [user, eventId]);

  const checkIfEventInCalendar = async () => {
    if (!eventId) {
      console.log('No eventId provided for calendar check');
      return;
    }
    
    try {
      console.log('Calling UserEventLinksService.isEventInUserCalendar with eventId:', eventId);
      const inCalendar = await UserEventLinksService.isEventInUserCalendar(eventId);
      console.log('Event in calendar result:', inCalendar);
      setIsInCalendar(inCalendar);
    } catch (error) {
      console.error('Error checking event status:', error);
    }
  };

  const handleAddToWaktiCalendar = async () => {
    console.log('handleAddToWaktiCalendar called');
    
    if (!user) {
      console.log('No user found when trying to add to calendar');
      toast.error('Please log in to add events to your WAKTI calendar');
      return;
    }

    if (!eventId) {
      console.log('No eventId found when trying to add to calendar');
      toast.error('Event ID is required');
      return;
    }

    setIsLoading(true);
    try {
      if (isInCalendar) {
        console.log('Removing event from calendar:', eventId);
        await UserEventLinksService.removeEventFromCalendar(eventId);
        setIsInCalendar(false);
        toast.success('Event removed from your WAKTI calendar');
      } else {
        console.log('Adding event to calendar:', eventId);
        await UserEventLinksService.addEventToCalendar(eventId);
        setIsInCalendar(true);
        toast.success('Event added to your WAKTI calendar');
      }
    } catch (error) {
      console.error('Error updating calendar:', error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to update calendar');
      }
    } finally {
      setIsLoading(false);
    }
  };

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

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//WAKTI//EN',
      'BEGIN:VEVENT',
      `UID:${Date.now()}@wakti.app`,
      `DTSTART:${formatICSDate(startDate)}`,
      `DTEND:${formatICSDate(endDate)}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.description || ''}`,
      `LOCATION:${event.location || ''}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  };

  console.log('Rendering CalendarDropdown with conditions:', {
    hasUser: !!user,
    hasEventId: !!eventId,
    shouldShowWaktiOption: !!(user && eventId),
    isInCalendar,
    isLoading
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          {t("addToCalendar", language)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* WAKTI Calendar option - only show if user is logged in and eventId is provided */}
        {user && eventId && (
          <DropdownMenuItem 
            onClick={handleAddToWaktiCalendar}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isInCalendar ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {isInCalendar ? 'Remove from WAKTI Calendar' : 'Add to WAKTI Calendar'}
          </DropdownMenuItem>
        )}
        
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
          {t("appleCalendar", language)}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
