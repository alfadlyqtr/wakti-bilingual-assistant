
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, Clock, MapPin, Users, Edit, Share2, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { EventPreview } from '@/components/maw3d/EventPreview';
import { Maw3dService } from '@/services/maw3dService';
import { ShareService } from '@/services/shareService';
import { Maw3dEvent, Maw3dRsvp } from '@/types/maw3d';

export default function Maw3dManage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState<Maw3dEvent | null>(null);
  const [rsvps, setRsvps] = useState<Maw3dRsvp[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchEventData();
    }
  }, [id]);

  const fetchEventData = async () => {
    try {
      if (!id) return;
      
      console.log('=== MANAGEMENT PAGE: FETCHING EVENT DATA ===');
      console.log('Event ID:', id);
      console.log('Current user ID:', user?.id);
      
      const eventData = await Maw3dService.getEvent(id);
      if (!eventData) {
        console.error('Event not found');
        toast.error('Event not found');
        navigate('/maw3d');
        return;
      }

      console.log('Event data:', eventData);
      console.log('Event created_by:', eventData.created_by);
      console.log('Current user:', user?.id);

      // Check if user is the creator
      if (eventData.created_by !== user?.id) {
        console.error('User not creator:', { eventCreatedBy: eventData.created_by, currentUser: user?.id });
        toast.error('You can only manage events you created');
        navigate('/maw3d');
        return;
      }

      setEvent(eventData);
      
      // Fetch RSVPs
      console.log('Fetching RSVPs for event:', eventData.id);
      const eventRsvps = await Maw3dService.getRsvps(eventData.id);
      console.log('Fetched RSVPs:', eventRsvps);
      setRsvps(eventRsvps);
    } catch (error) {
      console.error('Error fetching event data:', error);
      toast.error('Failed to load event data');
      navigate('/maw3d');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    if (!event?.short_id) {
      toast.error('Cannot generate link for this event');
      return;
    }
    
    try {
      await ShareService.shareEvent(event.id, event.short_id);
    } catch (error) {
      console.error('Error sharing event:', error);
      toast.error('Failed to share event');
    }
  };

  const handleDelete = async () => {
    if (!event || !confirm('Are you sure you want to delete this event?')) return;
    
    try {
      await Maw3dService.deleteEvent(event.id);
      toast.success('Event deleted successfully');
      navigate('/maw3d');
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Failed to delete event');
    }
  };

  const getRsvpCounts = () => {
    const accepted = rsvps.filter(rsvp => rsvp.response === 'accepted').length;
    const declined = rsvps.filter(rsvp => rsvp.response === 'declined').length;
    return { accepted, declined };
  };

  const formatRsvpName = (rsvp: Maw3dRsvp) => {
    console.log('Formatting RSVP name:', rsvp);
    
    // For guest users, use the guest_name
    if (rsvp.guest_name) {
      return rsvp.guest_name;
    }
    
    // For authenticated users, try to get display name from user metadata
    if (rsvp.user_id && !rsvp.guest_name) {
      // TODO: We might need to fetch user profile data here
      return 'Registered User';
    }
    
    // Fallback
    return 'Anonymous User';
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto bg-background flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-64 h-48 bg-gray-200 rounded-lg mx-auto mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-48 mx-auto mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-32 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex-1 overflow-y-auto bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Event not found</h1>
          <Button onClick={() => navigate('/maw3d')}>
            Back to Events
          </Button>
        </div>
      </div>
    );
  }

  const rsvpCounts = getRsvpCounts();
  const acceptedRsvps = rsvps.filter(rsvp => rsvp.response === 'accepted');
  const declinedRsvps = rsvps.filter(rsvp => rsvp.response === 'declined');

  console.log('=== MANAGEMENT PAGE RENDER DEBUG ===');
  console.log('Total RSVPs:', rsvps.length);
  console.log('Accepted RSVPs:', acceptedRsvps.length);
  console.log('Declined RSVPs:', declinedRsvps.length);
  console.log('All RSVPs:', rsvps);

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="p-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/maw3d')}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Events
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Manage Event</h1>
            <p className="text-muted-foreground">View RSVPs and manage your event</p>
          </div>
        </div>

        {/* Event Preview */}
        <div className="mb-8">
          <EventPreview
            event={event}
            textStyle={event.text_style}
            backgroundType={event.background_type}
            backgroundValue={event.background_value}
            rsvpCount={rsvpCounts}
            showAttendingCount={event.show_attending_count}
          />
        </div>

        {/* Management Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Event Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Button
                onClick={() => navigate(`/maw3d/edit/${event.id}`)}
                className="flex-1 gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit Event
              </Button>
              
              <Button
                variant="outline"
                onClick={handleShare}
                className="flex-1 gap-2"
              >
                <Share2 className="w-4 h-4" />
                Share Event
              </Button>
              
              <Button
                variant="destructive"
                onClick={handleDelete}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* RSVP Statistics */}
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card>
            <CardContent className="p-6 text-center">
              <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <div className="text-2xl font-bold">{rsvps.length}</div>
              <div className="text-sm text-muted-foreground">Total Responses</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
              <div className="text-2xl font-bold text-green-600">{rsvpCounts.accepted}</div>
              <div className="text-sm text-muted-foreground">Accepted</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <XCircle className="w-8 h-8 mx-auto mb-2 text-red-600" />
              <div className="text-2xl font-bold text-red-600">{rsvpCounts.declined}</div>
              <div className="text-sm text-muted-foreground">Declined</div>
            </CardContent>
          </Card>
        </div>

        {/* RSVP Lists */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Accepted RSVPs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                Attending ({acceptedRsvps.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {acceptedRsvps.length > 0 ? (
                <div className="space-y-3">
                  {acceptedRsvps.map((rsvp) => (
                    <div key={rsvp.id} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border">
                      <div className="flex-1">
                        <div className="font-medium text-green-800 dark:text-green-200">
                          {formatRsvpName(rsvp)}
                        </div>
                        <div className="text-xs text-green-600 dark:text-green-400">
                          {format(new Date(rsvp.created_at), 'MMM d, h:mm a')}
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        Accepted
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No one has accepted yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Declined RSVPs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <XCircle className="w-5 h-5" />
                Declined ({declinedRsvps.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {declinedRsvps.length > 0 ? (
                <div className="space-y-3">
                  {declinedRsvps.map((rsvp) => (
                    <div key={rsvp.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border">
                      <div className="flex-1">
                        <div className="font-medium text-red-800 dark:text-red-200">
                          {formatRsvpName(rsvp)}
                        </div>
                        <div className="text-xs text-red-600 dark:text-red-400">
                          {format(new Date(rsvp.created_at), 'MMM d, h:mm a')}
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                        Declined
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <XCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No one has declined yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Event Details */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <span>{format(new Date(event.event_date), 'EEEE, MMMM d, yyyy')}</span>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <span>
                  {event.is_all_day ? 'All Day' : `${event.start_time} - ${event.end_time}`}
                </span>
              </div>

              {event.location && (
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-muted-foreground" />
                  <span>{event.location}</span>
                  {event.google_maps_link && (
                    <a 
                      href={event.google_maps_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline ml-2"
                    >
                      View on Maps
                    </a>
                  )}
                </div>
              )}

              {event.organizer && (
                <div className="flex gap-2 pt-2">
                  <Badge variant="outline">
                    Organized by {event.organizer}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
