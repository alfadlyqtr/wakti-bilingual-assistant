
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format, addDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import { t } from "@/utils/translations";
import { Maw3dService } from "@/services/maw3dService";
import { Maw3dEvent } from "@/types/maw3d";
import { TRService, TRTask, TRReminder } from "@/services/trService";
import { getCalendarEntries, CalendarEntry, EntryType } from "@/utils/calendarUtils";
import { Hand, Calendar } from "lucide-react";

interface CalendarWidgetProps {
  isLoading: boolean;
  events: any[];
  language: 'en' | 'ar';
}

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({ isLoading, events, language }) => {
  const navigate = useNavigate();
  const [maw3dEvents, setMaw3dEvents] = useState<Maw3dEvent[]>([]);
  const [manualEntries, setManualEntries] = useState<CalendarEntry[]>([]);
  const [tasks, setTasks] = useState<TRTask[]>([]);
  const [reminders, setReminders] = useState<TRReminder[]>([]);
  const [maw3dLoading, setMaw3dLoading] = useState(true);
  const [trLoading, setTrLoading] = useState(true);

  useEffect(() => {
    const fetchMaw3dEvents = async () => {
      try {
        const userEvents = await Maw3dService.getUserEvents();
        console.log('Dashboard widget fetched Maw3d events:', userEvents.length);
        setMaw3dEvents(userEvents);
      } catch (error) {
        console.error('Error fetching Maw3d events for widget:', error);
        setMaw3dEvents([]);
      } finally {
        setMaw3dLoading(false);
      }
    };

    // Load manual entries from localStorage
    const loadManualEntries = () => {
      try {
        const savedEntries = localStorage.getItem('calendarManualEntries');
        if (savedEntries) {
          const parsed = JSON.parse(savedEntries);
          console.log('Dashboard widget loaded manual entries:', parsed.length);
          setManualEntries(parsed);
        } else {
          setManualEntries([]);
        }
      } catch (error) {
        console.error('Error loading manual entries for widget:', error);
        setManualEntries([]);
      }
    };

    // Fetch tasks and reminders
    const fetchTasksAndReminders = async () => {
      try {
        const [tasksData, remindersData] = await Promise.all([
          TRService.getTasks(),
          TRService.getReminders()
        ]);
        console.log('Dashboard widget fetched tasks:', tasksData.length);
        console.log('Dashboard widget fetched reminders:', remindersData.length);
        setTasks(tasksData);
        setReminders(remindersData);
      } catch (error) {
        console.error('Error fetching tasks and reminders for widget:', error);
        setTasks([]);
        setReminders([]);
      } finally {
        setTrLoading(false);
      }
    };

    fetchMaw3dEvents();
    loadManualEntries();
    fetchTasksAndReminders();
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = addDays(new Date(), 1).toISOString().split('T')[0];

  // Get all calendar entries (now async)
  const [allEntries, setAllEntries] = useState<CalendarEntry[]>([]);
  
  useEffect(() => {
    const fetchEntries = async () => {
      try {
        const entries = await getCalendarEntries(manualEntries, events, maw3dEvents, tasks, reminders);
        setAllEntries(entries);
      } catch (error) {
        console.error('Error fetching calendar entries:', error);
        setAllEntries([]);
      }
    };

    if (!isLoading && !maw3dLoading && !trLoading) {
      fetchEntries();
    }
  }, [events, maw3dEvents, manualEntries, tasks, reminders, isLoading, maw3dLoading, trLoading]);
  
  // Filter entries for today and tomorrow
  const todayEntries = allEntries.filter(entry => entry.date === today);
  const tomorrowEntries = allEntries.filter(entry => entry.date === tomorrow);

  console.log('Dashboard widget - Today entries:', todayEntries.length);
  console.log('Dashboard widget - Tomorrow entries:', tomorrowEntries.length);

  const getTodayItemsText = () => {
    if (todayEntries.length === 0) {
      return t("nothingScheduled", language);
    }
    
    const itemTypes = [];
    const events = todayEntries.filter(e => e.type === EntryType.EVENT);
    const maw3d = todayEntries.filter(e => e.type === EntryType.MAW3D_EVENT);
    const manual = todayEntries.filter(e => e.type === EntryType.MANUAL_NOTE);
    const tasks = todayEntries.filter(e => e.type === EntryType.TASK);
    const reminders = todayEntries.filter(e => e.type === EntryType.REMINDER);
    
    if (events.length > 0) {
      itemTypes.push(`${events.length} ${events.length === 1 ? t("event", language) : t("events", language)}`);
    }
    if (maw3d.length > 0) {
      itemTypes.push(`${maw3d.length} Maw3d`);
    }
    if (manual.length > 0) {
      itemTypes.push(`${manual.length} Manual`);
    }
    if (tasks.length > 0) {
      itemTypes.push(`${tasks.length} ${tasks.length === 1 ? 'Task' : 'Tasks'}`);
    }
    if (reminders.length > 0) {
      itemTypes.push(`${reminders.length} ${reminders.length === 1 ? 'Reminder' : 'Reminders'}`);
    }
    
    return itemTypes.join(', ');
  };

  const getTomorrowItemsText = () => {
    if (tomorrowEntries.length === 0) {
      return t("nothingScheduled", language);
    }
    
    const itemTypes = [];
    const events = tomorrowEntries.filter(e => e.type === EntryType.EVENT);
    const maw3d = tomorrowEntries.filter(e => e.type === EntryType.MAW3D_EVENT);
    const manual = tomorrowEntries.filter(e => e.type === EntryType.MANUAL_NOTE);
    const tasks = tomorrowEntries.filter(e => e.type === EntryType.TASK);
    const reminders = tomorrowEntries.filter(e => e.type === EntryType.REMINDER);
    
    if (events.length > 0) {
      itemTypes.push(`${events.length} ${events.length === 1 ? t("event", language) : t("events", language)}`);
    }
    if (maw3d.length > 0) {
      itemTypes.push(`${maw3d.length} Maw3d`);
    }
    if (manual.length > 0) {
      itemTypes.push(`${manual.length} Manual`);
    }
    if (tasks.length > 0) {
      itemTypes.push(`${tasks.length} ${tasks.length === 1 ? 'Task' : 'Tasks'}`);
    }
    if (reminders.length > 0) {
      itemTypes.push(`${reminders.length} ${reminders.length === 1 ? 'Reminder' : 'Reminders'}`);
    }
    
    return itemTypes.join(', ');
  };

  return (
    <div className="relative group">
      {/* Liquid Glass Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background/80 via-background/40 to-background/60 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 rounded-xl"></div>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 rounded-xl"></div>
      
      {/* Drag handle with glass effect */}
      <div className="absolute top-2 left-2 z-20 p-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-primary/20 hover:border-primary/30 transition-all duration-300 cursor-grab active:cursor-grabbing group-hover:scale-110">
        <Hand className="h-3 w-3 text-primary/70" />
      </div>

      {/* Content */}
      <div className="relative z-10 p-6 pt-12">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            {format(new Date(), "MMMM yyyy")}
          </h3>
          <div className="ml-auto text-xs font-medium bg-primary/10 text-primary px-3 py-1 rounded-full backdrop-blur-sm border border-primary/20">
            {t("today", language)}
          </div>
        </div>
        
        {/* Calendar days of week header */}
        <div className="grid grid-cols-7 gap-1 mb-3 text-xs text-center text-muted-foreground font-medium">
          <div>S</div>
          <div>M</div>
          <div>T</div>
          <div>W</div>
          <div>T</div>
          <div>F</div>
          <div>S</div>
        </div>
        
        {/* Today and tomorrow calendar cells */}
        <div className="flex gap-3 mb-4">
          {/* Today */}
          <div className="flex-1 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-3 rounded-xl shadow-lg backdrop-blur-sm border border-primary/20">
            <div className="font-bold text-center text-lg">{format(new Date(), "d")}</div>
            <div className="text-xs text-center opacity-90 mb-2">{t("today", language)}</div>
            <div className="text-xs">
              {isLoading || maw3dLoading || trLoading ? (
                <Skeleton className="h-3 w-full bg-white/20" />
              ) : (
                <div className="truncate leading-relaxed">{getTodayItemsText()}</div>
              )}
            </div>
          </div>
          
          {/* Tomorrow */}
          <div className="flex-1 bg-gradient-to-br from-secondary/20 to-secondary/10 p-3 rounded-xl backdrop-blur-sm border border-secondary/20 hover:border-secondary/40 transition-all duration-300">
            <div className="font-bold text-center text-lg">{format(addDays(new Date(), 1), "d")}</div>
            <div className="text-xs text-center text-muted-foreground mb-2">{t("tomorrow", language)}</div>
            <div className="text-xs text-muted-foreground">
              {isLoading || maw3dLoading || trLoading ? (
                <Skeleton className="h-3 w-full" />
              ) : (
                <div className="truncate leading-relaxed">{getTomorrowItemsText()}</div>
              )}
            </div>
          </div>
        </div>

        <Button 
          variant="outline" 
          size="sm" 
          className="w-full bg-white/10 backdrop-blur-sm border-white/20 hover:bg-primary/20 hover:border-primary/40 transition-all duration-300" 
          onClick={() => navigate('/calendar')}
        >
          {t("calendar_open", language)}
        </Button>
      </div>
    </div>
  );
};
