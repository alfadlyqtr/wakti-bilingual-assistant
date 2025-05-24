
import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarViewSwitcher } from './CalendarViewSwitcher';
import { CalendarEntryDialog } from './CalendarEntryDialog';
import { CalendarAgenda } from './CalendarAgenda';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

type ViewMode = 'month' | 'agenda';

interface CalendarEntry {
  id: string;
  title: string;
  date: Date;
  type: 'task' | 'reminder';
  time?: string;
  completed?: boolean;
  priority?: 'low' | 'medium' | 'high';
  recurring?: boolean;
}

export default function UnifiedCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEntryDialog, setShowEntryDialog] = useState(false);
  const queryClient = useQueryClient();
  const { language } = useTheme();

  // Fetch tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('due_date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch reminders
  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .order('due_date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    }
  });

  // Convert data to calendar entries
  const calendarEntries = useMemo(() => {
    const entries: CalendarEntry[] = [];

    // Add tasks
    tasks.forEach(task => {
      if (task.due_date) {
        entries.push({
          id: task.id,
          title: task.title,
          date: new Date(task.due_date),
          type: 'task',
          completed: task.status === 'completed',
          priority: task.priority,
          recurring: task.is_recurring
        });
      }
    });

    // Add reminders
    reminders.forEach(reminder => {
      entries.push({
        id: reminder.id,
        title: reminder.title,
        date: new Date(reminder.due_date),
        type: 'reminder',
        recurring: reminder.is_recurring
      });
    });

    return entries;
  }, [tasks, reminders]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    const today = new Date();

    return days.map(date => {
      const dayEntries = calendarEntries.filter(entry => isSameDay(entry.date, date));
      
      return {
        date,
        isCurrentMonth: isSameMonth(date, currentDate),
        isToday: isSameDay(date, today),
        entries: dayEntries,
        hasEntries: dayEntries.length > 0
      };
    });
  }, [currentDate, calendarEntries]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => 
      direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)
    );
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowEntryDialog(true);
  };

  const handleEntryCreated = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['reminders'] });
  };

  if (viewMode === 'agenda') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">{t("calendar", language)}</h2>
          <div className="flex items-center gap-2">
            <CalendarViewSwitcher viewMode={viewMode} onViewModeChange={setViewMode} />
            <Button onClick={() => setShowEntryDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t("add", language)}
            </Button>
          </div>
        </div>
        <CalendarAgenda entries={calendarEntries} />
        <CalendarEntryDialog
          open={showEntryDialog}
          onOpenChange={setShowEntryDialog}
          selectedDate={selectedDate}
          onEntryCreated={handleEntryCreated}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t("calendar", language)}</h2>
        <div className="flex items-center gap-2">
          <CalendarViewSwitcher viewMode={viewMode} onViewModeChange={setViewMode} />
          <Button onClick={() => setShowEntryDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t("add", language)}
          </Button>
        </div>
      </div>

      {/* Calendar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {format(currentDate, 'MMMM yyyy')}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateMonth('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
              >
                {t("today", language)}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateMonth('next')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => (
              <button
                key={index}
                onClick={() => handleDateClick(day.date)}
                className={`
                  p-2 text-sm min-h-[80px] border rounded-md flex flex-col items-start justify-start
                  hover:bg-accent hover:text-accent-foreground transition-colors
                  ${day.isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'}
                  ${day.isToday ? 'bg-primary text-primary-foreground font-bold' : 'bg-background'}
                  ${day.hasEntries ? 'border-primary' : 'border-border'}
                `}
              >
                <span className={day.isToday ? 'text-primary-foreground' : ''}>
                  {format(day.date, 'd')}
                </span>
                
                {/* Entry indicators */}
                <div className="flex flex-col gap-1 mt-1 w-full">
                  {day.entries.slice(0, 2).map((entry) => (
                    <div
                      key={entry.id}
                      className={`
                        text-xs px-1 py-0.5 rounded truncate w-full text-left
                        ${entry.type === 'task' 
                          ? entry.completed 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        }
                      `}
                    >
                      {entry.title}
                    </div>
                  ))}
                  {day.entries.length > 2 && (
                    <div className="text-xs text-muted-foreground">
                      +{day.entries.length - 2} more
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <CalendarEntryDialog
        open={showEntryDialog}
        onOpenChange={setShowEntryDialog}
        selectedDate={selectedDate}
        onEntryCreated={handleEntryCreated}
      />
    </div>
  );
}
