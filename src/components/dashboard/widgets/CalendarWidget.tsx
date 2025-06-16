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
import { useCalendarData } from "@/hooks/useCalendarData";

interface CalendarWidgetProps {
  isLoading: boolean;
  events: any[];
  language: 'en' | 'ar';
}

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({ isLoading, events, language }) => {
  const navigate = useNavigate();
  // Use shared calendar data (live syncs)
  const { loading, entries, refresh } = useCalendarData();

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = addDays(new Date(), 1).toISOString().split('T')[0];

  const todayEntries = entries.filter(entry => entry.date === today);
  const tomorrowEntries = entries.filter(entry => entry.date === tomorrow);

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
    if (events.length > 0) itemTypes.push(`${events.length} ${events.length === 1 ? t("event", language) : t("events", language)}`);
    if (maw3d.length > 0) itemTypes.push(`${maw3d.length} Maw3d`);
    if (manual.length > 0) itemTypes.push(`${manual.length} Manual`);
    if (tasks.length > 0) itemTypes.push(`${tasks.length} ${tasks.length === 1 ? 'Task' : 'Tasks'}`);
    if (reminders.length > 0) itemTypes.push(`${reminders.length} ${reminders.length === 1 ? 'Reminder' : 'Reminders'}`);
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
    if (events.length > 0) itemTypes.push(`${events.length} ${events.length === 1 ? t("event", language) : t("events", language)}`);
    if (maw3d.length > 0) itemTypes.push(`${maw3d.length} Maw3d`);
    if (manual.length > 0) itemTypes.push(`${manual.length} Manual`);
    if (tasks.length > 0) itemTypes.push(`${tasks.length} ${tasks.length === 1 ? 'Task' : 'Tasks'}`);
    if (reminders.length > 0) itemTypes.push(`${reminders.length} ${reminders.length === 1 ? 'Reminder' : 'Reminders'}`);
    return itemTypes.join(', ');
  };

  return (
    <div
      className="relative calendar-widget overflow-visible rounded-xl border shadow-glow"
      style={{
        // SOLID, soft gradient background -- match app style, not frosted
        background: "linear-gradient(120deg, hsl(var(--background)) 80%, hsl(var(--accent-blue) / 0.06) 100%)",
        borderColor: "hsl(var(--accent-blue) / 0.23)",
        boxShadow: "var(--shadow-soft), var(--shadow-colored)",
        // Remove extra blur, keep slight shadow/glow for separation
      }}
    >
      {/* Remove: extra glassy/frosted overlay/blurs */}
      {/* Remove: subtle glow highlight. Widget looks cleaner without unnecessary overlays */}
      {/* Drag handle */}
      <div className="absolute top-2 left-2 z-20 p-2 rounded-lg bg-accent-blue/10 border border-accent-blue/20 cursor-grab active:cursor-grabbing">
        <Hand className="h-3 w-3 text-accent-blue" />
      </div>
      {/* Main content */}
      <div className="relative z-10 p-5 pt-10">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5" style={{ color: "hsl(var(--accent-blue))" }} />
          <h3 className="font-bold text-lg text-accent-blue drop-shadow" style={{ letterSpacing: '0.2px' }}>
            {format(new Date(), "MMMM yyyy")}
          </h3>
          <div className="ml-auto text-xs font-medium bg-accent-blue/10 text-accent-blue px-3 py-1 rounded-full border border-accent-blue/30">
            {t("today", language)}
          </div>
        </div>
        {/* Calendar days header */}
        <div className="grid grid-cols-7 gap-1 mb-3 text-xs text-center font-semibold" style={{ color: "hsl(var(--accent-blue) / 0.70)" }}>
          <div>S</div>
          <div>M</div>
          <div>T</div>
          <div>W</div>
          <div>T</div>
          <div>F</div>
          <div>S</div>
        </div>
        {/* Today & tomorrow cards */}
        <div className="flex gap-3 mb-4">
          {/* Today */}
          <div
            className="flex-1 p-3 rounded-xl shadow-glow relative border"
            style={{
              // SOLID: Strong app blue bg, white text
              background: "hsl(var(--accent-blue))",
              borderColor: "hsl(var(--accent-blue) / 0.20)",
            }}
          >
            <div className="font-bold text-center text-lg text-white">{format(new Date(), "d")}</div>
            <div className="text-xs text-center mb-2 text-white/90 font-semibold">{t("today", language)}</div>
            <div className="text-xs text-white/90">
              {isLoading || loading ? (
                <Skeleton className="h-3 w-full bg-white/40" />
              ) : (
                <div className="truncate leading-relaxed">{getTodayItemsText()}</div>
              )}
            </div>
          </div>
          {/* Tomorrow */}
          <div
            className="flex-1 p-3 rounded-xl relative border"
            style={{
              // Reverse: white background, accent-blue border/text (not faded!)
              background: "#fff",
              borderColor: "hsl(var(--accent-blue) / 0.18)",
              boxShadow: "var(--glow-blue), var(--shadow-soft)",
            }}
          >
            <div className="font-bold text-center text-lg" style={{ color: "hsl(var(--accent-blue))", fontWeight: 700 }}>
              {format(addDays(new Date(), 1), "d")}
            </div>
            <div className="text-xs text-center mb-2 text-accent-blue font-semibold">
              {t("tomorrow", language)}
            </div>
            <div className="text-xs" style={{ color: "hsl(var(--accent-blue) / 0.9)" }}>
              {isLoading || loading ? (
                <Skeleton className="h-3 w-full bg-accent-blue/20" />
              ) : (
                <div className="truncate leading-relaxed">{getTomorrowItemsText()}</div>
              )}
            </div>
          </div>
        </div>
        {/* SOLID, highly visible button: app gradient, white text */}
        <Button
          variant="default"
          size="sm"
          className="w-full mt-2 font-bold !bg-gradient-to-r !from-accent-blue !to-accent-purple !text-white !shadow-glow !border-0 transition-all"
          style={{
            background: "linear-gradient(90deg, hsl(var(--accent-blue)), hsl(var(--accent-purple)))",
            color: "#fff",
            opacity: 1, // Force fully solid
            boxShadow: "0 2px 12px hsl(var(--accent-blue) / 0.20)", // subtle but solid
          }}
          onClick={() => navigate('/calendar')}
        >
          {t("calendar_open", language)}
        </Button>
      </div>
    </div>
  );
};
