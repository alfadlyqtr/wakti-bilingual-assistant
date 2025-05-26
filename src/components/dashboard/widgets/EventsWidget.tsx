
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIconFull } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { t } from "@/utils/translations";
import { Maw3dService } from "@/services/maw3dService";
import { Maw3dEvent } from "@/types/maw3d";

interface EventsWidgetProps {
  isLoading: boolean;
  events: any[];
  language: 'en' | 'ar';
}

export const EventsWidget: React.FC<EventsWidgetProps> = ({ isLoading, events, language }) => {
  const navigate = useNavigate();
  const [maw3dEvents, setMaw3dEvents] = useState<Maw3dEvent[]>([]);
  const [maw3dLoading, setMaw3dLoading] = useState(true);

  useEffect(() => {
    const fetchMaw3dEvents = async () => {
      try {
        const userEvents = await Maw3dService.getUserEvents();
        const today = new Date().toISOString().split('T')[0];
        const todayEvents = userEvents.filter(event => event.event_date === today);
        setMaw3dEvents(todayEvents);
      } catch (error) {
        console.error('Error fetching Maw3d events for widget:', error);
        setMaw3dEvents([]);
      } finally {
        setMaw3dLoading(false);
      }
    };

    fetchMaw3dEvents();
  }, []);

  const allEvents = [...(events || []), ...maw3dEvents];

  return (
    <div className="p-4">
      <h3 className="font-medium mb-2">{t("events_today", language)}</h3>
      {isLoading || maw3dLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : allEvents && allEvents.length > 0 ? (
        <div className="space-y-2">
          {allEvents.map((event: any) => (
            <div key={event.id} className="flex items-center justify-between p-2 bg-secondary/20 rounded-md">
              <div>
                <div className="font-medium">{event.title}</div>
                <div className="text-xs text-muted-foreground">
                  {event.location || t("noLocation", language)}
                </div>
              </div>
              <div className="text-xs font-medium bg-secondary px-2 py-1 rounded-full">
                {event.start_time || event.is_all_day ? 
                  (event.is_all_day ? t("allDay", language) : 
                   event.start_time ? format(new Date(`2000-01-01T${event.start_time}`), "h:mm a") : "--:--") :
                  (event.start_time ? format(new Date(event.start_time), "h:mm a") : "--:--")
                }
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => navigate('/maw3d')}>
            {t("events_view_all", language)}
          </Button>
        </div>
      ) : (
        <div className="text-center py-3">
          <CalendarIconFull className="mx-auto h-8 w-8 text-muted-foreground opacity-50 mb-2" />
          <p className="text-sm text-muted-foreground">{t("noEventsYet", language)}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/maw3d/create')}>
            {t("createEvent", language)}
          </Button>
        </div>
      )}
    </div>
  );
};
