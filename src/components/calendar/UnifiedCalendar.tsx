
import React, { useMemo } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { CalendarGrid } from './CalendarGrid';
import { CalendarControls } from './CalendarControls';
import { CalendarViewSwitcher } from './CalendarViewSwitcher';
import { CalendarAgenda } from './CalendarAgenda';
import { useDashboardData } from '@/hooks/useDashboardData';

interface UnifiedCalendarProps {
  defaultView?: 'month' | 'week' | 'year';
}

const UnifiedCalendar: React.FC<UnifiedCalendarProps> = ({ defaultView = 'month' }) => {
  const { language } = useTheme();
  const { tasks, events, reminders, isLoading } = useDashboardData();

  const allEvents = useMemo(() => {
    return [...tasks, ...events, ...reminders];
  }, [tasks, events, reminders]);

  return (
    <div className="flex flex-col h-full">
      <CalendarControls />
      <CalendarViewSwitcher defaultView={defaultView} />
      <div className="flex-1 relative overflow-hidden">
        <CalendarGrid events={allEvents} isLoading={isLoading} />
        <CalendarAgenda events={allEvents} isLoading={isLoading} />
      </div>
    </div>
  );
};

export default UnifiedCalendar;
