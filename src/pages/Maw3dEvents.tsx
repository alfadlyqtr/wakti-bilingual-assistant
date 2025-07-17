
import React, { useState, useEffect } from 'react';
import { NavigationHeader } from '@/components/navigation/NavigationHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/providers/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Calendar, MapPin, Users, Clock, Heart, Edit, Share2 } from 'lucide-react';
import { format, parseISO, isFuture, isPast } from 'date-fns';

interface Event {
  id: string;
  title: string;
  description?: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  is_all_day: boolean;
  max_attendees?: number;
  created_by: string;
  created_at: string;
  short_id: string;
}

const Maw3dEvents = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    fetchEvents();
  }, [user]);

  const fetchEvents = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('maw3d_events')
        .select('*')
        .order('event_date', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error: any) {
      console.error('Error fetching events:', error);
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const myEvents = events.filter(event => event.created_by === user?.id);
  const upcomingEvents = events.filter(event => isFuture(parseISO(event.event_date)));
  const pastEvents = events.filter(event => isPast(parseISO(event.event_date)));

  const renderEventCard = (event: Event, showActions = false) => (
    <Card key={event.id}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold">{event.title}</h3>
            {event.description && (
              <p className="text-muted-foreground mt-1">{event.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{event.short_id}</Badge>
            {showActions && (
              <div className="flex gap-1">
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => navigate(`/maw3d/edit/${event.id}`)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/maw3d/e/${event.short_id}`);
                    toast.success('Event link copied to clipboard!');
                  }}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {format(parseISO(event.event_date), 'MMM d, yyyy')}
          </div>
          
          {!event.is_all_day && event.start_time && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {event.start_time}
              {event.end_time && ` - ${event.end_time}`}
            </div>
          )}
          
          {event.location && (
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {event.location}
            </div>
          )}
          
          {event.max_attendees && (
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              Max {event.max_attendees} attendees
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <NavigationHeader />
        <div className="container mx-auto p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader />
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Maw3d Events</h1>
            <p className="text-muted-foreground">Create and manage your events.</p>
          </div>
          <Button onClick={() => navigate('/maw3d/create')}>
            <Plus className="h-4 w-4 mr-2" />
            Create Event
          </Button>
        </div>

        <Tabs defaultValue="upcoming" className="space-y-4">
          <TabsList>
            <TabsTrigger value="upcoming">
              Upcoming ({upcomingEvents.length})
            </TabsTrigger>
            <TabsTrigger value="my-events">
              My Events ({myEvents.length})
            </TabsTrigger>
            <TabsTrigger value="past">
              Past ({pastEvents.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-4">
            {upcomingEvents.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No upcoming events. Create your first event!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {upcomingEvents.map((event) => renderEventCard(event))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="my-events" className="space-y-4">
            {myEvents.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">You haven't created any events yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {myEvents.map((event) => renderEventCard(event, true))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-4">
            {pastEvents.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No past events.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {pastEvents.map((event) => renderEventCard(event))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Maw3dEvents;
