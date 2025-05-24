
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import EventList from "@/components/events/EventList";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { UserMenu } from "@/components/UserMenu";
import { t } from "@/utils/translations";
import { useTheme } from "@/providers/ThemeProvider";
import { useRsvpNotifications } from "@/hooks/useRsvpNotifications";

// Define the type for our events
type Event = Tables<"events">;

export default function Events() {
  const [activeTab, setActiveTab] = useState<string>("upcoming");
  const navigate = useNavigate();
  const { language } = useTheme();
  
  // Initialize RSVP notifications
  useRsvpNotifications();
  
  const fetchEvents = async (type: "upcoming" | "past") => {
    console.log(`Fetching ${type} events...`);
    
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.log('No authenticated user found');
      return [];
    }

    const now = new Date().toISOString();
    const timeFilter = type === "upcoming" 
      ? ["start_time", "gt", now]
      : ["end_time", "lt", now];
      
    console.log(`Fetching ${type} events for user:`, userData.user.id);
    console.log('Time filter:', timeFilter);
    
    // Fetch events that the user created OR public events
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .or(`created_by.eq.${userData.user.id},is_public.eq.true`)
      .filter(timeFilter[0], timeFilter[1] as any, timeFilter[2])
      .order(type === "upcoming" ? "start_time" : "end_time", { ascending: type === "upcoming" });
      
    if (error) {
      console.error(`Error fetching ${type} events:`, error);
      throw new Error(`Failed to fetch ${type} events: ${error.message}`);
    }
    
    console.log(`Successfully fetched ${data?.length || 0} ${type} events:`, data);
    return data || [];
  };
  
  const { 
    data: upcomingEvents = [], 
    isLoading: isLoadingUpcoming,
    error: upcomingError
  } = useQuery({
    queryKey: ["events", "upcoming"],
    queryFn: () => fetchEvents("upcoming"),
    retry: 2
  });
  
  const { 
    data: pastEvents = [], 
    isLoading: isLoadingPast,
    error: pastError
  } = useQuery({
    queryKey: ["events", "past"],
    queryFn: () => fetchEvents("past"),
    retry: 2
  });

  const handleLogoClick = () => {
    navigate('/dashboard');
  };

  if (upcomingError) {
    console.error('Error loading upcoming events:', upcomingError);
  }
  
  if (pastError) {
    console.error('Error loading past events:', pastError);
  }
  
  return (
    <div className="flex flex-col h-full w-full">
      {/* Mobile Header */}
      <header className="mobile-header">
        <div className="flex items-center">
          {/* Logo that acts as dashboard link - fixed aspect ratio */}
          <div className="h-10 w-10 mr-3 flex items-center justify-center cursor-pointer">
            <img 
              src="/lovable-uploads/b2ccfe85-51b7-4b00-af3f-9919d8b5be57.png" 
              alt="WAKTI Logo" 
              className="object-contain w-full h-full rounded-md"
              onClick={handleLogoClick}
            />
          </div>
          <h1 className="text-2xl font-bold">{t("events", language)}</h1>
        </div>
        <UserMenu />
      </header>
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold sr-only">{t("events", language)}</h1>
          <div className="flex-1"></div>
          <Button 
            onClick={() => navigate("/event/create")} 
            className="flex items-center gap-1"
          >
            <Plus size={18} />
            <span>Create</span>
          </Button>
        </div>
        
        <Tabs defaultValue="upcoming" onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upcoming" className="mt-2">
            <EventList 
              type="upcoming" 
              events={upcomingEvents} 
              isLoading={isLoadingUpcoming}
              emptyMessage="No upcoming events found"
            />
          </TabsContent>
          
          <TabsContent value="past" className="mt-2">
            <EventList 
              type="past" 
              events={pastEvents} 
              isLoading={isLoadingPast}
              emptyMessage="No past events found"
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
