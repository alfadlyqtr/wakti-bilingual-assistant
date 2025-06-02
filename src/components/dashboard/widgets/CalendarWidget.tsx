
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format, addDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import { t } from "@/utils/translations";
import { Maw3dService } from "@/services/maw3dService";
import { Maw3dEvent } from "@/types/maw3d";
import { getCalendarEntries, CalendarEntry, EntryType } from "@/utils/calendarUtils";

interface CalendarWidgetProps {
  isLoading: boolean;
  events: any[];
  language: 'en' | 'ar';
}

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({ isLoading, events, language }) => {
  const navigate = useNavigate();
  const [maw3dEvents, setMaw3dEvents] = useState<Maw3dEvent[]>([]);
  const [manualEntries, setManualEntries] = useState<CalendarEntry[]>([]);
  const [maw3dLoading, setMaw3dLoading] = useState(true);

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

    fetchMaw3dEvents();
    loadManualEntries();
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = addDays(new Date(), 1).toISOString().split('T')[0];

  // Get all calendar entries (now async)
  const [allEntries, setAllEntries] = useState<CalendarEntry[]>([]);
  
  useEffect(() => {
    const fetchEntries = async () => {
      try {
        const entries = await getCalendarEntries(manualEntries, events, maw3dEvents);
        setAllEntries(entries);
      } catch (error) {
        console.error('Error fetching calendar entries:', error);
        setAllEntries([]);
      }
    };

    if (!isLoading && !maw3dLoading) {
      fetchEntries();
    }
  }, [events, maw3dEvents, manualEntries, isLoading, maw3dLoading]);
  
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
    
    if (events.length > 0) {
      itemTypes.push(`${events.length} ${events.length === 1 ? t("event", language) : t("events", language)}`);
    }
    if (maw3d.length > 0) {
      itemTypes.push(`${maw3d.length} Maw3d`);
    }
    if (manual.length > 0) {
      itemTypes.push(`${manual.length} Manual`);
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
    
    if (events.length > 0) {
      itemTypes.push(`${events.length} ${events.length === 1 ? t("event", language) : t("events", language)}`);
    }
    if (maw3d.length > 0) {
      itemTypes.push(`${maw3d.length} Maw3d`);
    }
    if (manual.length > 0) {
      itemTypes.push(`${manual.length} Manual`);
    }
    
    return itemTypes.join(', ');
  };

  return (
    <div className="p-4">
      <div className="mb-2">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-medium">{format(new Date(), "MMMM yyyy")}</h3>
          <div className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded-full">
            {t("today", language)}
          </div>
        </div>
        
        {/* Calendar days of week header */}
        <div className="grid grid-cols-7 gap-1 mb-1 text-xs text-center">
          <div>S</div>
          <div>M</div>
          <div>T</div>
          <div>W</div>
          <div>T</div>
          <div>F</div>
          <div>S</div>
        </div>
        
        {/* Today and tomorrow calendar cells */}
        <div className="flex gap-1">
          {/* Today */}
          <div className="flex-1 bg-primary text-primary-foreground p-2 rounded-md">
            <div className="font-bold text-center">{format(new Date(), "d")}</div>
            <div className="text-xs text-center">{t("today", language)}</div>
            <div className="mt-1 text-xs">
              {isLoading || maw3dLoading ? (
                <Skeleton className="h-3 w-full" />
              ) : (
                <div className="truncate">{getTodayItemsText()}</div>
              )}
            </div>
          </div>
          
          {/* Tomorrow */}
          <div className="flex-1 bg-secondary/20 p-2 rounded-md">
            <div className="font-bold text-center">{format(addDays(new Date(), 1), "d")}</div>
            <div className="text-xs text-center">{t("tomorrow", language)}</div>
            <div className="mt-1 text-xs">
              {isLoading || maw3dLoading ? (
                <Skeleton className="h-3 w-full" />
              ) : (
                <div className="truncate">{getTomorrowItemsText()}</div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/calendar')}>
        {t("calendar_open", language)}
      </Button>
    </div>
  );
};
