
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
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export default function EventView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("details");
  const [rsvpDialogOpen, setRsvpDialogOpen] = useState(false);
  const [rsvpChoice, setRsvpChoice] = useState<"accept" | "decline" | null>(null);
  const [isWaktiUser, setIsWaktiUser] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [rsvpLoading, setRsvpLoading] = useState(false);
  
  useEffect(() => {
    // In a real implementation, we would fetch the event from Supabase
    // For now, we'll use dummy data
    setTimeout(() => {
      const dummyEvent = {
        id: id || "1",
        title: "Tech Conference 2025",
        description: "Join us for the biggest tech conference of the year featuring the latest innovations and industry leaders.",
        location: "San Francisco Convention Center",
        locationLink: "https://maps.google.com/?q=San+Francisco+Convention+Center",
        startDate: new Date("2025-06-15T09:00:00"),
        endDate: new Date("2025-06-17T18:00:00"),
        isAllDay: false,
        backgroundColor: "",
        backgroundGradient: "linear-gradient(135deg, #3b82f6 0%, #2dd4bf 100%)",
        backgroundImage: "",
        isPublic: true,
        textColor: "#ffffff",
        fontSize: 18,
        buttonStyle: "rounded",
        organizer: {
          id: "123",
          name: "John Smith",
          username: "johnsmith",
        },
        attendees: {
          accepted: [
            { id: "1", name: "Sarah Johnson", username: "sarahj", isWaktiUser: true },
            { id: "2", name: "Mike Chen", username: "mikechen", isWaktiUser: true },
          ],
          declined: [
            { id: "3", name: "Lisa Wong", username: "lwong", isWaktiUser: true },
          ],
          pending: [
            { id: "4", name: "Carlos Rodriguez", username: "crodriguez", isWaktiUser: true },
            { id: "5", name: "Anna Smith", username: "asmith", isWaktiUser: true },
          ],
        },
      };
      
      setEvent(dummyEvent);
      setLoading(false);
    }, 1000);
    
    // Check if user has already RSVP'd using localStorage
    const storedRsvp = localStorage.getItem(`event-rsvp-${id}`);
    if (storedRsvp) {
      const parsedRsvp = JSON.parse(storedRsvp);
      setRsvpChoice(parsedRsvp.choice);
    }
  }, [id]);
  
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: `Join me at ${event.title}!`,
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
  
  const openRsvpDialog = (choice: "accept" | "decline") => {
    setRsvpChoice(choice);
    setRsvpDialogOpen(true);
  };
  
  const handleRsvpTypeChange = (value: string) => {
    setIsWaktiUser(value === "yes");
    // Reset validation errors when changing type
    setUsernameError("");
  };
  
  const handleRsvpSubmit = async () => {
    if (!rsvpChoice) return;
    
    setRsvpLoading(true);
    
    try {
      // Validate RSVP data
      if (isWaktiUser === true && !username) {
        setUsernameError("Username is required");
        setRsvpLoading(false);
        return;
      }
      
      if (isWaktiUser === false && !name) {
        toast.error("Name is required");
        setRsvpLoading(false);
        return;
      }
      
      // In a real implementation, we would validate the username against Supabase
      // and save the RSVP response
      
      // For now, let's simulate an API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Store RSVP in localStorage to prevent multiple submissions
      localStorage.setItem(`event-rsvp-${id}`, JSON.stringify({
        choice: rsvpChoice,
        name: isWaktiUser ? username : name,
        isWaktiUser,
        timestamp: new Date().toISOString(),
      }));
      
      toast.success(
        rsvpChoice === "accept" 
          ? "You're going to this event!" 
          : "Response recorded"
      );
      
      // Close dialog and update UI
      setRsvpDialogOpen(false);
      setRsvpLoading(false);
      
      // Update event data (in real implementation, we would refetch from Supabase)
      const updatedEvent = {...event};
      const attendee = {
        id: Math.random().toString(),
        name: isWaktiUser ? username : name,
        username: isWaktiUser ? username : null,
        isWaktiUser: isWaktiUser || false,
      };
      
      if (rsvpChoice === "accept") {
        updatedEvent.attendees.accepted.push(attendee);
      } else {
        updatedEvent.attendees.declined.push(attendee);
      }
      
      setEvent(updatedEvent);
      
      // If not a WAKTI user, show join prompt
      if (!isWaktiUser) {
        setTimeout(() => {
          toast("Want to stay organized? Join WAKTI.", {
            action: {
              label: "Sign Up",
              onClick: () => navigate("/signup"),
            },
          });
        }, 1500);
      }
    } catch (error) {
      console.error("RSVP error:", error);
      toast.error("Failed to submit response. Please try again.");
      setRsvpLoading(false);
    }
  };
  
  const validateWaktiUsername = async () => {
    if (!username) {
      setUsernameError("Username is required");
      return false;
    }
    
    setRsvpLoading(true);
    
    try {
      // In a real implementation, we would validate the username against Supabase
      // For now, let's simulate an API call with a random result
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const userExists = Math.random() > 0.3; // 70% chance the user exists
      
      if (!userExists) {
        setUsernameError("Username not found. Please retype or continue as guest.");
        setRsvpLoading(false);
        return false;
      }
      
      setUsernameError("");
      setRsvpLoading(false);
      return true;
    } catch (error) {
      console.error("Username validation error:", error);
      setUsernameError("Error validating username. Please try again.");
      setRsvpLoading(false);
      return false;
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
  
  if (!event) {
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
  
  // Determine the background style
  const backgroundStyle = event.backgroundImage
    ? { backgroundImage: `url(${event.backgroundImage})`, backgroundSize: 'cover' }
    : event.backgroundGradient
    ? { background: event.backgroundGradient }
    : { backgroundColor: event.backgroundColor || "#3b82f6" };
  
  return (
    <div className="flex flex-col h-full">
      <MobileHeader 
        title="Event Details" 
        showBackButton={true} 
        onBackClick={() => navigate(-1)} 
      />
      
      <div className="flex-1 overflow-y-auto pb-20">
        {/* Event Header */}
        <div 
          className="relative pt-16 pb-8 px-4 text-center"
          style={{
            ...backgroundStyle,
            color: event.textColor || '#ffffff',
          }}
        >
          <h1 
            className="font-bold mb-2" 
            style={{ fontSize: `${event.fontSize}px` || '24px' }}
          >
            {event.title}
          </h1>
          <div className="flex items-center justify-center text-sm opacity-90">
            <span>Organized by {event.organizer.name}</span>
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
                    {event.startDate && event.endDate ? (
                      event.startDate.toDateString() === event.endDate.toDateString() ? (
                        format(event.startDate, "EEEE, MMMM d, yyyy")
                      ) : (
                        <>
                          {format(event.startDate, "MMM d")} - {format(event.endDate, "MMM d, yyyy")}
                        </>
                      )
                    ) : (
                      "Date not specified"
                    )}
                  </p>
                </div>
              </div>
              
              {!event.isAllDay && (
                <div className="flex items-start">
                  <Clock className="h-5 w-5 mr-3 text-muted-foreground mt-0.5" />
                  <div>
                    <h3 className="font-medium">Time</h3>
                    <p className="text-sm text-muted-foreground">
                      {format(event.startDate, "h:mm a")} - {format(event.endDate, "h:mm a")}
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
                  {event.locationLink && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-1"
                      onClick={() => window.open(event.locationLink, '_blank')}
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
                <Button variant="outline" size="sm">
                  Apple Calendar
                </Button>
                <Button variant="outline" size="sm">
                  Google Calendar
                </Button>
                <Button variant="outline" size="sm">
                  Outlook
                </Button>
                <Button variant="outline" size="sm">
                  WAKTI Calendar
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
                    Going ({event.attendees.accepted.length})
                  </h3>
                </div>
                
                {event.attendees.accepted.length > 0 ? (
                  <div className="space-y-2">
                    {event.attendees.accepted.map((attendee: any) => (
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
                  <p className="text-sm text-muted-foreground">No attendees yet</p>
                )}
              </div>
              
              {/* Declined */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium flex items-center">
                    <X className="h-4 w-4 mr-2 text-red-500" />
                    Not Going ({event.attendees.declined.length})
                  </h3>
                </div>
                
                {event.attendees.declined.length > 0 ? (
                  <div className="space-y-2">
                    {event.attendees.declined.map((attendee: any) => (
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
                  <p className="text-sm text-muted-foreground">No declined responses</p>
                )}
              </div>
              
              {/* Pending */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium flex items-center">
                    <Users className="h-4 w-4 mr-2 text-yellow-500" />
                    Pending ({event.attendees.pending.length})
                  </h3>
                  {event.attendees.pending.length > 0 && (
                    <Button variant="ghost" size="sm">
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                {event.attendees.pending.length > 0 ? (
                  <div className="space-y-2">
                    {event.attendees.pending.map((attendee: any) => (
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
              event.buttonStyle === "rounded" ? "rounded-full" : "rounded-md"
            )}
            onClick={() => openRsvpDialog("accept")}
            disabled={rsvpChoice !== null}
            variant={rsvpChoice === "accept" ? "default" : "outline"}
          >
            {rsvpChoice === "accept" ? "Going ✓" : "Going"}
          </Button>
          <Button 
            variant="outline" 
            className={cn(
              "flex-1",
              event.buttonStyle === "rounded" ? "rounded-full" : "rounded-md"
            )}
            onClick={() => openRsvpDialog("decline")}
            disabled={rsvpChoice !== null}
          >
            {rsvpChoice === "decline" ? "Not Going ✓" : "Not Going"}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={cn(
              event.buttonStyle === "rounded" ? "rounded-full" : "rounded-md"
            )}
            onClick={handleShare}
          >
            <Share className="h-5 w-5" />
          </Button>
        </div>
      </div>
      
      {/* RSVP Dialog */}
      <Dialog open={rsvpDialogOpen} onOpenChange={setRsvpDialogOpen}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>
              {rsvpChoice === "accept" ? "Going to this event?" : "Not attending?"}
            </DialogTitle>
          </DialogHeader>
          
          {isWaktiUser === null ? (
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
          ) : isWaktiUser ? (
            <div className="space-y-4 py-2">
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
              
              <DialogFooter className="flex gap-2 sm:justify-between">
                <Button 
                  variant="outline" 
                  onClick={() => setIsWaktiUser(false)}
                  className="flex-1"
                  disabled={rsvpLoading}
                >
                  Continue as guest
                </Button>
                <Button 
                  onClick={async () => {
                    const isValid = await validateWaktiUsername();
                    if (isValid) {
                      handleRsvpSubmit();
                    }
                  }}
                  className="flex-1"
                  disabled={rsvpLoading}
                >
                  {rsvpLoading ? "Checking..." : "Continue"}
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
                  disabled={rsvpLoading}
                >
                  I have a WAKTI account
                </Button>
                <Button 
                  onClick={handleRsvpSubmit}
                  className="flex-1"
                  disabled={rsvpLoading || !name}
                >
                  {rsvpLoading ? "Submitting..." : "Submit"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
