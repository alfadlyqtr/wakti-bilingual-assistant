import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, Clock, MapPin, Edit, Share2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Maw3dService } from '@/services/maw3dService';
import { ShareService } from '@/services/shareService';
import { Maw3dEvent } from '@/types/maw3d';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

export default function Maw3dEvents() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useTheme();
  const [events, setEvents] = useState<Maw3dEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      const userEvents = await Maw3dService.getUserEvents();
      setEvents(userEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error('Failed to load events');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEventClick = (event: Maw3dEvent) => {
    console.log('Event clicked:', event.id);
    // Navigate to management view since users only see their own events now
    navigate(`/maw3d/manage/${event.id}`);
  };

  const handleShare = async (event: Maw3dEvent, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event click
    console.log('Share button clicked for event:', event.id, 'shortId:', event.short_id);
    
    try {
      // Pass both eventId and shortId to ShareService
      await ShareService.shareEvent(event.id, event.short_id);
    } catch (error) {
      console.error('Error in handleShare:', error);
      toast.error('Failed to share event');
    }
  };

  const handleEdit = (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event click
    navigate(`/maw3d/edit/${eventId}`);
  };

  const handleDelete = async (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event click
    
    if (!confirm(t("confirmDeleteEvent", language))) return;
    
    try {
      await Maw3dService.deleteEvent(eventId);
      setEvents(events.filter(event => event.id !== eventId));
      toast.success(t("eventDeleted", language));
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Failed to delete event');
    }
  };

  const formatEventTime = (event: Maw3dEvent) => {
    if (event.is_all_day) {
      return t("allDay", language);
    }
    
    const formatTime = (time: string) => {
      if (!time) return '';
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours);
      const minute = parseInt(minutes);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
    };

    return `${formatTime(event.start_time || '')} - ${formatTime(event.end_time || '')}`;
  };

  const getBackgroundStyle = (event: Maw3dEvent) => {
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

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto bg-background p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="p-4 pb-24">
        {/* Create Event Button */}
        <div className="flex justify-end mb-6">
          <Button onClick={() => navigate('/maw3d/create')} className="gap-2">
            <Plus className="w-4 h-4" />
            {t("createEvent", language)}
          </Button>
        </div>

        {/* Events List - Stacked Layout */}
        {events.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">{t("noEventsYet", language)}</h3>
            <p className="text-muted-foreground mb-6">
              {t("createFirstEvent", language)}
            </p>
            <Button onClick={() => navigate('/maw3d/create')}>
              <Plus className="w-4 h-4 mr-2" />
              {t("createEvent", language)}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {events.map((event) => (
              <Card key={event.id} className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow">
                <div 
                  className="relative h-56 flex items-end p-6"
                  style={getBackgroundStyle(event)}
                  onClick={() => handleEventClick(event)}
                >
                  {/* Overlay for better text readability */}
                  <div className="absolute inset-0 bg-black/30" />
                  
                  <div className="relative text-white w-full">
                    <h3 className="font-bold text-2xl mb-2">{event.title}</h3>
                    {event.description && (
                      <p className="text-lg opacity-90 line-clamp-2">{event.description}</p>
                    )}
                  </div>
                </div>
                
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Calendar className="w-5 h-5" />
                      <span className="text-base">{format(new Date(event.event_date), 'EEEE, MMMM d, yyyy')}</span>
                    </div>
                    
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Clock className="w-5 h-5" />
                      <span className="text-base">{formatEventTime(event)}</span>
                    </div>

                    {event.location && (
                      <div className="flex items-center gap-3 text-muted-foreground sm:col-span-2">
                        <MapPin className="w-5 h-5" />
                        <span className="text-base">{event.location}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Badge variant="default" className="text-sm px-3 py-1">
                        {t("yourEvent", language)}
                      </Badge>
                      {event.is_public && (
                        <Badge variant="outline" className="text-sm px-3 py-1">{t("publicEvent", language)}</Badge>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="grid grid-cols-3 gap-3">
                    <Button
                      variant="outline"
                      onClick={(e) => handleEdit(event.id, e)}
                      className="flex items-center justify-center gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      {t("edit", language)}
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={(e) => handleShare(event, e)}
                      className="flex items-center justify-center gap-2"
                    >
                      <Share2 className="w-4 h-4" />
                      {t("share", language)}
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={(e) => handleDelete(event.id, e)}
                      className="flex items-center justify-center gap-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t("delete", language)}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
