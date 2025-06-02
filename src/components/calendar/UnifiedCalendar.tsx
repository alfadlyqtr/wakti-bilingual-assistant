
import React, { useMemo, useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { CalendarGrid } from './CalendarGrid';
import { CalendarControls } from './CalendarControls';
import { CalendarViewSwitcher } from './CalendarViewSwitcher';
import { CalendarAgenda } from './CalendarAgenda';
import { useDashboardData } from '@/hooks/useDashboardData';
import { CalendarView } from '@/utils/calendarUtils';

interface UnifiedCalendarProps {
  defaultView?: CalendarView;
}

const UnifiedCalendar: React.FC<UnifiedCalendarProps> = ({ defaultView = 'month' }) => {
  const { language } = useTheme();
  const { tasks, events, reminders, isLoading } = useDashboardData();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>(defaultView);

  const allEvents = useMemo(() => {
    return [...tasks, ...events, ...reminders];
  }, [tasks, events, reminders]);

  const handlePrevious = () => {
    const newDate = new Date(currentDate);
    if (view === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (view === 'year') {
      newDate.setFullYear(newDate.getFullYear() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (view === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else if (view === 'year') {
      newDate.setFullYear(newDate.getFullYear() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="flex flex-col h-full">
      <CalendarControls 
        currentDate={currentDate}
        view={view}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToday={handleToday}
        language={language}
      />
      <CalendarViewSwitcher 
        view={view} 
        onViewChange={setView}
      />
      <div className="flex-1 relative overflow-hidden">
        <CalendarGrid />
        <CalendarAgenda />
      </div>
    </div>
  );
};

export default UnifiedCalendar;
