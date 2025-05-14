
import { useState } from "react";
import { Calendar, CalendarPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

interface EventListProps {
  events: any[];
  type: "upcoming" | "past" | "invites";
  isLoading: boolean;
  emptyMessage: string;
}

export default function EventList({
  events,
  type,
  isLoading,
  emptyMessage,
}: EventListProps) {
  const navigate = useNavigate();
  const { language } = useTheme();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <EventSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        {type === "invites" ? (
          <Calendar className="h-12 w-12 mb-4 text-muted-foreground" />
        ) : (
          <CalendarPlus className="h-12 w-12 mb-4 text-muted-foreground" />
        )}
        <h3 className="text-lg font-medium mb-2">{emptyMessage}</h3>
        
        {type !== "past" && (
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => navigate("/events/create")}
          >
            {t("createFirstEvent", language)}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <EventCard key={event.id} event={event} type={type} />
      ))}
    </div>
  );
}

function EventCard({ event, type }: { event: any; type: string }) {
  const navigate = useNavigate();
  const { language } = useTheme();

  const handleEventClick = () => {
    navigate(`/events/${event.id}`);
  };

  return (
    <Card 
      className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow" 
      onClick={handleEventClick}
    >
      <div className="relative">
        {event.cover_image ? (
          <img 
            src={event.cover_image} 
            alt={event.title} 
            className="w-full h-32 object-cover"
          />
        ) : (
          <div 
            className="w-full h-32 flex items-center justify-center"
            style={{
              background: event.background_color || "linear-gradient(to right, var(--secondary), var(--primary))"
            }}
          >
            <span className="text-white font-bold text-xl">{event.title}</span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
          <h3 className="text-white font-semibold truncate">{event.title}</h3>
        </div>
      </div>
      <div className="p-3">
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm text-muted-foreground">
            {event.start_time ? format(new Date(event.start_time), "MMM d, yyyy") : ""}
          </div>
          {type === "invites" && (
            <div className="flex space-x-2">
              <Button size="sm" variant="outline">{t("decline", language)}</Button>
              <Button size="sm">{t("accept", language)}</Button>
            </div>
          )}
        </div>
        <div className="text-sm truncate">{event.location || t("noLocation", language)}</div>
        {event.rsvp_count > 0 && (
          <div className="text-sm text-muted-foreground mt-2">
            {event.rsvp_count} {event.rsvp_count === 1 ? t("attendee", language) : t("attendees", language)}
          </div>
        )}
      </div>
    </Card>
  );
}

function EventSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="h-32 w-full" />
      <div className="p-4">
        <Skeleton className="h-5 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </Card>
  );
}
