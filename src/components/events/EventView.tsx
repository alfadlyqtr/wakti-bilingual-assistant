import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Share,
  User,
  Check,
  X,
  Users,
  ChevronDown,
  Edit,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { MobileHeader } from "@/components/MobileHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  downloadICSFile,
  generateGoogleCalendarUrl,
  generateOutlookCalendarUrl,
  type CalendarEvent,
} from "@/utils/calendarIntegration";

export default function EventView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("details");
  const [rsvpDialogOpen, setRsvpDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rsvpChoice, setRsvpChoice] = useState<"accept" | "decline" | null>(null);
  const [isWaktiUser, setIsWaktiUser] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  
  // Fetch event data from Supabase
  const { data: event, isLoading: loading, error } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      if (!id) throw new Error("No event ID provided");
      
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .single();
      
      if (error) {
        console.error("Error fetching event:", error);
        throw error;
      }
      
      return data;
    },
    enabled: !!id
  });
  
  // Fetch current user's RSVP status (only if user is logged in)
  const { data: currentUserRsvp } = useQuery({
    queryKey: ["user-rsvp", id, user?.id],
    queryFn: async () => {
      if (!id || !user?.id) return null;
      
      const { data, error } = await supabase
        .from("event_rsvps")
        .select("*")
        .eq("event_id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) {
        console.error("Error fetching user RSVP:", error);
        return null;
      }
      
      return data;
    },
    enabled: !!id && !!user?.id
  });
  
  // Fetch RSVP data for attendees display
  const { data: rsvpData = { accepted: [], declined: [], pending: [] } } = useQuery({
    queryKey: ["event-rsvps", id],
    queryFn: async () => {
      if (!id) return { accepted: [], declined: [], pending: [] };
      
      const { data, error } = await supabase
        .from("event_rsvps")
        .select("*")
        .eq("event_id", id);
      
      if (error) {
        console.error("Error fetching RSVPs:", error);
        return { accepted: [], declined: [], pending: [] };
      }
      
      // Group RSVPs by response type
      const accepted = data?.filter(rsvp => rsvp.response === "accepted") || [];
      const declined = data?.filter(rsvp => rsvp.response === "declined") || [];
      const pending: any[] = []; // For now, we don't have pending invites
      
      return { accepted, declined, pending };
    },
    enabled: !!id
  });
  
  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("No event ID");
      
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", id)
        .eq("created_by", user?.id); // Ensure only creator can delete
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Event deleted successfully");
      navigate("/events");
    },
    onError: (error) => {
      console.error("Delete error:", error);
      toast.error("Failed to delete event");
    }
  });
  
  // Mutation for submitting RSVP
  const rsvpMutation = useMutation({
    mutationFn: async ({ response, isWaktiUser, name, username }: {
      response: "accepted" | "declined";
      isWaktiUser: boolean;
      name?: string;
      username?: string;
    }) => {
      if (!id) throw new Error("No event ID");
      
      const rsvpData: any = {
        event_id: id,
        response: response,
      };
      
      if (isWaktiUser && user?.id) {
        // Authenticated WAKTI user
        rsvpData.user_id = user.id;
        rsvpData.is_wakti_user = true;
      } else if (isWaktiUser && username) {
        // Guest claiming to be a WAKTI user
        rsvpData.guest_name = username;
        rsvpData.is_wakti_user = true;
      } else if (!isWaktiUser && name) {
        // Regular guest
        rsvpData.guest_name = name;
        rsvpData.is_wakti_user = false;
      } else {
        throw new Error("Invalid RSVP data");
      }
      
      // Check if user already has an RSVP and update instead of insert
      if (currentUserRsvp && user?.id) {
        const { data, error } = await supabase
          .from("event_rsvps")
          .update({ response: response })
          .eq("id", currentUserRsvp.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("event_rsvps")
          .insert(rsvpData)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data) => {
      // Invalidate and refetch RSVP data
      queryClient.invalidateQueries({ queryKey: ["event-rsvps", id] });
      queryClient.invalidateQueries({ queryKey: ["user-rsvp", id, user?.id] });
      
      // Also invalidate events list to trigger real-time updates
      queryClient.invalidateQueries({ queryKey: ["events"] });
      
      toast.success(
        data.response === "accepted" 
          ? "You're going to this event!" 
          : "Response recorded"
      );
      
      // Close dialog
      setRsvpDialogOpen(false);
      
      // If not a WAKTI user, show join prompt
      if (!user) {
        setTimeout(() => {
          toast("Want to stay organized? Join WAKTI.", {
            action: {
              label: "Sign Up",
              onClick: () => navigate("/signup"),
            },
          });
        }, 1500);
      }
    },
    onError: (error) => {
      console.error("RSVP error:", error);
      toast.error("Failed to submit response. Please try again.");
    }
  });
  
  // Add to WAKTI Calendar mutation
  const addToWaktiCalendarMutation = useMutation({
    mutationFn: async () => {
      if (!event || !user?.id) throw new Error("Event or user not found");
      
      const { error } = await supabase
        .from("tasks")
        .insert({
          title: event.title,
          description: event.description,
          due_date: event.start_time,
          reminder_time: event.start_time,
          user_id: user.id,
          priority: "medium",
          status: "pending",
          type: "event"
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Event added to your WAKTI calendar!");
    },
    onError: (error) => {
      console.error("Add to WAKTI calendar error:", error);
      toast.error("Failed to add event to WAKTI calendar");
    }
  });
  
  // Set initial RSVP choice based on current user's response
  useEffect(() => {
    if (currentUserRsvp) {
      setRsvpChoice(currentUserRsvp.response === "accepted" ? "accept" : "decline");
    }
  }, [currentUserRsvp]);
  
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: event?.title || "Event",
          text: `Join me at ${event?.title || "this event"}!`,
          url: window.location.href,
        });
      } catch (err) {
        toast.error("Sharing failed");
        console.error("Error sharing:", err);
      }
    } else {
      // Fallback for browsers that don't support the Web Share API
      navigator.clipboard.writeText(window.location.href);
      toast.success("Event link copied to clipboard!");
    }
  };
  
  const handleDeleteEvent = () => {
    setDeleteDialogOpen(true);
  };
  
  const confirmDelete = () => {
    deleteEventMutation.mutate();
    setDeleteDialogOpen(false);
  };
  
  const openRsvpDialog = (choice: "accept" | "decline") => {
    setRsvpChoice(choice);
    setRsvpDialogOpen(true);
    
    // If user is logged in, default to WAKTI user
    if (user) {
      setIsWaktiUser(true);
    } else {
      setIsWaktiUser(null);
    }
  };
  
  const handleRsvpTypeChange = (value: string) => {
    setIsWaktiUser(value === "yes");
    // Reset validation errors when changing type
    setUsernameError("");
  };
  
  const handleRsvpSubmit = async () => {
    if (!rsvpChoice) return;
    
    try {
      // Validate RSVP data
      if (isWaktiUser === true && !user && !username) {
        setUsernameError("Username is required");
        return;
      }
      
      if (isWaktiUser === false && !name) {
        toast.error("Name is required");
        return;
      }
      
      const response = rsvpChoice === "accept" ? "accepted" : "declined";
      
      await rsvpMutation.mutateAsync({
        response,
        isWaktiUser: isWaktiUser === true,
        name: isWaktiUser === false ? name : undefined,
        username: isWaktiUser === true ? username : undefined,
      });
    } catch (error) {
      console.error("RSVP submission error:", error);
    }
  };
  
  const validateWaktiUsername = async () => {
    if (!username) {
      setUsernameError("Username is required");
      return false;
    }
    
    try {
      // In a real implementation, we would validate the username against Supabase
      // For now, let's simulate an API call with a random result
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const userExists = Math.random() > 0.3; // 70% chance the user exists
      
      if (!userExists) {
        setUsernameError("Username not found. Please retype or continue as guest.");
        return false;
      }
      
      setUsernameError("");
      return true;
    } catch (error) {
      console.error("Username validation error:", error);
      setUsernameError("Error validating username. Please try again.");
      return false;
    }
  };
  
  // Calendar integration handlers
  const handleCalendarIntegration = (type: 'apple' | 'google' | 'outlook' | 'wakti') => {
    if (!event) return;

    const startDate = event.start_time ? new Date(event.start_time) : null;
    const endDate = event.end_time ? new Date(event.end_time) : null;
    
    if (!startDate || !endDate) {
      toast.error("Event dates are not available");
      return;
    }

    const calendarEvent: CalendarEvent = {
      title: event.title,
      description: event.description || undefined,
      location: event.location || undefined,
      startTime: startDate,
      endTime: endDate,
    };

    switch (type) {
      case 'apple':
        downloadICSFile(calendarEvent, `${event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`);
        toast.success("Calendar file downloaded for Apple Calendar");
        break;
      
      case 'google':
        const googleUrl = generateGoogleCalendarUrl(calendarEvent);
        window.open(googleUrl, '_blank');
        break;
      
      case 'outlook':
        const outlookUrl = generateOutlookCalendarUrl(calendarEvent);
        window.open(outlookUrl, '_blank');
        break;
      
      case 'wakti':
        if (!user) {
          toast.error("Please log in to add to WAKTI Calendar");
          return;
        }
        addToWaktiCalendarMutation.mutate();
        break;
    }
  };
  
  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <MobileHeader 
          title="Event Details" 
          showBackButton={true} 
          onBackClick={() => navigate(-1)} 
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-8 w-32 bg-muted rounded-md mb-4"></div>
            <div className="h-4 w-40 bg-muted rounded-md"></div>
          </div>
        </div>
      </div>
    );
  }
  
  if (error || !event) {
    return (
      <div className="flex flex-col h-full">
        <MobileHeader 
          title="Event Details" 
          showBackButton={true} 
          onBackClick={() => navigate(-1)} 
        />
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <h2 className="text-xl font-bold mb-2">Event Not Found</h2>
          <p className="text-center text-muted-foreground mb-4">
            The event you're looking for might have been removed or is unavailable.
          </p>
          <Button onClick={() => navigate("/events")}>Back to Events</Button>
        </div>
      </div>
    );
  }
  
  // Check if current user is the event creator
  const isEventCreator = user?.id === event.created_by;
  
  // Determine the background style based on the background type
  const getBackgroundStyle = () => {
    switch (event.background_type) {
      case 'image':
      case 'ai':
        return event.background_image 
          ? { backgroundImage: `url(${event.background_image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { backgroundColor: event.background_color || "#3b82f6" };
      case 'gradient':
        return event.background_gradient 
          ? { background: event.background_gradient }
          : { backgroundColor: event.background_color || "#3b82f6" };
      case 'color':
      default:
        return { backgroundColor: event.background_color || "#3b82f6" };
    }
  };
  
  const backgroundStyle = getBackgroundStyle();
  
  // Convert database dates to Date objects
  const startDate = event.start_time ? new Date(event.start_time) : null;
  const endDate = event.end_time ? new Date(event.end_time) : null;
  
  // Determine current user's RSVP status for button display
  const userRsvpStatus = currentUserRsvp?.response;
  const hasResponded = !!userRsvpStatus;
  
  return (
    <div className="flex flex-col h-full">
      <MobileHeader 
        title="Event Details" 
        showBackButton={true} 
        onBackClick={() => navigate(-1)} 
        rightComponent={
          isEventCreator ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  •••
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/events/${id}/edit`)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Event
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleDeleteEvent}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Event
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null
        }
      />
      
      <div className="flex-1 overflow-y-auto pb-20">
        {/* Event Header with custom background */}
        <div 
          className="relative pt-16 pb-8 px-4 text-center"
          style={{
            ...backgroundStyle,
            color: event.text_color || '#ffffff',
          }}
        >
          <h1 
            className={cn(
              "font-bold mb-2",
              event.font_weight === 'bold' && "font-bold",
              event.font_style === 'italic' && "italic",
              event.text_decoration === 'underline' && "underline"
            )}
            style={{ 
              fontSize: `${event.font_size || 18}px`,
              textAlign: event.text_align as any || 'center'
            }}
          >
            {event.title}
          </h1>
          <div className="flex items-center justify-center text-sm opacity-90">
            <span>Organized by Event Creator</span>
          </div>
        </div>
        
        <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="w-full"
        >
          <div className="border-b">
            <TabsList className="flex h-14 border-0 rounded-none bg-transparent">
              <TabsTrigger 
                value="details" 
                className="flex-1 h-full data-[state=active]:border-b-2 data-[state=active]:border-primary"
              >
                Details
              </TabsTrigger>
              <TabsTrigger 
                value="attendees" 
                className="flex-1 h-full data-[state=active]:border-b-2 data-[state=active]:border-primary"
              >
                Attendees
              </TabsTrigger>
            </TabsList>
          </div>
          
          {/* Details Tab */}
          <TabsContent value="details" className="p-4 space-y-6">
            {/* Description */}
            {event.description && (
              <div>
                <h3 className="font-medium mb-1">About this event</h3>
                <p className="text-muted-foreground">{event.description}</p>
              </div>
            )}
            
            {/* Date and Time */}
            <div className="space-y-2">
              <div className="flex items-start">
                <CalendarIcon className="h-5 w-5 mr-3 text-muted-foreground mt-0.5" />
                <div>
                  <h3 className="font-medium">Date</h3>
                  <p className="text-sm text-muted-foreground">
                    {startDate && endDate ? (
                      startDate.toDateString() === endDate.toDateString() ? (
                        format(startDate, "EEEE, MMMM d, yyyy")
                      ) : (
                        <>
                          {format(startDate, "MMM d")} - {format(endDate, "MMM d, yyyy")}
                        </>
                      )
                    ) : (
                      "Date not specified"
                    )}
                  </p>
                </div>
              </div>
              
              {!event.is_all_day && startDate && endDate && (
                <div className="flex items-start">
                  <Clock className="h-5 w-5 mr-3 text-muted-foreground mt-0.5" />
                  <div>
                    <h3 className="font-medium">Time</h3>
                    <p className="text-sm text-muted-foreground">
                      {format(startDate, "h:mm a")} - {format(endDate, "h:mm a")}
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Location */}
            {event.location && (
              <div className="flex items-start">
                <MapPin className="h-5 w-5 mr-3 text-muted-foreground mt-0.5" />
                <div>
                  <h3 className="font-medium">Location</h3>
                  <p className="text-sm text-muted-foreground mb-1">{event.location}</p>
                  {event.location_link && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-1"
                      onClick={() => window.open(event.location_link, '_blank')}
                    >
                      Get Directions
                    </Button>
                  )}
                </div>
              </div>
            )}
            
            {/* Calendar Integration */}
            <div>
              <h3 className="font-medium mb-2">Add to Calendar</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleCalendarIntegration('apple')}
                >
                  Apple Calendar
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleCalendarIntegration('google')}
                >
                  Google Calendar
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleCalendarIntegration('outlook')}
                >
                  Outlook
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleCalendarIntegration('wakti')}
                  disabled={addToWaktiCalendarMutation.isPending}
                >
                  {addToWaktiCalendarMutation.isPending ? "Adding..." : "WAKTI Calendar"}
                </Button>
              </div>
            </div>
          </TabsContent>
          
          {/* Attendees Tab */}
          <TabsContent value="attendees" className="p-4">
            <div className="space-y-6">
              {/* Accepted */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium flex items-center">
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                    Going ({rsvpData.accepted.length})
                  </h3>
                </div>
                
                {rsvpData.accepted.length > 0 ? (
                  <div className="space-y-2">
                    {rsvpData.accepted.map((rsvp: any) => (
                      <div key={rsvp.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary mr-3">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{rsvp.guest_name || "WAKTI User"}</p>
                            {rsvp.user_id && (
                              <p className="text-xs text-muted-foreground">WAKTI User</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No attendees yet</p>
                )}
              </div>
              
              {/* Declined */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium flex items-center">
                    <X className="h-4 w-4 mr-2 text-red-500" />
                    Not Going ({rsvpData.declined.length})
                  </h3>
                </div>
                
                {rsvpData.declined.length > 0 ? (
                  <div className="space-y-2">
                    {rsvpData.declined.map((rsvp: any) => (
                      <div key={rsvp.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary mr-3">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{rsvp.guest_name || "WAKTI User"}</p>
                            {rsvp.user_id && (
                              <p className="text-xs text-muted-foreground">WAKTI User</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No declined responses</p>
                )}
              </div>
              
              {/* Pending */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium flex items-center">
                    <Users className="h-4 w-4 mr-2 text-yellow-500" />
                    Pending ({rsvpData.pending.length})
                  </h3>
                  {rsvpData.pending.length > 0 && (
                    <Button variant="ghost" size="sm">
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                {rsvpData.pending.length > 0 ? (
                  <div className="space-y-2">
                    {rsvpData.pending.map((attendee: any) => (
                      <div key={attendee.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary mr-3">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{attendee.name}</p>
                            {attendee.isWaktiUser && (
                              <p className="text-xs text-muted-foreground">@{attendee.username}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No pending invites</p>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Action buttons */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-background to-transparent">
        <div className="flex gap-2 max-w-md mx-auto">
          <Button 
            className={cn(
              "flex-1",
              event.button_style === "rounded" ? "rounded-full" : "rounded-md"
            )}
            onClick={() => openRsvpDialog("accept")}
            disabled={rsvpMutation.isPending}
            variant={userRsvpStatus === "accepted" ? "default" : "outline"}
          >
            {userRsvpStatus === "accepted" ? "Going ✓" : "Going"}
          </Button>
          <Button 
            variant="outline" 
            className={cn(
              "flex-1",
              event.button_style === "rounded" ? "rounded-full" : "rounded-md"
            )}
            onClick={() => openRsvpDialog("decline")}
            disabled={rsvpMutation.isPending}
          >
            {userRsvpStatus === "declined" ? "Not Going ✓" : "Not Going"}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={cn(
              event.button_style === "rounded" ? "rounded-full" : "rounded-md"
            )}
            onClick={handleShare}
          >
            <Share className="h-5 w-5" />
          </Button>
        </div>
      </div>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this event? This action cannot be undone.
              All RSVPs and related data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteEventMutation.isPending}
            >
              {deleteEventMutation.isPending ? "Deleting..." : "Delete Event"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* RSVP Dialog */}
      <Dialog open={rsvpDialogOpen} onOpenChange={setRsvpDialogOpen}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>
              {rsvpChoice === "accept" ? "Going to this event?" : "Not attending?"}
            </DialogTitle>
          </DialogHeader>
          
          {!user && isWaktiUser === null ? (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Are you a WAKTI user?</p>
              <RadioGroup 
                defaultValue="yes"
                onValueChange={handleRsvpTypeChange}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="wakti-yes" />
                  <Label htmlFor="wakti-yes">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="wakti-no" />
                  <Label htmlFor="wakti-no">No</Label>
                </div>
              </RadioGroup>
              
              <Button 
                className="w-full"
                onClick={() => setIsWaktiUser(true)} // Default to WAKTI user
              >
                Continue
              </Button>
            </div>
          ) : (user || isWaktiUser) ? (
            <div className="space-y-4 py-2">
              {!user && (
                <div>
                  <Label htmlFor="username">WAKTI Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (usernameError) setUsernameError("");
                    }}
                    placeholder="Enter your username"
                    className="mt-1"
                  />
                  {usernameError && (
                    <p className="text-xs text-destructive mt-1">{usernameError}</p>
                  )}
                </div>
              )}
              
              <DialogFooter className="flex gap-2 sm:justify-between">
                {!user && (
                  <Button 
                    variant="outline" 
                    onClick={() => setIsWaktiUser(false)}
                    className="flex-1"
                    disabled={rsvpMutation.isPending}
                  >
                    Continue as guest
                  </Button>
                )}
                <Button 
                  onClick={user ? handleRsvpSubmit : async () => {
                    const isValid = await validateWaktiUsername();
                    if (isValid) {
                      handleRsvpSubmit();
                    }
                  }}
                  className="flex-1"
                  disabled={rsvpMutation.isPending}
                >
                  {rsvpMutation.isPending ? "Submitting..." : "Continue"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="guest-name">Your Name</Label>
                <Input
                  id="guest-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="mt-1"
                />
              </div>
              
              <DialogFooter className="flex gap-2 sm:justify-between">
                <Button 
                  variant="outline" 
                  onClick={() => setIsWaktiUser(true)}
                  className="flex-1"
                  disabled={rsvpMutation.isPending}
                >
                  I have a WAKTI account
                </Button>
                <Button 
                  onClick={handleRsvpSubmit}
                  className="flex-1"
                  disabled={rsvpMutation.isPending || !name}
                >
                  {rsvpMutation.isPending ? "Submitting..." : "Submit"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
