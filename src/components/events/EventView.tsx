
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, MapPin, Clock, Users, Share2, Calendar, ExternalLink, Navigation } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import CalendarDropdown from './CalendarDropdown';
import RSVPSection from './RSVPSection';
import InlineRSVP from './InlineRSVP';

interface Event {
  id: string;
  title: string;
  description?: string;
  location?: string;
  location_link?: string;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  is_public: boolean;
  created_by: string;
  background_type: 'color' | 'gradient' | 'image' | 'ai';
  background_color?: string;
  background_gradient?: string;
  background_image?: string;
  font_size?: number;
  text_color?: string;
  text_align?: 'left' | 'center' | 'right';
  font_weight?: 'normal' | 'bold';
  font_style?: 'normal' | 'italic';
  text_decoration?: 'none' | 'underline';
  font_family?: string;
  short_id?: string;
  rsvp_enabled?: boolean;
  rsvp_deadline?: string;
  created_at: string;
  updated_at: string;
}

interface EventViewProps {
  standalone?: boolean;
}

export default function EventView({ standalone = false }: EventViewProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useTheme();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchEvent();
    }
  }, [id]);

  const fetchEvent = async () => {
    try {
      console.log('Fetching event with ID:', id);
      console.log('Standalone mode:', standalone);
      
      setError(null);
      
      // Check if the ID looks like a UUID (contains hyphens and is 36 chars)
      const isUuid = id && id.includes('-') && id.length === 36;
      console.log('Is UUID?', isUuid);
      
      let query = supabase.from('events').select('*');
      
      if (isUuid) {
        console.log('Querying by UUID');
        query = query.eq('id', id);
      } else {
        console.log('Querying by short_id');
        query = query.eq('short_id', id);
      }
      
      const { data, error: queryError } = await query.maybeSingle();
      
      console.log('Query result:', { data, error: queryError });

      if (queryError) {
        console.error('Database error:', queryError);
        setError(`Database error: ${queryError.message}`);
        toast.error('Failed to load event');
        return;
      }

      if (!data) {
        console.log('No event found');
        setError('Event not found in database');
        toast.error('Event not found');
        return;
      }

      console.log('Event data loaded successfully:', data);
      setEvent(data);

      // Fetch creator's profile - prioritize display_name which contains the full name
      if (data.created_by) {
        console.log('Fetching creator profile for ID:', data.created_by);
        
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('display_name, username, email')
          .eq('id', data.created_by)
          .single();
        
        console.log('Profile query result:', { profileData, error: profileError });
        
        if (profileData && !profileError) {
          // Use display_name first (this contains the full name), then fallback to username, then email
          const finalName = profileData.display_name || profileData.username || profileData.email || 'Unknown User';
          setCreatorName(finalName);
          console.log('Creator name set to:', finalName);
          console.log('Profile data breakdown:', {
            display_name: profileData.display_name,
            username: profileData.username,
            email: profileData.email,
            final_name: finalName
          });
        } else {
          console.log('No profile found or error:', profileError);
          setCreatorName('Unknown User');
        }
      }

      // Check if current user is the owner (only for non-standalone mode)
      if (!standalone) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          console.log('User data for ownership check:', userData);
          if (userData.user) {
            setIsOwner(userData.user.id === data.created_by);
          }
        } catch (authError) {
          console.log('Auth error (non-critical):', authError);
          // Auth errors are non-critical for public events
        }
      }
    } catch (error) {
      console.error('Unexpected error fetching event:', error);
      setError(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateTime: string, isAllDay: boolean) => {
    const date = new Date(dateTime);
    if (isAllDay) {
      return date.toLocaleDateString();
    }
    return date.toLocaleString();
  };

  const handleShare = async () => {
    const shareUrl = event?.short_id 
      ? `${window.location.origin}/wakti/${event.short_id}`
      : window.location.href;
      
    try {
      await navigator.share({
        title: event?.title,
        text: event?.description,
        url: shareUrl,
      });
    } catch (error) {
      // Fallback to copying URL
      navigator.clipboard.writeText(shareUrl);
      toast.success('Event link copied to clipboard');
    }
  };

  const handleGetDirections = () => {
    if (!event?.location) return;
    
    const query = encodeURIComponent(event.location);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
    window.open(mapsUrl, '_blank');
  };

  const handleBackNavigation = () => {
    if (standalone) {
      window.close(); // Try to close the window if opened in new tab
    } else {
      navigate('/events');
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
              <h1 className="text-xl font-bold">Loading...</h1>
            </div>
          </header>
        )}
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
          <p className="text-center">Event not found</p>
          {error && (
            <div className="text-sm text-muted-foreground bg-muted p-4 rounded max-w-md">
              <p className="font-medium">Debug Info:</p>
              <p>ID: {id}</p>
              <p>Error: {error}</p>
              <p>Standalone: {standalone ? 'Yes' : 'No'}</p>
            </div>
          )}
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
    );
  }

  // Calculate background style based on event settings
  const getBackgroundStyle = () => {
    switch (event.background_type) {
      case 'gradient':
        return { background: event.background_gradient };
      case 'image':
      case 'ai':
        return { 
          backgroundImage: `url(${event.background_image})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        };
      case 'color':
      default:
        return { backgroundColor: event.background_color || '#3b82f6' };
    }
  };

  // Calculate text style based on event settings - increased shadow to 3.5%
  const getTextStyle = () => {
    return {
      color: event.text_color || '#ffffff',
      textAlign: event.text_align || 'center',
      fontWeight: event.font_weight || 'bold',
      fontStyle: event.font_style || 'normal',
      textDecoration: event.text_decoration || 'none',
      fontFamily: event.font_family || 'Inter',
      textShadow: '0 0 2px rgba(0,0,0,0.035), 1px 1px 2px rgba(0,0,0,0.035)'
    };
  };

  // Determine if this is guest view
  const isGuestView = standalone || !isOwner;

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
            {/* Only show share button for creators */}
            {isOwner && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            )}
            {isOwner && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate(`/event/${event.id}/edit`)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
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

        {/* Creator Name Above Card - Only for guest view */}
        {isGuestView && creatorName && (
          <div className="mb-4 text-center">
            <div className="inline-block bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-gray-200">
              <p className="text-sm font-medium text-gray-700">
                Created by <span className="font-bold text-gray-900">{creatorName}</span>
              </p>
            </div>
          </div>
        )}

        {/* Event Header */}
        <div 
          className="rounded-lg mb-6 p-8 text-center relative overflow-hidden"
          style={getBackgroundStyle()}
        >
          <div style={getTextStyle()}>
            <h1 
              className="mb-4 leading-tight"
              style={{ 
                fontSize: `${event.font_size || 24}px`,
                textShadow: '0 0 2px rgba(0,0,0,0.035), 1px 1px 2px rgba(0,0,0,0.035)'
              }}
            >
              {event.title}
            </h1>
            {event.description && (
              <p 
                className="opacity-90 leading-relaxed"
                style={{ 
                  fontSize: `${Math.max((event.font_size || 24) * 0.6, 14)}px`,
                  marginTop: '16px',
                  textShadow: '0 0 2px rgba(0,0,0,0.035), 1px 1px 2px rgba(0,0,0,0.035)'
                }}
              >
                {event.description}
              </p>
            )}

            {/* Inline RSVP for guest view */}
            {isGuestView && (
              <InlineRSVP 
                eventId={event.id}
                rsvpEnabled={event.rsvp_enabled || false}
                rsvpDeadline={event.rsvp_deadline}
                isPublic={event.is_public}
                creatorName={creatorName || undefined}
              />
            )}
          </div>
        </div>

        {/* Action Buttons - different for creator vs guest */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <CalendarDropdown event={event} />
          
          {event.location && (
            <Button 
              variant="outline" 
              onClick={handleGetDirections}
              className="flex items-center gap-2"
            >
              <Navigation className="h-4 w-4" />
              {t("getDirections", language)}
            </Button>
          )}

          {/* Only show share button for creators or in non-standalone guest view */}
          {(isOwner || !standalone) && (
            <Button 
              variant="outline" 
              onClick={handleShare}
              className="flex items-center gap-2"
            >
              <Share2 className="h-4 w-4" />
              {t("share", language)}
            </Button>
          )}
        </div>

        {/* Creator View - Event Details */}
        {isOwner && (
          <Card className="mb-6">
            <CardContent className="p-6 space-y-4">
              {/* Date and Time */}
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">
                    {event.is_all_day ? t("allDay", language) : t("dateTime", language)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(event.start_time, event.is_all_day)}
                    {!event.is_all_day && (
                      <span> - {formatDateTime(event.end_time, event.is_all_day)}</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Location */}
              {event.location && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">{t("location", language)}</p>
                    {event.location_link ? (
                      <a 
                        href={event.location_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        {event.location}
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground">{event.location}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Event Type */}
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{t("events", language)}</p>
                  <Badge variant={event.is_public ? "default" : "secondary"}>
                    {event.is_public ? t("publicEvent", language) : t("privateEvent", language)}
                  </Badge>
                </div>
              </div>

              {/* Created Date */}
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{t("eventCreated", language)}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(event.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Creator View - RSVP Management Section */}
        {isOwner && (
          <RSVPSection 
            eventId={event.id}
            rsvpEnabled={event.rsvp_enabled || false}
            rsvpDeadline={event.rsvp_deadline}
            isPublic={event.is_public}
          />
        )}

        {/* Guest View - Simple Event Info */}
        {isGuestView && (
          <Card className="mb-6">
            <CardContent className="p-6 space-y-4">
              {/* Date and Time */}
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">
                    {event.is_all_day ? t("allDay", language) : t("dateTime", language)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(event.start_time, event.is_all_day)}
                    {!event.is_all_day && (
                      <span> - {formatDateTime(event.end_time, event.is_all_day)}</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Location */}
              {event.location && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">{t("location", language)}</p>
                    {event.location_link ? (
                      <a 
                        href={event.location_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        {event.location}
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground">{event.location}</p>
                    )}
                  </div>
                </div>
              )}
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
