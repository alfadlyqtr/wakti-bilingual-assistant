
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Clock, MapPin } from "lucide-react";

export default function Events() {
  const { language } = useTheme();
  const navigate = useNavigate();
  const [events] = useState([
    {
      id: "1",
      title: "Team Meeting",
      description: "Weekly team sync",
      date: "2024-01-15",
      time: "14:00",
      location: "Conference Room A",
      status: "upcoming"
    },
    {
      id: "2",
      title: "Project Review",
      description: "Q1 project review session",
      date: "2024-01-20",
      time: "10:00",
      location: "Main Hall",
      status: "upcoming"
    }
  ]);

  const handleEventClick = (eventId: string) => {
    navigate(`/event/${eventId}`);
  };

  const handleCreateEvent = () => {
    navigate("/event/create");
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            {t("events", language)}
          </h1>
          <Button onClick={handleCreateEvent} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            {t("create", language)}
          </Button>
        </div>

        <div className="space-y-3">
          {events.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">{t("noEvents", language)}</p>
                <Button onClick={handleCreateEvent}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("createFirstEvent", language)}
                </Button>
              </CardContent>
            </Card>
          ) : (
            events.map((event) => (
              <Card
                key={event.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleEventClick(event.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{event.title}</CardTitle>
                    <Badge variant="secondary">{event.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {event.description && (
                    <p className="text-muted-foreground text-sm">{event.description}</p>
                  )}
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{event.date}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{event.time}</span>
                    </div>
                  </div>

                  {event.location && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>{event.location}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
