import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Calendar, MapPin, Users, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOptimizedMaw3dEvents } from '@/hooks/useOptimizedMaw3dEvents';
import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns';
import { t } from '@/utils/translations';
import { useTheme } from '@/providers/ThemeProvider';
import { waktiNotifications } from '@/services/waktiNotifications';
import { useAuth } from '@/contexts/AuthContext';

export default function Maw3dEvents() {
  const navigate = useNavigate();
  const { language } = useTheme();
  const { user } = useAuth();
  const { events, attendingCounts, loading } = useOptimizedMaw3dEvents();
  const [searchQuery, setSearchQuery] = useState('');

  // Initialize WAKTI notification service and clear badges
  useEffect(() => {
    if (user?.id) {
      console.log('🔥 Initializing WAKTI notification service for Maw3d events page');
      waktiNotifications.startNotificationProcessor(user.id);
    }

    // Clear Maw3d event badges when visiting this page
    console.log('🧹 Clearing Maw3d badges on page visit');
    waktiNotifications.clearBadgeOnPageVisit('maw3d');

    return () => {
      waktiNotifications.stopNotificationProcessor();
    };
  }, [user?.id]);

  const filteredEvents = events.filter(event =>
    event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    event.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    event.location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getEventStatus = (event: any) => {
    const eventDate = parseISO(event.event_date);
    if (isToday(eventDate)) return 'today';
    if (isTomorrow(eventDate)) return 'tomorrow';
    if (isPast(eventDate)) return 'past';
    return 'upcoming';
  };

  const getBackgroundStyle = (event: any) => {
    switch (event.background_type) {
      case 'color':
        return { backgroundColor: event.background_value };
      case 'gradient':
        return { background: event.background_value };
      case 'image':
      case 'ai':
        return { 
          backgroundImage: `url(${event.background_value})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        };
      default:
        return { backgroundColor: '#3b82f6' };
    }
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="p-4 pb-24">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="p-4 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{t("maw3dEvents", language)}</h1>
            <p className="text-sm text-muted-foreground">{t("createAndManageEvents", language)}</p>
          </div>
          <Button onClick={() => navigate('/maw3d/create')} className="gap-2">
            <Plus className="w-4 h-4" />
            {t("createEvent", language)}
          </Button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder={t("searchEvents", language)}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-border rounded-lg bg-background"
          />
        </div>

        {/* Events List */}
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">{t("noEventsYet", language)}</h3>
            <p className="text-muted-foreground mb-4">{t("createFirstEvent", language)}</p>
            <Button onClick={() => navigate('/maw3d/create')}>
              <Plus className="w-4 h-4 mr-2" />
              {t("createEvent", language)}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEvents.map((event) => {
              const status = getEventStatus(event);
              const attendingCount = attendingCounts[event.id] || 0;
              
              return (
                <Card key={event.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div 
                    className="h-20 relative"
                    style={getBackgroundStyle(event)}
                  >
                    <div className="absolute inset-0 bg-black/20" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <h3 
                        className="font-bold text-lg text-center px-4"
                        style={{
                          fontSize: `${(event?.text_style?.fontSize || 16) + 2}px`,
                          fontFamily: event?.text_style?.fontFamily || 'Arial',
                          fontWeight: event?.text_style?.isBold ? 'bold' : 'normal',
                          fontStyle: event?.text_style?.isItalic ? 'italic' : 'normal',
                          textDecoration: event?.text_style?.isUnderline ? 'underline' : 'none',
                          textShadow: event?.text_style?.hasShadow ? '2px 2px 4px rgba(0,0,0,0.5)' : 'none',
                          textAlign: event?.text_style?.alignment as any || 'center',
                          color: event?.text_style?.color || '#000000'
                        }}
                      >
                        {event.title}
                      </h3>
                    </div>
                  </div>
                  
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>{format(parseISO(event.event_date), 'MMM d, yyyy')}</span>
                        {!event.is_all_day && event.start_time && (
                          <>
                            <Clock className="w-4 h-4 ml-2" />
                            <span>{event.start_time}</span>
                          </>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        status === 'today' ? 'bg-green-100 text-green-800' :
                        status === 'tomorrow' ? 'bg-blue-100 text-blue-800' :
                        status === 'past' ? 'bg-gray-100 text-gray-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {status === 'today' ? t("today", language) :
                         status === 'tomorrow' ? t("tomorrow", language) :
                         status === 'past' ? t("past", language) :
                         t("upcoming", language)}
                      </span>
                    </div>

                    {event.location && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <MapPin className="w-4 h-4" />
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                      <Users className="w-4 h-4" />
                      <span>{attendingCount} {t("attending", language)}</span>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/maw3d/manage/${event.id}`)}
                        className="flex-1"
                      >
                        {t("manageEvent", language)}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/maw3d/edit/${event.id}`)}
                        className="flex-1"
                      >
                        {t("editEvent", language)}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
