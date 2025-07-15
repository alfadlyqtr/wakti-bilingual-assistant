
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Edit, Trash2 } from "lucide-react";

export default function EventView() {
  const { language } = useTheme();
  const navigate = useNavigate();
  const { id } = useParams();
  const [event, setEvent] = useState({
    title: "Sample Event",
    description: "This is a sample event description",
    date: "2024-01-15",
    time: "14:00",
    location: "Sample Location",
    status: "upcoming"
  });

  useEffect(() => {
    // Load event data by ID
    console.log("Loading event with ID:", id);
    // Implement event loading logic here
  }, [id]);

  const handleEdit = () => {
    navigate(`/event/${id}/edit`);
  };

  const handleDelete = () => {
    // Implement event deletion logic here
    console.log("Deleting event:", id);
    navigate("/events");
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {event.title}
              </CardTitle>
              <Badge variant="secondary">{event.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {event.description && (
              <div>
                <h3 className="font-medium mb-2">{t("description", language)}</h3>
                <p className="text-muted-foreground">{event.description}</p>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{event.date}</span>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{event.time}</span>
              </div>

              {event.location && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{event.location}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => navigate("/events")}
                className="flex-1"
              >
                {t("back", language)}
              </Button>
              <Button
                variant="outline"
                onClick={handleEdit}
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                {t("edit", language)}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {t("delete", language)}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
