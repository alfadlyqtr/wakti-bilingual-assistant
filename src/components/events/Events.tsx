
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import EventList from "@/components/events/EventList";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UserMenu } from "@/components/UserMenu";
import { t } from "@/utils/translations";
import { useTheme } from "@/providers/ThemeProvider";
import { useRsvpNotifications } from "@/hooks/useRsvpNotifications";

// Define the type for our events from the events table (not maw3d_events)
interface Event {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  organizer_id: string;
  is_public: boolean;
  background_color?: string;
  text_color?: string;
  font_size?: number;
  location?: string;
  short_id?: string;
  created_at: string;
  updated_at: string;
  is_all_day: boolean;
}

export default function Events() {
  const [activeTab, setActiveTab] = useState<string>("upcoming");
  const navigate = useNavigate();
  const { language } = useTheme();
  
  // Initialize RSVP notifications
  useRsvpNotifications();
  
  const fetchEvents = async (type: "upcoming" | "past") => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.log('No authenticated user found');
      return [];
    }

    const now = new Date().toISOString();
    const queryConstraint = type === "upcoming" 
      ? { column: "start_time", operator: "gt", value: now }
      : { column: "end_time", operator: "lt", value: now };
      
    console.log(`Fetching ${type} events for user:`, userData.user.id);
    
    // Query the events table from the newly created system
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .or(`organizer_id.eq.${userData.user.id},is_public.eq.true`)
      .filter(queryConstraint.column, queryConstraint.operator as any, queryConstraint.value)
      .order(type === "upcoming" ? "start_time" : "end_time", { ascending: type === "upcoming" });
      
    if (error) {
      console.error("Error fetching events:", error);
      throw new Error(`Failed to fetch ${type} events: ${error.message}`);
    }
    
    console.log(`Found ${data?.length || 0} ${type} events`);
    return data || [];
  };
  
  const { 
    data: upcomingEvents = [], 
    isLoading: isLoadingUpcoming 
  } = useQuery({
    queryKey: ["events", "upcoming"],
    queryFn: () => fetchEvents("upcoming")
  });
  
  const { 
    data: pastEvents = [], 
    isLoading: isLoadingPast 
  } = useQuery({
    queryKey: ["events", "past"],
    queryFn: () => fetchEvents("past")
  });

  const handleLogoClick = () => {
    navigate('/dashboard');
  };
  
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
            onClick={() => navigate("/legacy-event/create")} 
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
