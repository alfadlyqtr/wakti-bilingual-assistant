
import React from "react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIconFull } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { t } from "@/utils/translations";

interface EventsWidgetProps {
  isLoading: boolean;
  events: any[];
  language: 'en' | 'ar';
}

export const EventsWidget: React.FC<EventsWidgetProps> = ({ isLoading, events, language }) => {
  const navigate = useNavigate();

  return (
    <div className="p-4">
      <h3 className="font-medium mb-2">{t("events_today", language)}</h3>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : events && events.length > 0 ? (
        <div className="space-y-2">
          {events.map((event: any) => (
            <div key={event.id} className="flex items-center justify-between p-2 bg-secondary/20 rounded-md">
              <div>
                <div className="font-medium">{event.title}</div>
                <div className="text-xs text-muted-foreground">{event.location || t("noLocation", language)}</div>
              </div>
              <div className="text-xs font-medium bg-secondary px-2 py-1 rounded-full">
                {event.start_time ? format(new Date(event.start_time), "h:mm a") : "--:--"}
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => navigate('/events')}>
            {t("events_view_all", language)}
          </Button>
        </div>
      ) : (
        <div className="text-center py-3">
          <CalendarIconFull className="mx-auto h-8 w-8 text-muted-foreground opacity-50 mb-2" />
          <p className="text-sm text-muted-foreground">{t("noEventsYet", language)}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/events')}>
            {t("createEvent", language)}
          </Button>
        </div>
      )}
    </div>
  );
};
