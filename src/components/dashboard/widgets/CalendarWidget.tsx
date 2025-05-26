
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format, addDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import { t } from "@/utils/translations";
import { Maw3dService } from "@/services/maw3dService";
import { Maw3dEvent } from "@/types/maw3d";

interface CalendarWidgetProps {
  isLoading: boolean;
  events: any[];
  tasks: any[];
  language: 'en' | 'ar';
}

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({ isLoading, events, tasks, language }) => {
  const navigate = useNavigate();
  const [maw3dEvents, setMaw3dEvents] = useState<Maw3dEvent[]>([]);
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

    fetchMaw3dEvents();
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const todayMaw3dEvents = maw3dEvents.filter(event => event.event_date === today);
  const todayEvents = events?.filter(event => {
    const eventDate = event.date || event.start_date || event.event_date;
    return eventDate?.split('T')[0] === today;
  }) || [];
  
  const todayTasks = tasks?.filter(task => {
    const taskDate = task.due_date?.split('T')[0];
    return taskDate === today;
  }) || [];

  const totalTodayItems = todayEvents.length + todayTasks.length + todayMaw3dEvents.length;

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
                <>
                  {todayEvents.length > 0 && (
                    <div className="truncate">{todayEvents.length} {todayEvents.length === 1 ? t("event", language) : t("events", language)}</div>
                  )}
                  {todayMaw3dEvents.length > 0 && (
                    <div className="truncate">{todayMaw3dEvents.length} Maw3d {todayMaw3dEvents.length === 1 ? t("event", language) : t("events", language)}</div>
                  )}
                  {todayTasks.length > 0 && (
                    <div className="truncate">{todayTasks.length} {todayTasks.length === 1 ? t("task", language) : t("tasks", language)}</div>
                  )}
                  {totalTodayItems === 0 && (
                    <div className="truncate">{t("nothingScheduled", language)}</div>
                  )}
                </>
              )}
            </div>
          </div>
          
          {/* Tomorrow */}
          <div className="flex-1 bg-secondary/20 p-2 rounded-md">
            <div className="font-bold text-center">{format(addDays(new Date(), 1), "d")}</div>
            <div className="text-xs text-center">{t("tomorrow", language)}</div>
            <div className="mt-1 text-xs">
              <div className="truncate">{t("nothingScheduled", language)}</div>
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
