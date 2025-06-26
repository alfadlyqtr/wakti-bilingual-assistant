
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MapPin, Clock, Users, Share2, Calendar, ExternalLink, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { Maw3dService } from '@/services/maw3dService';
import { ShareService } from '@/services/shareService';
import { Maw3dEvent } from '@/types/maw3d';

interface Maw3dEventViewProps {
  standalone?: boolean;
}

export default function Maw3dEventView({ standalone = false }: Maw3dEventViewProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useTheme();
  const [event, setEvent] = useState<Maw3dEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [rsvpName, setRsvpName] = useState('');
  const [rsvpResponse, setRsvpResponse] = useState<'accepted' | 'declined' | ''>('');
  const [submittingRsvp, setSubmittingRsvp] = useState(false);

  useEffect(() => {
    if (id) {
      fetchEvent();
    }
  }, [id]);

  const fetchEvent = async () => {
    console.log('=== PHASE 2: IMPROVED ERROR HANDLING ===');
    
    try {
      console.log('Starting event fetch with ID:', id);
      setError(null);
      setLoading(true);
      
      let eventData: Maw3dEvent | null = null;
      
      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout - event loading took too long')), 10000);
      });
      
      const fetchPromise = async () => {
        // First try by short_id (for shared links)
        if (id && id.startsWith('maw3d_')) {
          console.log('Fetching by short_id:', id);
          return await Maw3dService.getEventByShortId(id);
        } else if (id) {
          // Try by UUID if it's a direct ID
          console.log('Fetching by UUID:', id);
          return await Maw3dService.getEvent(id);
        }
        return null;
      };

      // Race the fetch against the timeout
      eventData = await Promise.race([fetchPromise(), timeoutPromise]);

      if (!eventData) {
        console.log('No Maw3d event found for ID:', id);
        setError(`Event not found. ID: ${id}`);
        toast.error('Event not found');
        return;
      }

      console.log('=== EVENT LOADED SUCCESSFULLY ===');
      console.log('Event data:', {
        id: eventData.id,
        title: eventData.title,
        short_id: eventData.short_id,
        event_date: eventData.event_date,
        language: eventData.language,
        text_style: eventData.text_style
      });
      
      setEvent(eventData);

      // For public view, we don't need creator name fetching from profiles
      // We can use the organizer field if available
      if (eventData.organizer) {
        setCreatorName(eventData.organizer);
      }
    } catch (error) {
      console.error('=== ERROR IN fetchEvent ===');
      console.error('Error details:', error);
      
      let errorMessage = 'Failed to load event';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Handle specific error types
        if (error.message.includes('timeout')) {
          errorMessage = 'Event loading timed out. Please try again.';
        } else if (error.message.includes('PGRST116')) {
          errorMessage = 'Event not found in database';
        } else if (error.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection.';
        }
      }
      
      console.error('Final error message:', errorMessage);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (date: string, time: string | null, isAllDay: boolean) => {
    const eventDate = new Date(date);
    if (isAllDay) {
      return eventDate.toLocaleDateString();
    }
    if (time) {
      const [hours, minutes] = time.split(':');
      eventDate.setHours(parseInt(hours), parseInt(minutes));
    }
    return eventDate.toLocaleString();
  };

  const handleShare = async () => {
    if (!event) return;
    
    try {
      await ShareService.shareEvent(event.id, event.short_id);
    } catch (error) {
      console.error('Share error:', error);
      toast.error('Failed to share event');
    }
  };

  const handleGetDirections = () => {
    if (!event?.location) return;
    
    if (event.google_maps_link) {
      window.open(event.google_maps_link, '_blank');
    } else {
      const query = encodeURIComponent(event.location);
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
      window.open(mapsUrl, '_blank');
    }
  };

  const handleRsvpSubmit = async () => {
    if (!event || !rsvpName.trim() || !rsvpResponse) {
      toast.error('Please enter your name and select a response');
      return;
    }

    setSubmittingRsvp(true);
    try {
      await Maw3dService.createRsvp(event.id, rsvpResponse, rsvpName.trim());
      toast.success('RSVP submitted successfully!');
      setRsvpName('');
      setRsvpResponse('');
    } catch (error) {
      console.error('RSVP error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit RSVP');
    } finally {
      setSubmittingRsvp(false);
    }
  };

  const handleBackNavigation = () => {
    if (standalone) {
      window.close();
    } else {
      navigate('/maw3d');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen">
        {!standalone && (
          <header className="mobile-header shrink-0">
            <div className="flex items-center">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleBackNavigation}
                className="mr-2"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-xl font-bold">Loading Event...</h1>
            </div>
          </header>
        )}
        <div className="flex-1 flex items-center justify-center flex-col gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading event details...</p>
          {id && (
            <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
              Event ID: {id}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex flex-col h-screen">
        {!standalone && (
          <header className="mobile-header shrink-0">
            <div className="flex items-center">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleBackNavigation}
                className="mr-2"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-xl font-bold">Event Not Found</h1>
            </div>
          </header>
        )}
        <div className="flex-1 flex items-center justify-center flex-col gap-4">
          <div className="text-center max-w-md mx-auto p-6">
            <h2 className="text-xl font-bold mb-2">Unable to Load Event</h2>
            <p className="text-muted-foreground mb-4">{error || 'Event not found'}</p>
            
            <div className="text-sm text-muted-foreground bg-muted p-4 rounded mb-4">
              <p className="font-medium">Debug Information:</p>
              <p>Event ID: {id}</p>
              <p>Error: {error}</p>
              <p>Standalone: {standalone ? 'Yes' : 'No'}</p>
              <p>Timestamp: {new Date().toISOString()}</p>
            </div>
            
            <div className="flex flex-col gap-2">
              <Button onClick={fetchEvent} variant="outline">
                Try Again
              </Button>
              {standalone && (
                <Button 
                  variant="outline" 
                  onClick={() => window.open('/', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Open WAKTI
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate background style
  const getBackgroundStyle = () => {
    switch (event.background_type) {
      case 'gradient':
        return { background: event.background_value };
      case 'image':
      case 'ai':
        return { 
          backgroundImage: `url(${event.background_value})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          filter: event.image_blur ? `blur(${event.image_blur}px)` : 'none'
        };
      case 'color':
      default:
        return { backgroundColor: event.background_value || '#3b82f6' };
    }
  };

  // Calculate text style with proper type checking
  const getTextStyle = () => {
    // Ensure text_style exists and has proper fallbacks
    const textStyle = event.text_style || {};
    return {
      color: (textStyle as any).color || '#000000',
      textAlign: (textStyle as any).alignment || 'center',
      fontWeight: (textStyle as any).isBold ? 'bold' : 'normal',
      fontStyle: (textStyle as any).isItalic ? 'italic' : 'normal',
      textDecoration: (textStyle as any).isUnderline ? 'underline' : 'none',
      fontFamily: (textStyle as any).fontFamily || 'Inter',
      textShadow: (textStyle as any).hasShadow ? '2px 2px 4px rgba(0,0,0,0.5)' : 'none'
    };
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Mobile Header - only show in non-standalone mode */}
      {!standalone && (
        <header className="mobile-header shrink-0">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleBackNavigation}
              className="mr-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold truncate">{event.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </header>
      )}

      <div className={`flex-1 min-h-0 overflow-y-auto p-4 ${standalone ? 'pb-4' : 'pb-20'}`}>
        {/* Standalone mode header */}
        {standalone && (
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <img 
                src="/lovable-uploads/b2ccfe85-51b7-4b00-af3f-9919d8b5be57.png" 
                alt="WAKTI" 
                className="h-8 w-auto"
              />
              <span className="text-xl font-bold">WAKTI</span>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open('/', '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Open WAKTI
              </Button>
            </div>
          </div>
        )}

        {/* Event Header */}
        <div 
          className="rounded-lg mb-6 p-8 text-center relative overflow-hidden"
          style={getBackgroundStyle()}
        >
          <div style={getTextStyle()}>
            {creatorName && (
              <p 
                className="text-center mb-4 opacity-90"
                style={{ 
                  fontSize: `${Math.max(14, 12)}px`,
                }}
              >
                Created by {creatorName}
              </p>
            )}

            <h1 
              className="mb-4 leading-tight"
              style={{ 
                fontSize: `${((event.text_style as any)?.fontSize) || 24}px`,
              }}
            >
              {event.title}
            </h1>
            {event.description && (
              <p 
                className="opacity-90 leading-relaxed"
                style={{ 
                  fontSize: `${Math.max((((event.text_style as any)?.fontSize) || 24) * 0.6, 14)}px`,
                  marginTop: '16px',
                }}
              >
                {event.description}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {event.location && (
            <Button 
              variant="outline" 
              onClick={handleGetDirections}
              className="flex items-center gap-2"
            >
              <Navigation className="h-4 w-4" />
              Get Directions
            </Button>
          )}

          <Button 
            variant="outline" 
            onClick={handleShare}
            className="flex items-center gap-2"
          >
            <Share2 className="h-4 w-4" />
            Share Event
          </Button>
        </div>

        {/* Event Details */}
        <Card className="mb-6">
          <CardContent className="p-6 space-y-4">
            {/* Date and Time */}
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">
                  {event.is_all_day ? "All Day" : "Date & Time"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(event.event_date, event.start_time, event.is_all_day)}
                  {!event.is_all_day && event.end_time && (
                    <span> - {formatDateTime(event.event_date, event.end_time, false)}</span>
                  )}
                </p>
              </div>
            </div>

            {/* Location */}
            {event.location && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Location</p>
                  <p className="text-sm text-muted-foreground">{event.location}</p>
                </div>
              </div>
            )}

            {/* Event Type */}
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Event Type</p>
                <Badge variant={event.is_public ? "default" : "secondary"}>
                  {event.is_public ? "Public Event" : "Private Event"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* RSVP Section */}
        {event.is_public && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">RSVP to this Event</h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="rsvp-name" className="block text-sm font-medium mb-2">
                    Your Name
                  </label>
                  <input
                    id="rsvp-name"
                    type="text"
                    value={rsvpName}
                    onChange={(e) => setRsvpName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-3 py-2 border border-input bg-background rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Will you attend?
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant={rsvpResponse === 'accepted' ? 'default' : 'outline'}
                      onClick={() => setRsvpResponse('accepted')}
                      className="flex-1"
                    >
                      Yes, I'll attend
                    </Button>
                    <Button
                      variant={rsvpResponse === 'declined' ? 'default' : 'outline'}
                      onClick={() => setRsvpResponse('declined')}
                      className="flex-1"
                    >
                      Can't make it
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={handleRsvpSubmit}
                  disabled={submittingRsvp || !rsvpName.trim() || !rsvpResponse}
                  className="w-full"
                >
                  {submittingRsvp ? 'Submitting...' : 'Submit RSVP'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Standalone footer */}
        {standalone && (
          <div className="mt-8 pt-6 border-t text-center text-sm text-muted-foreground">
            <p>Powered by WAKTI - Your Smart Task & Event Manager</p>
            <Button 
              variant="link" 
              size="sm"
              onClick={() => window.open('/', '_blank')}
              className="text-primary"
            >
              Get WAKTI
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
