import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, Clock, MapPin, Users, Edit, Share2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Maw3dService } from '@/services/maw3dService';
import { ShareService } from '@/services/shareService';
import { Maw3dEvent } from '@/types/maw3d';

export default function Maw3dEvents() {
  const navigate = useNavigate();
  const { user } = useAuth();
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
    console.log('=== EVENT CLICK DEBUG ===');
    console.log('Event clicked:', event.id);
    console.log('Event title:', event.title);
    console.log('Event created_by:', event.created_by);
    console.log('Current user ID:', user?.id);
    console.log('User object:', user);
    console.log('Are they equal?', event.created_by === user?.id);
    console.log('Types - event.created_by:', typeof event.created_by, 'user?.id:', typeof user?.id);
    
    // If user created this event, go to management view
    if (event.created_by === user?.id) {
      console.log('✅ User is creator - navigating to management view');
      console.log('Management URL:', `/maw3d/manage/${event.id}`);
      navigate(`/maw3d/manage/${event.id}`);
    } else {
      console.log('👥 User is invitee - navigating to public view');
      console.log('Public URL:', `/maw3d/${event.short_id}`);
      // If user is invited to this event, go to public view
      navigate(`/maw3d/${event.short_id}`);
    }
    console.log('=== END EVENT CLICK DEBUG ===');
  };

  const handleShare = async (event: Maw3dEvent, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event click
    console.log('=== SHARE DEBUG START ===');
    console.log('Share button clicked for event:', event.id, 'short_id:', event.short_id);
    console.log('Event object:', event);
    
    if (!event.short_id) {
      console.error('No short_id found for event:', event.id);
      toast.error('Cannot generate link for this event');
      return;
    }
    
    try {
      console.log('Calling ShareService.shareEvent...');
      await ShareService.shareEvent(event.id, event.short_id);
      console.log('ShareService.shareEvent completed successfully');
    } catch (error) {
      console.error('Error in handleShare:', error);
      toast.error('Failed to share event');
    }
    console.log('=== SHARE DEBUG END ===');
  };

  const handleEdit = (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event click
    navigate(`/maw3d/edit/${eventId}`);
  };

  const handleDelete = async (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event click
    
    if (!confirm('Are you sure you want to delete this event?')) return;
    
    try {
      await Maw3dService.deleteEvent(eventId);
      setEvents(events.filter(event => event.id !== eventId));
      toast.success('Event deleted successfully');
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Failed to delete event');
    }
  };

  const formatEventTime = (event: Maw3dEvent) => {
    if (event.is_all_day) {
      return 'All Day';
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
      <div className="min-h-screen bg-background p-4 pb-20">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Maw3d Events</h1>
          <p className="text-muted-foreground mt-2">Create and manage your events</p>
        </div>
        <Button onClick={() => navigate('/maw3d/create')} className="gap-2">
          <Plus className="w-4 h-4" />
          Create Event
        </Button>
      </div>

      {/* Debug Current User */}
      <Card className="mb-6 border-dashed">
        <CardContent className="p-4">
          <div className="text-xs space-y-1 text-muted-foreground">
            <div>Current User ID: {user?.id || 'No user'}</div>
            <div>Current User Email: {user?.email || 'No email'}</div>
            <div>Events Count: {events.length}</div>
          </div>
        </CardContent>
      </Card>

      {/* Events Grid */}
      {events.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No events yet</h3>
          <p className="text-muted-foreground mb-6">
            Create your first event to get started
          </p>
          <Button onClick={() => navigate('/maw3d/create')}>
            <Plus className="w-4 h-4 mr-2" />
            Create Event
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Card key={event.id} className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow">
              <div 
                className="relative h-48 flex items-end p-4"
                style={getBackgroundStyle(event)}
                onClick={() => handleEventClick(event)}
              >
                {/* Overlay for better text readability */}
                <div className="absolute inset-0 bg-black/20" />
                
                <div className="relative text-white">
                  <h3 className="font-bold text-xl mb-1">{event.title}</h3>
                  {event.description && (
                    <p className="text-sm opacity-90 line-clamp-2">{event.description}</p>
                  )}
                </div>
              </div>
              
              <CardContent className="p-4">
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>{format(new Date(event.event_date), 'EEEE, MMMM d, yyyy')}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{formatEventTime(event)}</span>
                  </div>

                  {event.location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span className="truncate">{event.location}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Badge variant={event.created_by === user?.id ? "default" : "secondary"}>
                      {event.created_by === user?.id ? "Created by You" : "Invited"}
                    </Badge>
                    {event.is_public && (
                      <Badge variant="outline">Public</Badge>
                    )}
                  </div>
                </div>

                {/* Event Debug Info */}
                <div className="text-xs text-muted-foreground mb-2 p-2 bg-muted/50 rounded">
                  <div>Event ID: {event.id}</div>
                  <div>Created By: {event.created_by}</div>
                  <div>Is Creator: {(event.created_by === user?.id).toString()}</div>
                </div>

                {/* Action buttons - only show for events created by user */}
                {event.created_by === user?.id && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleEdit(event.id, e)}
                      className="flex-1"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleShare(event, e)}
                      className="flex-1"
                    >
                      <Share2 className="w-4 h-4 mr-1" />
                      Share
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleDelete(event.id, e)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
