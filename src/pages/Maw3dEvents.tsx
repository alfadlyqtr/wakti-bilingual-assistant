
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, Clock, MapPin, Users, Share2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Maw3dService } from '@/services/maw3dService';
import { Maw3dEvent, Maw3dRsvp } from '@/types/maw3d';
import { useAuth } from '@/contexts/AuthContext';

export default function Maw3dEvents() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [events, setEvents] = useState<Maw3dEvent[]>([]);
  const [rsvpCounts, setRsvpCounts] = useState<Record<string, { accepted: number; declined: number }>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const eventsData = await Maw3dService.getUserEvents();
      setEvents(eventsData);

      // Fetch RSVP counts for each event
      const counts: Record<string, { accepted: number; declined: number }> = {};
      for (const event of eventsData) {
        const rsvps = await Maw3dService.getRsvps(event.id);
        counts[event.id] = {
          accepted: rsvps.filter(r => r.response === 'accepted').length,
          declined: rsvps.filter(r => r.response === 'declined').length
        };
      }
      setRsvpCounts(counts);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error('Failed to load events');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await Maw3dService.deleteEvent(eventId);
      toast.success('Event deleted successfully');
      fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Failed to delete event');
    }
  };

  const handleShareEvent = async (event: Maw3dEvent) => {
    if (event.is_public && event.short_id) {
      const shareUrl = `${window.location.origin}/maw3d/${event.short_id}`;
      
      if (navigator.share) {
        try {
          await navigator.share({
            title: event.title,
            text: event.description || 'Check out this event!',
            url: shareUrl
          });
        } catch (error) {
          // User cancelled sharing
        }
      } else {
        // Fallback to copying to clipboard
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Event link copied to clipboard!');
      }
    } else {
      toast.info('Only public events can be shared');
    }
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const minute = parseInt(minutes);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  const isCreator = (event: Maw3dEvent) => event.created_by === user?.id;

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto pb-16">
        <div className="p-4">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-32 bg-gray-200 rounded-lg"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pb-16">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Maw3d Events</h1>
          <Button onClick={() => navigate('/maw3d/create')}>
            <Plus className="w-4 h-4 mr-2" />
            Create Event
          </Button>
        </div>

        {/* Events List */}
        {events.length === 0 ? (
          <div className="text-center py-12">
            <CalendarClock className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No events yet</h3>
            <p className="text-gray-500 mb-4">Create your first Maw3d event to get started</p>
            <Button onClick={() => navigate('/maw3d/create')}>
              <Plus className="w-4 h-4 mr-2" />
              Create Event
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <Card key={event.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent 
                  className="p-0"
                  onClick={() => navigate(`/maw3d/${event.short_id}`)}
                >
                  <div 
                    className="relative h-32 rounded-t-lg flex items-end p-4"
                    style={{
                      background: event.background_type === 'gradient' || event.background_type === 'color'
                        ? event.background_value
                        : `url(${event.background_value})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  >
                    <div className="absolute inset-0 bg-black/20 rounded-t-lg" />
                    <div className="relative z-10 text-white">
                      <h3 
                        className="text-lg font-bold mb-1"
                        style={{
                          fontSize: `${Math.min(event.text_style.fontSize, 18)}px`,
                          fontFamily: event.text_style.fontFamily,
                          fontWeight: event.text_style.isBold ? 'bold' : 'normal',
                          fontStyle: event.text_style.isItalic ? 'italic' : 'normal',
                          textDecoration: event.text_style.isUnderline ? 'underline' : 'none',
                          textShadow: event.text_style.hasShadow ? '2px 2px 4px rgba(0,0,0,0.5)' : 'none'
                        }}
                      >
                        {event.title}
                      </h3>
                      <div className="flex items-center gap-4 text-sm opacity-90">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(event.event_date)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {event.is_all_day ? 'All Day' : `${formatTime(event.start_time || '')}`}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 space-y-3">
                    {event.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">{event.description}</p>
                    )}

                    {event.location && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <MapPin className="w-4 h-4" />
                        {event.location}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={isCreator(event) ? "default" : "secondary"}>
                          {isCreator(event) ? "Created by You" : "You're Invited"}
                        </Badge>
                        {event.is_public && (
                          <Badge variant="outline">Public</Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Users className="w-4 h-4" />
                        {rsvpCounts[event.id]?.accepted || 0} attending
                      </div>
                    </div>

                    {isCreator(event) && (
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/maw3d/edit/${event.id}`);
                          }}
                        >
                          Edit
                        </Button>
                        {event.is_public && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShareEvent(event);
                            }}
                          >
                            <Share2 className="w-4 h-4 mr-1" />
                            Share
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEvent(event.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    )}
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
