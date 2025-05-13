
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import EventList from "@/components/events/EventList";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Events() {
  const [activeTab, setActiveTab] = useState<string>("upcoming");
  const navigate = useNavigate();
  
  const fetchEvents = async (type: "upcoming" | "past") => {
    const now = new Date().toISOString();
    const queryConstraint = type === "upcoming" 
      ? { column: "start_time", operator: "gt", value: now }
      : { column: "end_time", operator: "lt", value: now };
      
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .filter(queryConstraint.column, queryConstraint.operator, queryConstraint.value)
      .order(type === "upcoming" ? "start_time" : "end_time", { ascending: type === "upcoming" });
      
    if (error) {
      console.error("Error fetching events:", error);
      throw new Error("Failed to fetch events");
    }
    
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
  
  return (
    <div className="flex flex-col h-full w-full p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Events</h1>
        <Button 
          onClick={() => navigate("/events/create")} 
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
  );
}
