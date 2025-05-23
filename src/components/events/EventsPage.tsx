import React, { useState, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import EventCreate from './EventCreate';
import EventList from './EventList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useRsvpNotifications } from '@/hooks/useRsvpNotifications';

const EventsPage: React.FC = () => {
  const { language } = useTheme();
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Initialize RSVP notifications
  useRsvpNotifications();
  
  useEffect(() => {
    fetchEvents();
  }, []);
  
  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError || !userData.user) {
        console.log('No authenticated user found');
        setEvents([]);
        return;
      }

      console.log('Fetching events for user:', userData.user.id);
      
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .or(`created_by.eq.${userData.user.id},is_public.eq.true`)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching events:', error);
        throw error;
      }
      
      console.log(`Found ${data?.length || 0} events`);
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="list" className="w-full flex-1 flex flex-col">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="list">{t("events", language)}</TabsTrigger>
          <TabsTrigger value="create">{t("createEvent", language)}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="list" className="flex-1 overflow-y-auto">
          <EventList 
            events={events} 
            type="upcoming" 
            isLoading={isLoading} 
            emptyMessage="No upcoming events"
          />
        </TabsContent>
        
        <TabsContent value="create" className="flex-1 overflow-y-auto">
          <EventCreate />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EventsPage;
