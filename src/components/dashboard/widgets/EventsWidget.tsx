
import React from "react";
import { Button } from "@/components/ui/button";
import { Calendar, Hand } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { t } from "@/utils/translations";
import { useWidgetDragHandle } from "@/components/dashboard/WidgetDragHandleContext";

interface EventsWidgetProps {
  isLoading: boolean;
  events: any[];
  language: 'en' | 'ar';
}

export const EventsWidget: React.FC<EventsWidgetProps> = ({ isLoading, events, language }) => {
  const navigate = useNavigate();
  const hasEvents = events && events.length > 0;
  const { registerHandle, listeners, attributes, isDragging } = useWidgetDragHandle();
  const handleBindings = isDragging ? { ...attributes, ...listeners } : {};
  const handleClass = isDragging
    ? "absolute top-1 left-1 z-20 p-1 rounded-md border border-primary/40 bg-primary/30 text-primary-foreground shadow-lg ring-2 ring-primary/60 cursor-grab active:cursor-grabbing transition-all duration-300"
    : "absolute top-1 left-1 z-20 p-1 rounded-md bg-muted/60 border border-muted-foreground/20 hover:bg-primary/80 hover:text-primary-foreground hover:border-primary/60 transition-colors cursor-grab active:cursor-grabbing";

  return (
    <div className={`relative ${hasEvents ? 'p-4' : 'p-2'}`}>
      {/* Drag handle */}
      <div
        ref={registerHandle}
        {...handleBindings}
        className={handleClass}
      >
        <Hand className="h-3 w-3" />
      </div>
      
      <div className={hasEvents ? "ml-10" : "ml-8"}>
        <h3 className={`font-medium ${hasEvents ? 'mb-2' : 'mb-1'} ${hasEvents ? 'text-base' : 'text-sm'}`}>
          {t("events", language)}
        </h3>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ) : hasEvents ? (
          <div className="space-y-2">
            {events.slice(0, 3).map((event: any) => (
              <div key={event.id} className="flex justify-between items-center">
                <span className="text-sm truncate">{event.title}</span>
                <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded-full">
                  {event.event_date ? format(parseISO(event.event_date), "MMM d") : 
                   event.start_time ? format(parseISO(event.start_time), "MMM d") : "TBD"}
                </span>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => navigate('/maw3d-events')}>
              {t("events_view_all", language)}
            </Button>
          </div>
        ) : (
          <div className="text-center py-1">
            <Calendar className="mx-auto h-4 w-4 text-muted-foreground opacity-50 mb-1" />
            <p className="text-xs text-muted-foreground mb-1">{t("noEventsYet", language)}</p>
            <Button variant="outline" size="sm" className="text-xs px-2 py-1 h-auto" onClick={() => navigate('/maw3d-create')}>
              {t("createEvent", language)}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
