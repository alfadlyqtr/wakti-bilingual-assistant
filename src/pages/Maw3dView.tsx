import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Calendar, Clock, MapPin, Users } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { EventPreview } from '@/components/maw3d/EventPreview';
import { Maw3dService } from '@/services/maw3dService';
import { Maw3dEvent, Maw3dRsvp } from '@/types/maw3d';

export default function Maw3dView() {
  const { shortId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState<Maw3dEvent | null>(null);
  const [rsvps, setRsvps] = useState<Maw3dRsvp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [guestName, setGuestName] = useState('');
  const [userRsvp, setUserRsvp] = useState<Maw3dRsvp | null>(null);

  useEffect(() => {
    if (shortId) {
      fetchEvent();
    }
  }, [shortId]);

  const fetchEvent = async () => {
    try {
      if (!shortId) return;
      
      const eventData = await Maw3dService.getEventByShortId(shortId);
      if (!eventData) {
        toast.error('Event not found');
        navigate('/maw3d');
        return;
      }

      setEvent(eventData);
      
      // Fetch RSVPs
      const eventRsvps = await Maw3dService.getRsvps(eventData.id);
      setRsvps(eventRsvps);
      
      // Find user's RSVP if logged in
      if (user) {
        const userResponse = eventRsvps.find(rsvp => rsvp.user_id === user.id);
        setUserRsvp(userResponse || null);
      }
    } catch (error) {
      console.error('Error fetching event:', error);
      toast.error('Failed to load event');
      navigate('/maw3d');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRsvp = async (response: 'accepted' | 'declined') => {
    if (!event) return;

    try {
      if (user) {
        // User is logged in
        if (userRsvp) {
          await Maw3dService.updateRsvp(event.id, response);
        } else {
          await Maw3dService.createRsvp(event.id, response);
        }
      } else {
        // Guest RSVP
        if (!guestName.trim()) {
          toast.error('Please enter your name');
          return;
        }
        await Maw3dService.createRsvp(event.id, response, guestName.trim());
      }

      toast.success(`Successfully ${response === 'accepted' ? 'accepted' : 'declined'} the invitation!`);
      fetchEvent(); // Refresh data
    } catch (error) {
      console.error('Error updating RSVP:', error);
      toast.error('Failed to update RSVP');
    }
  };

  const getRsvpCounts = () => {
    const accepted = rsvps.filter(rsvp => rsvp.response === 'accepted').length;
    const declined = rsvps.filter(rsvp => rsvp.response === 'declined').length;
    return { accepted, declined };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
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
      <div className="min-h-screen bg-background flex items-center justify-center">
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
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

        {/* RSVP Section */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Are you attending?</h3>
            
            {!user && (
              <div className="mb-4">
                <Input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full"
                />
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={() => handleRsvp('accepted')}
                variant={userRsvp?.response === 'accepted' ? 'default' : 'outline'}
                className="flex-1 h-12 text-base font-medium border-2 transition-all duration-200 hover:scale-105"
              >
                Accept
              </Button>
              <Button
                onClick={() => handleRsvp('declined')}
                variant={userRsvp?.response === 'declined' ? 'destructive' : 'outline'}
                className="flex-1 h-12 text-base font-medium border-2 transition-all duration-200 hover:scale-105"
              >
                Decline
              </Button>
            </div>

            {userRsvp && (
              <div className="mt-3 text-sm text-muted-foreground text-center">
                You have {userRsvp.response === 'accepted' ? 'accepted' : 'declined'} this invitation
              </div>
            )}
          </CardContent>
        </Card>

        {/* Event Details */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Event Details</h3>
            
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

              {event.show_attending_count && (
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-muted-foreground" />
                  <span>
                    {rsvpCounts.accepted} attending, {rsvpCounts.declined} declined
                  </span>
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

        {/* Powered by WAKTI */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Powered by <span className="font-semibold text-primary">WAKTI</span>
          </p>
        </div>
      </div>
    </div>
  );
}
