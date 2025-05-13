
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import EventList from "@/components/events/EventList";

export default function Events() {
  const [activeTab, setActiveTab] = useState<string>("upcoming");
  const navigate = useNavigate();
  
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
          <EventList type="upcoming" />
        </TabsContent>
        
        <TabsContent value="past" className="mt-2">
          <EventList type="past" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
