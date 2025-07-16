
import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { t } from "@/utils/translations";
import { Hand, Heart, Plus, Calendar, MapPin, Users } from "lucide-react";
import { useOptimizedMaw3dEvents } from "@/hooks/useOptimizedMaw3dEvents";
import { format, parseISO, isToday, isTomorrow, isFuture } from "date-fns";

interface Maw3dWidgetProps {
  language: 'en' | 'ar';
}

export const Maw3dWidget: React.FC<Maw3dWidgetProps> = ({ language }) => {
  const navigate = useNavigate();
  const { events, loading, attendingCounts } = useOptimizedMaw3dEvents();

  // Filter and sort upcoming events
  const upcomingEvents = events
    .filter(event => isFuture(parseISO(event.event_date)) || isToday(parseISO(event.event_date)))
    .sort((a, b) => parseISO(a.event_date).getTime() - parseISO(b.event_date).getTime())
    .slice(0, 3);

  const todayEvents = events.filter(event => isToday(parseISO(event.event_date)));
  const tomorrowEvents = events.filter(event => isTomorrow(parseISO(event.event_date)));

  return (
    <div className="relative group" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Liquid Glass Background - Always showing enhanced colors */}
      <div className="absolute inset-0 bg-gradient-to-br from-background/80 via-background/40 to-background/60 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-pink-500/10 rounded-xl"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/15 via-transparent to-pink-500/15 rounded-xl"></div>
      
      {/* Drag handle with glass effect - Always enhanced */}
      <div className={`absolute top-2 z-20 p-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 bg-primary/20 border-primary/30 transition-all duration-300 cursor-grab active:cursor-grabbing scale-110 ${language === 'ar' ? 'right-2' : 'left-2'}`}>
        <Hand className="h-3 w-3 text-primary/70" />
      </div>

      {/* Content */}
      <div className="relative z-10 p-6 pt-12">
        <div className="flex items-center gap-2 mb-4">
          <Heart className="h-5 w-5 text-purple-500" />
          <h3 className="font-semibold text-lg bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
            {t("maw3dEvents", language)}
          </h3>
        </div>

        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin h-6 w-6 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
                <div className="font-bold text-lg text-purple-500">{events.length}</div>
                <div className="text-xs text-purple-600">{language === 'ar' ? 'إجمالي' : 'Total'}</div>
                {todayEvents.length > 0 && (
                  <div className="mt-1 text-xs text-orange-600">
                    {todayEvents.length} {language === 'ar' ? 'اليوم' : 'today'}
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-pink-500/10 border border-pink-500/20 text-center">
                <div className="font-bold text-lg text-pink-500">{upcomingEvents.length}</div>
                <div className="text-xs text-pink-600">{language === 'ar' ? 'قادم' : 'Upcoming'}</div>
                {tomorrowEvents.length > 0 && (
                  <div className="mt-1 text-xs text-blue-600">
                    {tomorrowEvents.length} {language === 'ar' ? 'غداً' : 'tomorrow'}
                  </div>
                )}
              </div>
            </div>

            {/* Upcoming Events */}
            {upcomingEvents.length > 0 && (
              <div className="space-y-2 mb-4">
                <h4 className="text-xs font-medium text-muted-foreground">
                  {language === 'ar' ? 'الأحداث القادمة' : 'Next Events'}
                </h4>
                {upcomingEvents.slice(0, 2).map((event) => (
                  <div key={event.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/10 backdrop-blur-sm">
                    <Heart className="h-3 w-3 text-purple-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{event.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{format(parseISO(event.event_date), "MMM d")}</span>
                        {event.location && (
                          <>
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{event.location}</span>
                          </>
                        )}
                        {attendingCounts[event.id] > 0 && (
                          <>
                            <Users className="h-3 w-3" />
                            <span>{attendingCounts[event.id]} attending</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <Button 
          variant="outline" 
          size="sm" 
          className="w-full bg-white/10 backdrop-blur-sm border-white/20 bg-purple-500/20 border-purple-500/40 transition-all duration-300" 
          onClick={() => navigate('/maw3d-events')}
        >
          <Plus className="h-4 w-4 mr-2" />
          {language === 'ar' ? 'فتح Maw3d' : 'Open Maw3d'}
        </Button>
      </div>
    </div>
  );
};
