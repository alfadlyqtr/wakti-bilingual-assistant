
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, MapPin, Clock, Users, Share2, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

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
  created_at: string;
  updated_at: string;
}

export default function EventView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useTheme();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (id) {
      fetchEvent();
    }
  }, [id]);

  const fetchEvent = async () => {
    try {
      console.log('Fetching event with ID:', id);
      
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching event:', error);
        toast.error('Failed to load event');
        navigate('/events');
        return;
      }

      console.log('Event data fetched:', data);
      setEvent(data);

      // Check if current user is the owner
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        setIsOwner(userData.user.id === data.created_by);
      }
    } catch (error) {
      console.error('Unexpected error fetching event:', error);
      toast.error('An unexpected error occurred');
      navigate('/events');
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
    try {
      await navigator.share({
        title: event?.title,
        text: event?.description,
        url: window.location.href,
      });
    } catch (error) {
      // Fallback to copying URL
      navigator.clipboard.writeText(window.location.href);
      toast.success('Event link copied to clipboard');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen">
        <header className="mobile-header shrink-0">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/events')}
              className="mr-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">Loading...</h1>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex flex-col h-screen">
        <header className="mobile-header shrink-0">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/events')}
              className="mr-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">Event Not Found</h1>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <p>Event not found</p>
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

  // Calculate text style based on event settings
  const getTextStyle = () => {
    return {
      color: event.text_color || '#ffffff',
      textAlign: event.text_align || 'center',
      fontWeight: event.font_weight || 'bold',
      fontStyle: event.font_style || 'normal',
      textDecoration: event.text_decoration || 'none',
      fontFamily: event.font_family || 'Inter',
      textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
    };
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Mobile Header */}
      <header className="mobile-header shrink-0">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/events')}
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
          {isOwner && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate(`/events/${event.id}/edit`)}
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 pb-20">
        {/* Event Header with Custom Styling */}
        <div 
          className="rounded-lg mb-6 p-8 text-center relative overflow-hidden"
          style={getBackgroundStyle()}
        >
          <div style={getTextStyle()}>
            <h1 
              className="mb-4 leading-tight"
              style={{ fontSize: `${event.font_size || 24}px` }}
            >
              {event.title}
            </h1>
            {event.description && (
              <p 
                className="opacity-90 leading-relaxed"
                style={{ 
                  fontSize: `${Math.max((event.font_size || 24) * 0.6, 14)}px`,
                  marginTop: '16px'
                }}
              >
                {event.description}
              </p>
            )}
          </div>
        </div>

        {/* Event Details */}
        <Card>
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
                  {event.is_public ? t("publicEvent", language) : t("events", language)}
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
      </div>
    </div>
  );
}
