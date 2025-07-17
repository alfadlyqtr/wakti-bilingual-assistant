
import React, { useState, useEffect } from 'react';
import { NavigationHeader } from '@/components/navigation/NavigationHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/providers/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  ArrowLeft, Calendar, MapPin, Users, Clock, Heart, 
  Edit, Share2, CheckCircle, XCircle, HelpCircle 
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

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

interface RSVP {
  id: string;
  event_id: string;
  user_id: string;
  guest_name: string;
  guest_email?: string;
  response: 'attending' | 'not_attending' | 'maybe';
  created_at: string;
}

const Maw3dManage = () => {
  const [event, setEvent] = useState<Event | null>(null);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { eventId } = useParams();

  useEffect(() => {
    if (!user || !eventId) return;
    fetchEventAndRsvps();
  }, [user, eventId]);

  const fetchEventAndRsvps = async () => {
    try {
      // Fetch event
      const { data: eventData, error: eventError } = await supabase
        .from('maw3d_events')
        .select('*')
        .eq('id', eventId)
        .eq('created_by', user?.id)
        .single();

      if (eventError) throw eventError;
      setEvent(eventData);

      // Fetch RSVPs
      const { data: rsvpData, error: rsvpError } = await supabase
        .from('maw3d_rsvps')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (rsvpError) throw rsvpError;
      setRsvps(rsvpData || []);
    } catch (error: any) {
      console.error('Error fetching event data:', error);
      toast.error('Failed to load event');
      navigate('/maw3d-events');
    } finally {
      setLoading(false);
    }
  };

  const getResponseIcon = (response: string) => {
    switch (response) {
      case 'attending':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'not_attending':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'maybe':
        return <HelpCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getResponseColor = (response: string) => {
    switch (response) {
      case 'attending':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'not_attending':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'maybe':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const attendingRsvps = rsvps.filter(rsvp => rsvp.response === 'attending');
  const notAttendingRsvps = rsvps.filter(rsvp => rsvp.response === 'not_attending');
  const maybeRsvps = rsvps.filter(rsvp => rsvp.response === 'maybe');

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

  if (!event) {
    return (
      <div className="min-h-screen bg-background">
        <NavigationHeader />
        <div className="container mx-auto p-4">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">Event not found or you don't have permission to manage it.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader />
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/maw3d-events')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Events
          </Button>
          <h1 className="text-2xl font-bold text-foreground mb-2">Manage Event</h1>
          <p className="text-muted-foreground">View RSVPs and manage your event.</p>
        </div>

        {/* Event Details */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-semibold">{event.title}</h2>
                {event.description && (
                  <p className="text-muted-foreground mt-1">{event.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{event.short_id}</Badge>
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

        {/* RSVP Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{attendingRsvps.length}</div>
              <div className="text-sm text-muted-foreground">Attending</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">{maybeRsvps.length}</div>
              <div className="text-sm text-muted-foreground">Maybe</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{notAttendingRsvps.length}</div>
              <div className="text-sm text-muted-foreground">Not Attending</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{rsvps.length}</div>
              <div className="text-sm text-muted-foreground">Total Responses</div>
            </CardContent>
          </Card>
        </div>

        {/* RSVP Details */}
        <Tabs defaultValue="attending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="attending">
              Attending ({attendingRsvps.length})
            </TabsTrigger>
            <TabsTrigger value="maybe">
              Maybe ({maybeRsvps.length})
            </TabsTrigger>
            <TabsTrigger value="not-attending">
              Not Attending ({notAttendingRsvps.length})
            </TabsTrigger>
            <TabsTrigger value="all">
              All Responses ({rsvps.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="attending" className="space-y-4">
            {attendingRsvps.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No one is attending yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {attendingRsvps.map((rsvp) => (
                  <Card key={rsvp.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {rsvp.guest_name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{rsvp.guest_name}</p>
                            {rsvp.guest_email && (
                              <p className="text-sm text-muted-foreground">{rsvp.guest_email}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getResponseIcon(rsvp.response)}
                          <Badge className={getResponseColor(rsvp.response)}>
                            {rsvp.response.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="maybe" className="space-y-4">
            {maybeRsvps.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No maybe responses.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {maybeRsvps.map((rsvp) => (
                  <Card key={rsvp.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {rsvp.guest_name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{rsvp.guest_name}</p>
                            {rsvp.guest_email && (
                              <p className="text-sm text-muted-foreground">{rsvp.guest_email}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getResponseIcon(rsvp.response)}
                          <Badge className={getResponseColor(rsvp.response)}>
                            {rsvp.response}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="not-attending" className="space-y-4">
            {notAttendingRsvps.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <XCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No one declined yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {notAttendingRsvps.map((rsvp) => (
                  <Card key={rsvp.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {rsvp.guest_name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{rsvp.guest_name}</p>
                            {rsvp.guest_email && (
                              <p className="text-sm text-muted-foreground">{rsvp.guest_email}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getResponseIcon(rsvp.response)}
                          <Badge className={getResponseColor(rsvp.response)}>
                            Not Attending
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            {rsvps.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No responses yet. Share your event to get RSVPs!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {rsvps.map((rsvp) => (
                  <Card key={rsvp.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {rsvp.guest_name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{rsvp.guest_name}</p>
                            {rsvp.guest_email && (
                              <p className="text-sm text-muted-foreground">{rsvp.guest_email}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {format(parseISO(rsvp.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getResponseIcon(rsvp.response)}
                          <Badge className={getResponseColor(rsvp.response)}>
                            {rsvp.response.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Maw3dManage;
