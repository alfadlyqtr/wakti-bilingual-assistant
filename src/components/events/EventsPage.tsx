
import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Users, Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

interface Event {
  id: string;
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  is_public: boolean;
  created_at: string;
  short_id?: string;
}

export default function EventsPage() {
  const navigate = useNavigate();
  const { language } = useTheme();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      console.log('Fetching events...');
      
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError || !userData.user) {
        console.log('No authenticated user found');
        setEvents([]);
        return;
      }

      console.log('Authenticated user:', userData.user.id);

      // With the new RLS policies, we can fetch events that the user created OR public events
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .or(`created_by.eq.${userData.user.id},is_public.eq.true`)
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching events:', error);
        toast.error('Failed to load events');
        return;
      }

      console.log('Successfully fetched events:', data);
      setEvents(data || []);
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = () => {
    console.log('Navigating to event creation');
    navigate('/event/create');
  };

  const handleEventClick = (event: Event) => {
    console.log('Navigating to event:', event.id);
    navigate(`/event/${event.id}`);
  };

  const formatDateTime = (dateTime: string, isAllDay: boolean) => {
    const date = new Date(dateTime);
    if (isAllDay) {
      return date.toLocaleDateString();
    }
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-20">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t("events", language)}</h1>
        <Button onClick={handleCreateEvent} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {t("createEvent", language)}
        </Button>
      </div>

      {/* Events List */}
      {events.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">{t("noEvents", language)}</h3>
          <p className="text-muted-foreground mb-4">{t("createFirstEvent", language)}</p>
          <Button onClick={handleCreateEvent}>
            <Plus className="h-4 w-4 mr-2" />
            {t("createEvent", language)}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <Card 
              key={event.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleEventClick(event)}
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg truncate">{event.title}</h3>
                  <Badge variant={event.is_public ? "default" : "secondary"}>
                    {event.is_public ? t("publicEvent", language) : t("privateEvent", language)}
                  </Badge>
                </div>
                
                {event.description && (
                  <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                    {event.description}
                  </p>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {formatDateTime(event.start_time, event.is_all_day)}
                      {!event.is_all_day && (
                        <span> - {formatDateTime(event.end_time, event.is_all_day)}</span>
                      )}
                    </span>
                  </div>

                  {event.location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span className="truncate">{event.location}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
