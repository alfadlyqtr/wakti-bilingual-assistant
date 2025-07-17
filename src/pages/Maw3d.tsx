import React, { useState, useEffect } from 'react';
import { NavigationHeader } from '@/components/navigation/NavigationHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Users, Plus, Share2, Eye, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '@/providers/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CreateEventDialog } from '@/components/maw3d/CreateEventDialog';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';

interface Maw3dEvent {
  id: string;
  created_at: string;
  created_by: string;
  title: string;
  description: string;
  location: string;
  event_date: string;
  event_time: string;
  rsvps?: any[];
}

const Maw3d = () => {
  const [events, setEvents] = useState<Maw3dEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { maw3dEventCount } = useUnreadMessages();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchEvents = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('maw3d_events')
          .select('*')
          .eq('created_by', user.id)
          .order('event_date', { ascending: true });

        if (error) {
          throw error;
        }

        if (data) {
          setEvents(data);
        }
      } catch (error: any) {
        console.error("Error fetching events:", error.message);
        toast.error("Failed to load events.");
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();

    // Setup real-time subscription for new events
    const maw3dChannel = supabase
      .channel('maw3d-events')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maw3d_events' },
        (payload) => {
          console.log('Realtime event received:', payload);
          fetchEvents(); // Refresh events on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(maw3dChannel);
    };
  }, [user, navigate]);

  const handleEventCreated = (newEvent: Maw3dEvent) => {
    setEvents([...events, newEvent]);
    setOpenCreateDialog(false);
  };

  const handleEventUpdated = (updatedEvent: Maw3dEvent) => {
    setEvents(events.map(event => event.id === updatedEvent.id ? updatedEvent : event));
  };

  const handleEventDeleted = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from('maw3d_events')
        .delete()
        .eq('id', eventId);

      if (error) {
        throw error;
      }

      setEvents(events.filter(event => event.id !== eventId));
      toast.success("Event deleted successfully!");
    } catch (error: any) {
      console.error("Error deleting event:", error.message);
      toast.error("Failed to delete event.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader />
      <main className="container mx-auto px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              My Events
            </h1>
            <p className="text-muted-foreground">
              Organize and manage your events.
            </p>
          </div>
          <Button onClick={() => setOpenCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Event
          </Button>
        </div>

        {loading ? (
          <p>Loading events...</p>
        ) : events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onUpdate={handleEventUpdated}
                onDelete={handleEventDeleted}
              />
            ))}
          </div>
        ) : (
          <p>No events created yet. Create one to get started!</p>
        )}
      </main>

      <CreateEventDialog
        open={openCreateDialog}
        onOpenChange={setOpenCreateDialog}
        onEventCreated={handleEventCreated}
      />
    </div>
  );
};

interface EventCardProps {
  event: Maw3dEvent;
  onUpdate: (event: Maw3dEvent) => void;
  onDelete: (eventId: string) => void;
}

const EventCard: React.FC<EventCardProps> = ({ event, onDelete, onUpdate }) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const rsvpCount = event.rsvps ? event.rsvps.length : 0;
  const eventDateTime = new Date(`${event.event_date}T${event.event_time}`);

  const handleUpdate = (updatedEvent: Maw3dEvent) => {
    onUpdate(updatedEvent);
    setIsEditModalOpen(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {event.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4" />
          <span>{format(eventDateTime, 'PPP')}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4" />
          <span>{format(eventDateTime, 'p')}</span>
        </div>
        <div className="flex items-center space-x-2">
          <MapPin className="h-4 w-4" />
          <span>{event.location}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Users className="h-4 w-4" />
          <span>
            {rsvpCount} {rsvpCount === 1 ? 'RSVP' : 'RSVPs'}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{event.description}</p>

        <div className="flex justify-end space-x-2">
          <Button variant="ghost" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button variant="ghost" size="sm">
            <Eye className="h-4 w-4 mr-2" />
            View
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsEditModalOpen(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onDelete(event.id)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </CardContent>

      <EditEventDialog
        isOpen={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        event={event}
        onUpdate={handleUpdate}
      />
    </Card>
  );
};

interface EditEventDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  event: Maw3dEvent;
  onUpdate: (event: Maw3dEvent) => void;
}

const EditEventDialog: React.FC<EditEventDialogProps> = ({ isOpen, onOpenChange, event, onUpdate }) => {
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description);
  const [location, setLocation] = useState(event.location);
  const [eventDate, setEventDate] = useState(event.event_date);
  const [eventTime, setEventTime] = useState(event.event_time);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('maw3d_events')
        .update({
          title,
          description,
          location,
          event_date: eventDate,
          event_time: eventTime,
        })
        .eq('id', event.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        onUpdate(data);
        toast.success("Event updated successfully!");
      }
    } catch (error: any) {
      console.error("Error updating event:", error.message);
      toast.error("Failed to update event.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Event</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="location" className="text-right">
              Location
            </Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="event_date" className="text-right">
              Date
            </Label>
            <Input
              type="date"
              id="event_date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="event_time" className="text-right">
              Time
            </Label>
            <Input
              type="time"
              id="event_time"
              value={eventTime}
              onChange={(e) => setEventTime(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>
        <Button onClick={handleUpdate} disabled={loading}>
          {loading ? "Updating..." : "Update Event"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default Maw3d;
