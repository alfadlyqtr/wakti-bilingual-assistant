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
    <div className="relative group calendar-widget overflow-visible" style={{ WebkitBackdropFilter: "blur(24px)" }}>
      {/* Deep accent glass background, SOFTER and AIRIER */}
      <div
        className="absolute inset-0 z-0 rounded-xl pointer-events-none"
        style={{
          background: "rgba(34, 62, 140, 0.50)", // More transparent, deep blue
          backdropFilter: "blur(22px) saturate(150%)",
          WebkitBackdropFilter: "blur(22px) saturate(150%)",
          boxShadow: "0 8px 36px 0 rgba(36,54,140,0.08)",
          border: "2px solid rgba(36,54,140,0.075)",
        }}
      />
      {/* Layered blue glass reflection (subtle) */}
      <div
        className="absolute inset-0 z-0 rounded-xl pointer-events-none"
        style={{
          background:
            "linear-gradient(135deg, rgba(87,154,255,0.12) 0%, rgba(255,255,255,0.02) 45%, rgba(36,54,140,0.07) 100%)",
        }}
      />
      {/* Accent-blue glow for visual pop */}
      <div className="absolute -bottom-6 -right-6 w-28 h-20 bg-accent-blue/20 rounded-full blur-2xl opacity-20 pointer-events-none" />
      {/* Drag handle */}
      <div className="absolute top-2 left-2 z-20 p-2 rounded-lg bg-accent-blue/10 backdrop-blur-md border border-accent-blue/20 hover:bg-accent-blue/25 hover:border-accent-blue/40 transition-all duration-300 cursor-grab active:cursor-grabbing group-hover:scale-110">
        <Hand className="h-3 w-3 text-accent-blue/70" />
      </div>
      {/* Main Content */}
      <div className="relative z-10 p-6 pt-12">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-accent-blue" />
          <h3 className="font-semibold text-lg bg-gradient-to-r from-accent-blue to-accent-blue/80 bg-clip-text text-transparent drop-shadow-md">
            {format(new Date(), "MMMM yyyy")}
          </h3>
          <div className="ml-auto text-xs font-medium bg-accent-blue/10 text-accent-blue px-3 py-1 rounded-full backdrop-blur-sm border border-accent-blue/15">
            {t("today", language)}
          </div>
        </div>
        {/* Calendar days header */}
        <div className="grid grid-cols-7 gap-1 mb-3 text-xs text-center font-medium text-accent-blue/70">
          <div>S</div>
          <div>M</div>
          <div>T</div>
          <div>W</div>
          <div>T</div>
          <div>F</div>
          <div>S</div>
        </div>
        {/* Today & Tomorrow cards: enhance contrast */}
        <div className="flex gap-3 mb-4">
          {/* Today */}
          <div className="flex-1 bg-accent-blue/90 backdrop-blur-[10px] border border-white/10 text-white p-3 rounded-xl shadow-glow relative">
            <div className="font-bold text-center text-lg drop-shadow">{format(new Date(), "d")}</div>
            <div className="text-xs text-center opacity-90 mb-2">{t("today", language)}</div>
            <div className="text-xs text-white/90">
              {isLoading || maw3dLoading || trLoading ? (
                <Skeleton className="h-3 w-full bg-white/20" />
              ) : (
                <div className="truncate leading-relaxed">{getTodayItemsText()}</div>
              )}
            </div>
            {/* Subtle glass glare */}
            <div className="absolute inset-0 pointer-events-none opacity-15 rounded-xl bg-gradient-to-tl from-white/10 via-accent-blue/5 to-transparent blur-[2px]" />
          </div>
          {/* Tomorrow */}
          <div className="flex-1 bg-accent-blue/25 backdrop-blur-[7px] border border-accent-blue/10 text-accent-blue p-3 rounded-xl hover:border-accent-blue/35 transition-all duration-300 relative">
            <div className="font-bold text-center text-lg text-accent-blue">{format(addDays(new Date(), 1), "d")}</div>
            <div className="text-xs text-center text-accent-blue/80 mb-2">{t("tomorrow", language)}</div>
            <div className="text-xs text-accent-blue/90">
              {isLoading || maw3dLoading || trLoading ? (
                <Skeleton className="h-3 w-full bg-accent-blue/10" />
              ) : (
                <div className="truncate leading-relaxed">{getTomorrowItemsText()}</div>
              )}
            </div>
            <div className="absolute inset-0 pointer-events-none opacity-12 rounded-xl bg-gradient-to-br from-accent-blue/10 to-transparent blur-[2px]" />
          </div>
        </div>
        {/* High-contrast Open Calendar Button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full bg-white/90 text-accent-blue font-bold shadow-glow border-accent-blue/15 hover:bg-accent-blue/90 hover:text-white"
          onClick={() => navigate('/calendar')}
        >
          {t("calendar_open", language)}
        </Button>
      </div>
    </div>
  );
};
