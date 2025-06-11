
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { t } from "@/utils/translations";
import { Maw3dService } from "@/services/maw3dService";
import { Maw3dEvent } from "@/types/maw3d";
import { Hand, Heart, Calendar, Plus } from "lucide-react";

interface Maw3dWidgetProps {
  language: 'en' | 'ar';
}

export const Maw3dWidget: React.FC<Maw3dWidgetProps> = ({ language }) => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Maw3dEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const userEvents = await Maw3dService.getUserEvents();
        console.log('Maw3d Widget fetched events:', userEvents.length);
        setEvents(userEvents);
      } catch (error) {
        console.error('Error fetching Maw3d events for widget:', error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const hasEvents = events && events.length > 0;

  return (
    <div className="relative group">
      {/* Liquid Glass Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background/80 via-background/40 to-background/60 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5 rounded-xl"></div>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-purple-500/10 via-transparent to-pink-500/10 rounded-xl"></div>
      
      {/* Drag handle with glass effect */}
      <div className="absolute top-2 left-2 z-20 p-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-primary/20 hover:border-primary/30 transition-all duration-300 cursor-grab active:cursor-grabbing group-hover:scale-110">
        <Hand className="h-3 w-3 text-primary/70" />
      </div>

      {/* Content */}
      <div className="relative z-10 p-6 pt-12">
        <div className="flex items-center gap-2 mb-4">
          <Heart className="h-5 w-5 text-purple-500" />
          <h3 className="font-semibold text-lg bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
            Maw3d Events
          </h3>
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : hasEvents ? (
          <div className="space-y-3">
            {events.slice(0, 3).map((event) => (
              <div 
                key={event.id} 
                className="flex items-center justify-between p-3 rounded-lg bg-purple-500/10 backdrop-blur-sm border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300"
              >
                <span className="text-sm font-medium truncate flex-1">{event.title}</span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground bg-purple-500/10 px-2 py-1 rounded-full">
                  <Calendar className="h-3 w-3" />
                  {event.event_date ? format(parseISO(event.event_date), "MMM d") : "TBD"}
                </div>
              </div>
            ))}
            
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full mt-3 bg-white/10 backdrop-blur-sm border-white/20 hover:bg-purple-500/20 hover:border-purple-500/40 transition-all duration-300" 
              onClick={() => navigate('/maw3d-events')}
            >
              {t("events_view_all", language)}
            </Button>
          </div>
        ) : (
          <div className="text-center py-6">
            <Heart className="mx-auto h-8 w-8 text-purple-500/50 mb-3" />
            <p className="text-sm text-muted-foreground mb-3">{t("noEventsYet", language)}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-white/10 backdrop-blur-sm border-white/20 hover:bg-purple-500/20 hover:border-purple-500/40 transition-all duration-300" 
              onClick={() => navigate('/maw3d-create')}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("createEvent", language)}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
