
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Calendar, Clock, MapPin, Users, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { EventPreview } from '@/components/maw3d/EventPreview';
import { Maw3dService } from '@/services/maw3dService';
import { Maw3dEvent, Maw3dRsvp } from '@/types/maw3d';
import CalendarDropdown from '@/components/events/CalendarDropdown';

export default function Maw3dView() {
  const { shortId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState<Maw3dEvent | null>(null);
  const [rsvps, setRsvps] = useState<Maw3dRsvp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [eventNotFound, setEventNotFound] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [userRsvp, setUserRsvp] = useState<Maw3dRsvp | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmittedResponse, setHasSubmittedResponse] = useState(false);

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
        setEventNotFound(true);
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
        if (userResponse) {
          setHasSubmittedResponse(true);
        }
      }
    } catch (error) {
      setEventNotFound(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRsvp = async (response: 'accepted' | 'declined') => {
    if (!event) return;
    
    // Prevent multiple submissions
    if (isSubmitting || hasSubmittedResponse) {
      return;
    }
    
    const trimmedName = guestName.trim();
    if (!trimmedName) {
      toast.error('Please enter your name');
      return;
    }

    // Additional check for logged-in users
    if (user && userRsvp) {
      toast.error('You have already responded to this invitation');
      return;
    }

    setIsSubmitting(true);

    try {
      if (user) {
        // User is logged in - use createRsvp which handles upsert
        await Maw3dService.createRsvp(event.id, response);
      } else {
        // Guest RSVP - createRsvp will handle duplicate checking
        await Maw3dService.createRsvp(event.id, response, trimmedName);
      }
      
      // Mark as submitted immediately to prevent further attempts
      setHasSubmittedResponse(true);
      
      // Refresh data
      await fetchEvent();
      
      // Show personalized message with slight delay to ensure state is updated
      setTimeout(() => {
        const displayName = user ? (user.user_metadata?.display_name || user.email?.split('@')[0] || 'there') : trimmedName;
        if (response === 'accepted') {
          toast.success(`Thank you for accepting, ${displayName}!`);
        } else {
          toast.success(`It's okay, ${displayName}, we would have liked your presence`);
        }
      }, 200);
      
    } catch (error: any) {
      // Handle specific error messages
      if (error.message?.includes('already responded')) {
        toast.error('Someone with this name has already responded to this event');
        setHasSubmittedResponse(true); // Prevent further attempts
      } else {
        toast.error('Failed to submit RSVP. Please try again.');
        setHasSubmittedResponse(false); // Allow retry on other errors
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRsvpCounts = () => {
    const accepted = rsvps.filter(rsvp => rsvp.response === 'accepted').length;
    const declined = rsvps.filter(rsvp => rsvp.response === 'declined').length;
    return { accepted, declined };
  };

  // Check if user has already responded
  const hasResponded = user ? !!userRsvp : hasSubmittedResponse;
  
  // Check if current guest name conflicts with existing RSVPs (case-insensitive)
  const guestNameConflict = !user && guestName.trim() && rsvps.some(rsvp => 
    rsvp.guest_name && 
    rsvp.guest_name.toLowerCase() === guestName.trim().toLowerCase()
  );

  // Prepare event data for calendar integration
  const getCalendarEvent = () => {
    if (!event) return null;
    
    const eventDate = new Date(event.event_date);
    let startTime: Date;
    let endTime: Date;
    
    if (event.is_all_day) {
      startTime = new Date(eventDate);
      endTime = new Date(eventDate);
      endTime.setDate(endTime.getDate() + 1);
    } else {
      const [startHours, startMinutes] = (event.start_time || '09:00').split(':');
      const [endHours, endMinutes] = (event.end_time || '17:00').split(':');
      
      startTime = new Date(eventDate);
      startTime.setHours(parseInt(startHours), parseInt(startMinutes));
      
      endTime = new Date(eventDate);
      endTime.setHours(parseInt(endHours), parseInt(endMinutes));
    }
    
    return {
      title: event.title,
      description: event.description || '',
      location: event.location || '',
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      is_all_day: event.is_all_day
    };
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

  if (eventNotFound || !event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Event not found</h1>
          <p className="text-muted-foreground">This event link may be invalid or the event may have been deleted.</p>
          <Button onClick={() => navigate('/')} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  const rsvpCounts = getRsvpCounts();
  const calendarEvent = getCalendarEvent();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="border border-border rounded-lg shadow-md p-6 space-y-8">
          {/* Event Preview Section */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Event Preview</h3>
              <EventPreview
                event={event}
                textStyle={event.text_style}
                backgroundType={event.background_type}
                backgroundValue={event.background_value}
                rsvpCount={rsvpCounts}
                showAttendingCount={event.show_attending_count}
              />
            </CardContent>
          </Card>

          {/* Add to Calendar Section */}
          {calendarEvent && (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Add to Calendar</h3>
                <div className="flex justify-center">
                  <CalendarDropdown event={calendarEvent} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Event Details Section (Simplified) */}
          <Card>
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

          {/* RSVP Section - Moved to bottom above footer */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Are you attending?</h3>
              
              {/* Name input field for ALL users */}
              <div className="mb-4">
                <Input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full"
                  disabled={hasResponded || isSubmitting}
                />
                {guestNameConflict && (
                  <p className="text-sm text-destructive mt-1">
                    Someone with this name has already responded
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => handleRsvp('accepted')}
                  disabled={hasResponded || isSubmitting || !guestName.trim() || guestNameConflict}
                  className="flex-1 h-12 text-base font-medium bg-primary text-primary-foreground hover:bg-primary/90 border-2 border-primary transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isSubmitting ? 'Processing...' : 'Accept'}
                </Button>
                <Button
                  onClick={() => handleRsvp('declined')}
                  disabled={hasResponded || isSubmitting || !guestName.trim() || guestNameConflict}
                  className="flex-1 h-12 text-base font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 border-2 border-destructive transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isSubmitting ? 'Processing...' : 'Decline'}
                </Button>
              </div>

              {hasResponded && (
                <div className="mt-3 text-sm text-muted-foreground text-center">
                  {user && userRsvp ? (
                    `You have ${userRsvp.response === 'accepted' ? 'accepted' : 'declined'} this invitation`
                  ) : (
                    'You have already responded to this invitation'
                  )}
                </div>
              )}

              {!guestName.trim() && !hasResponded && (
                <div className="mt-3 text-sm text-muted-foreground text-center">
                  Please enter your name to respond
                </div>
              )}

              {event.show_attending_count && (
                <div className="flex items-center justify-center gap-3 mt-4 pt-4 border-t">
                  <Users className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {rsvpCounts.accepted} attending, {rsvpCounts.declined} declined
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Styled Powered by WAKTI */}
          <div className="flex justify-center">
            <div className="bg-primary/10 dark:bg-primary/20 px-4 py-2 rounded-lg border border-primary/20">
              <span className="text-sm text-muted-foreground">
                Powered by{' '}
                <a 
                  href="https://wakti.qa" 
                  className="text-primary hover:text-primary/80 transition-colors underline decoration-2 underline-offset-2 font-semibold"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WAKTI
                </a>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
