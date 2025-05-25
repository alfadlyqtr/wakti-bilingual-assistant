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

  // Get background and text style from event
  const getBackgroundStyle = () => {
    if (!event) return {};
    
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

  const getTextStyle = () => {
    if (!event?.text_style) return { color: '#ffffff' };
    
    const textStyle = event.text_style;
    return {
      fontSize: `${textStyle.fontSize}px`,
      fontFamily: textStyle.fontFamily,
      fontWeight: textStyle.isBold ? 'bold' : 'normal',
      fontStyle: textStyle.isItalic ? 'italic' : 'normal',
      textDecoration: textStyle.isUnderline ? 'underline' : 'none',
      textShadow: textStyle.hasShadow ? '2px 2px 4px rgba(0,0,0,0.5)' : 'none',
      color: textStyle.color
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
  const backgroundStyle = getBackgroundStyle();
  const textStyle = getTextStyle();

  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div 
          className="border border-border rounded-lg shadow-md overflow-hidden"
          style={backgroundStyle}
        >
          {/* Overlay for better readability */}
          <div className="bg-black/20">
            <div className="p-6 space-y-8" style={textStyle}>
              
              {/* Event Preview Section with same background as footer */}
              <div className="space-y-6">
                <div className="backdrop-blur-sm bg-white/20 p-4 rounded-lg border border-white/30">
                  <EventPreview
                    event={event}
                    textStyle={event.text_style}
                    backgroundType="transparent"
                    backgroundValue=""
                    rsvpCount={rsvpCounts}
                    showAttendingCount={event.show_attending_count}
                  />
                </div>
              </div>

              {/* Add to Calendar and Location Section */}
              {(calendarEvent || event.location || event.google_maps_link) && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Add to Calendar & Location</h3>
                  
                  <div className="flex flex-col gap-4">
                    {calendarEvent && (
                      <div className="flex justify-center">
                        <div className="bg-white/20 px-4 py-2 rounded-lg border border-white/30">
                          <div className="[&_button]:bg-white [&_button]:text-black [&_button]:hover:bg-white [&_button]:hover:text-black">
                            <CalendarDropdown event={calendarEvent} />
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {(event.location || event.google_maps_link) && (
                      <div className="flex items-center justify-center gap-3">
                        <MapPin className="w-5 h-5" />
                        <span>{event.location || 'View Location'}</span>
                        {event.google_maps_link && (
                          <a 
                            href={event.google_maps_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline ml-2"
                          >
                            View on Maps
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* RSVP Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Are you attending?</h3>
                
                {/* Name input field for ALL users */}
                <div className="mb-4">
                  <Input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full bg-white/90 text-black"
                    disabled={hasResponded || isSubmitting}
                  />
                  {guestNameConflict && (
                    <p className="text-sm mt-1">
                      Someone with this name has already responded
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => handleRsvp('accepted')}
                    disabled={hasResponded || isSubmitting || !guestName.trim() || guestNameConflict}
                    className="flex-1 h-12 text-base font-medium bg-green-600 text-white hover:bg-green-700 border-2 border-green-600 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {isSubmitting ? 'Processing...' : 'Accept'}
                  </Button>
                  <Button
                    onClick={() => handleRsvp('declined')}
                    disabled={hasResponded || isSubmitting || !guestName.trim() || guestNameConflict}
                    className="flex-1 h-12 text-base font-medium bg-red-600 text-white hover:bg-red-700 border-2 border-red-600 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {isSubmitting ? 'Processing...' : 'Decline'}
                  </Button>
                </div>

                {hasResponded && (
                  <div className="mt-3 text-sm text-center opacity-90">
                    {user && userRsvp ? (
                      `You have ${userRsvp.response === 'accepted' ? 'accepted' : 'declined'} this invitation`
                    ) : (
                      'You have already responded to this invitation'
                    )}
                  </div>
                )}

                {!guestName.trim() && !hasResponded && (
                  <div className="mt-3 text-sm text-center opacity-90">
                    Please enter your name to respond
                  </div>
                )}

                {event.show_attending_count && (
                  <div className="flex items-center justify-center gap-3 mt-4 pt-4 border-t border-white/20">
                    <Users className="w-5 h-5" />
                    <span className="text-sm">
                      {rsvpCounts.accepted} attending, {rsvpCounts.declined} declined
                    </span>
                  </div>
                )}
              </div>

              {/* Styled Powered by WAKTI */}
              <div className="flex justify-center pt-4">
                <div className="bg-white/20 px-4 py-2 rounded-lg border border-white/30">
                  <span className="text-sm">
                    Powered by{' '}
                    <a 
                      href="https://wakti.qa" 
                      className="underline decoration-2 underline-offset-2 font-semibold"
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
      </div>
    </div>
  );
}
