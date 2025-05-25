
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, Clock, MapPin, Users, Download, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Maw3dService } from '@/services/maw3dService';
import { Maw3dEvent, Maw3dRsvp } from '@/types/maw3d';
import { useAuth } from '@/contexts/AuthContext';
import { generateICSFile, downloadICSFile, generateGoogleCalendarUrl, generateOutlookCalendarUrl } from '@/utils/calendarIntegration';

export default function Maw3dView() {
  const { shortId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState<Maw3dEvent | null>(null);
  const [rsvps, setRsvps] = useState<Maw3dRsvp[]>([]);
  const [userRsvp, setUserRsvp] = useState<Maw3dRsvp | null>(null);
  const [guestName, setGuestName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

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
      const rsvpsData = await Maw3dService.getRsvps(eventData.id);
      setRsvps(rsvpsData);

      // Find user's RSVP if logged in
      if (user) {
        const userRsvpData = rsvpsData.find(r => r.user_id === user.id);
        setUserRsvp(userRsvpData || null);
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
        // Guest user
        if (!guestName.trim()) {
          toast.error('Please enter your name');
          return;
        }
        await Maw3dService.createRsvp(event.id, response, guestName.trim());
      }

      toast.success(`You have ${response} the invitation!`);
      fetchEvent(); // Refresh data
    } catch (error) {
      console.error('Error updating RSVP:', error);
      toast.error('Failed to update RSVP');
    }
  };

  const handleAddToCalendar = (type: 'ics' | 'google' | 'outlook' | 'wakti') => {
    if (!event) return;

    const calendarEvent = {
      title: event.title,
      description: event.description || '',
      location: event.location || '',
      startTime: event.is_all_day 
        ? new Date(`${event.event_date}T00:00:00`)
        : new Date(`${event.event_date}T${event.start_time}`),
      endTime: event.is_all_day
        ? new Date(`${event.event_date}T23:59:59`)
        : new Date(`${event.event_date}T${event.end_time || event.start_time}`)
    };

    switch (type) {
      case 'ics':
        downloadICSFile(calendarEvent, `${event.title}.ics`);
        break;
      case 'google':
        window.open(generateGoogleCalendarUrl(calendarEvent), '_blank');
        break;
      case 'outlook':
        window.open(generateOutlookCalendarUrl(calendarEvent), '_blank');
        break;
      case 'wakti':
        navigate('/calendar');
        break;
    }
  };

  const handleGetDirections = () => {
    if (event?.google_maps_link) {
      window.open(event.google_maps_link, '_blank');
    } else if (event?.location) {
      const searchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`;
      window.open(searchUrl, '_blank');
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
    return format(new Date(dateString), 'EEEE, MMMM d, yyyy');
  };

  const acceptedRsvps = rsvps.filter(r => r.response === 'accepted');
  const declinedRsvps = rsvps.filter(r => r.response === 'declined');

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
          <h1 className="text-2xl font-bold mb-2">Event Not Found</h1>
          <p className="text-gray-600 mb-4">The event you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => navigate('/maw3d')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Events
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col h-screen">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <Button variant="ghost" size="sm" onClick={() => navigate('/maw3d')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-lg font-semibold">Event Details</h1>
          <div></div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 pb-20">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Event Card */}
            <Card>
              <CardContent className="p-0">
                <div 
                  className="relative h-48 rounded-t-lg flex items-end p-6"
                  style={{
                    background: event.background_type === 'gradient' || event.background_type === 'color'
                      ? event.background_value
                      : `url(${event.background_value})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                >
                  <div className="absolute inset-0 bg-black/20 rounded-t-lg" />
                  <div className="relative z-10 text-white w-full">
                    <h1 
                      className="text-2xl font-bold mb-2"
                      style={{
                        fontSize: `${event.text_style.fontSize}px`,
                        fontFamily: event.text_style.fontFamily,
                        fontWeight: event.text_style.isBold ? 'bold' : 'normal',
                        fontStyle: event.text_style.isItalic ? 'italic' : 'normal',
                        textDecoration: event.text_style.isUnderline ? 'underline' : 'none',
                        textShadow: event.text_style.hasShadow ? '2px 2px 4px rgba(0,0,0,0.5)' : 'none',
                        textAlign: event.text_style.alignment,
                        color: event.text_style.color
                      }}
                    >
                      {event.title}
                    </h1>
                    {event.description && (
                      <p className="text-sm opacity-90">{event.description}</p>
                    )}
                  </div>
                  
                  {/* WAKTI Branding */}
                  <div className="absolute bottom-2 right-2">
                    <a 
                      href="/" 
                      className="text-xs text-white/70 hover:text-white/90 transition-colors"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Powered by WAKTI
                    </a>
                  </div>
                </div>
                
                <div className="p-6 space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-primary" />
                      <span className="font-medium">{formatDate(event.event_date)}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-primary" />
                      <span>
                        {event.is_all_day 
                          ? 'All Day' 
                          : `${formatTime(event.start_time || '')} - ${formatTime(event.end_time || '')}`
                        }
                      </span>
                    </div>

                    {event.location && (
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-primary" />
                        <span className="flex-1">{event.location}</span>
                        <Button variant="outline" size="sm" onClick={handleGetDirections}>
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Directions
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-primary" />
                      <span>{acceptedRsvps.length} attending</span>
                      <Badge variant="outline">{event.is_public ? 'Public Event' : 'Private Event'}</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* RSVP Section */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <h2 className="text-lg font-semibold">RSVP</h2>
                
                {!user && (
                  <div>
                    <label htmlFor="guest-name" className="block text-sm font-medium mb-2">
                      Your Name
                    </label>
                    <Input
                      id="guest-name"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Enter your name"
                    />
                  </div>
                )}

                {userRsvp ? (
                  <div className="text-center py-4">
                    <div className="flex items-center justify-center gap-2 mb-4">
                      {userRsvp.response === 'accepted' ? (
                        <CheckCircle className="w-6 h-6 text-green-500" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-500" />
                      )}
                      <span className="font-medium">
                        You have {userRsvp.response} this invitation
                      </span>
                    </div>
                    <div className="flex gap-2 justify-center">
                      <Button
                        variant={userRsvp.response === 'accepted' ? 'default' : 'outline'}
                        onClick={() => handleRsvp('accepted')}
                      >
                        Accept
                      </Button>
                      <Button
                        variant={userRsvp.response === 'declined' ? 'default' : 'outline'}
                        onClick={() => handleRsvp('declined')}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => handleRsvp('accepted')}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Accept
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleRsvp('declined')}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Decline
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Add to Calendar */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Add to Calendar
                </h2>
                
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => handleAddToCalendar('google')}>
                    Google
                  </Button>
                  <Button variant="outline" onClick={() => handleAddToCalendar('outlook')}>
                    Outlook
                  </Button>
                  <Button variant="outline" onClick={() => handleAddToCalendar('ics')}>
                    Apple/iCal
                  </Button>
                  <Button variant="outline" onClick={() => handleAddToCalendar('wakti')}>
                    WAKTI
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* RSVP List */}
            {(acceptedRsvps.length > 0 || declinedRsvps.length > 0) && (
              <Card>
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-lg font-semibold">Responses</h2>
                  
                  {acceptedRsvps.length > 0 && (
                    <div>
                      <h3 className="font-medium text-green-600 mb-2">
                        Attending ({acceptedRsvps.length})
                      </h3>
                      <div className="space-y-1">
                        {acceptedRsvps.map((rsvp) => (
                          <div key={rsvp.id} className="text-sm">
                            {rsvp.guest_name || 'WAKTI User'}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {declinedRsvps.length > 0 && (
                    <div>
                      <h3 className="font-medium text-red-600 mb-2">
                        Declined ({declinedRsvps.length})
                      </h3>
                      <div className="space-y-1">
                        {declinedRsvps.map((rsvp) => (
                          <div key={rsvp.id} className="text-sm">
                            {rsvp.guest_name || 'WAKTI User'}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
