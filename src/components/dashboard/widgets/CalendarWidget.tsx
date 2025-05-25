
import React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format, addDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import { t } from "@/utils/translations";

interface CalendarWidgetProps {
  isLoading: boolean;
  events: any[];
  tasks: any[];
  language: 'en' | 'ar';
}

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({ isLoading, events, tasks, language }) => {
  const navigate = useNavigate();

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
              {isLoading ? (
                <Skeleton className="h-3 w-full" />
              ) : events && events.length > 0 ? (
                <div className="truncate">{events.length} {events.length === 1 ? t("event", language) : t("events", language)}</div>
              ) : (
                <div className="truncate">{t("noEvents", language)}</div>
              )}
              {isLoading ? (
                <Skeleton className="h-3 w-4/5 mt-1" />
              ) : tasks && tasks.length > 0 ? (
                <div className="truncate">{tasks.length} {tasks.length === 1 ? t("task", language) : t("tasks", language)}</div>
              ) : (
                <div className="truncate">{t("noTasks", language)}</div>
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
