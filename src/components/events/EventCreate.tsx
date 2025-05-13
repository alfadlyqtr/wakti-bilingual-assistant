
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Calendar, Clock, MapPin, Image, Palette, Type, Share, X } from "lucide-react";
import { MobileHeader } from "@/components/MobileHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import BackgroundSelector from "./BackgroundSelector";
import { supabase } from "@/integrations/supabase/client";

const formSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }),
  description: z.string().optional(),
  location: z.string().optional(),
  locationLink: z.string().url().optional().or(z.literal("")),
  isAllDay: z.boolean().default(false),
  startDate: z.date(),
  endDate: z.date(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  backgroundColor: z.string().optional(),
  backgroundGradient: z.string().optional(),
  backgroundImage: z.string().optional(),
  isPublic: z.boolean().default(false),
  textColor: z.string().default("#ffffff"),
  fontSize: z.number().default(16),
  buttonStyle: z.string().default("rounded"),
});

export default function EventCreate() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("details");
  const [selectedBackgroundType, setSelectedBackgroundType] = useState<"color" | "gradient" | "image" | "ai">("color");
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      location: "",
      locationLink: "",
      isAllDay: false,
      startDate: new Date(),
      endDate: new Date(),
      startTime: "12:00",
      endTime: "13:00",
      backgroundColor: "#3b82f6",
      backgroundGradient: "linear-gradient(135deg, #3b82f6 0%, #2dd4bf 100%)",
      backgroundImage: "",
      isPublic: false,
      textColor: "#ffffff",
      fontSize: 16,
      buttonStyle: "rounded",
    },
  });

  const handleBackClick = () => {
    if (activeTab === "details") {
      // Show confirmation dialog if form has been modified
      if (form.formState.isDirty) {
        const confirm = window.confirm("Discard changes?");
        if (!confirm) {
          return;
        }
      }
      navigate("/events");
    } else {
      setActiveTab("details");
    }
  };

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      // In a real implementation, we would save the event to Supabase here
      console.log("Event data:", data);
      
      // Mock saving to Supabase
      toast.success("Event created successfully!");
      navigate("/events");
    } catch (error) {
      console.error("Error creating event:", error);
      toast.error("Failed to create event. Please try again.");
    }
  };

  const generateAiImage = async () => {
    if (!aiPrompt) {
      toast.error("Please enter a description for your image");
      return;
    }

    setIsGeneratingImage(true);
    try {
      // In a real implementation, we would call Runware AI API here
      // For now, we'll simulate a loading state and then set a mock image
      toast.info("Generating image...");
      setTimeout(() => {
        form.setValue("backgroundImage", "https://source.unsplash.com/random/800x600/?event", { shouldDirty: true });
        setIsGeneratingImage(false);
        toast.success("Image generated successfully!");
      }, 2000);
    } catch (error) {
      console.error("Error generating AI image:", error);
      toast.error("Failed to generate image. Please try again.");
      setIsGeneratingImage(false);
    }
  };

  const addToCalendar = (type: "apple" | "google" | "outlook" | "wakti") => {
    // In a real implementation, we would generate calendar links here
    toast.success(`Added to ${type} calendar!`);
  };

  return (
    <div className="flex flex-col h-full">
      <MobileHeader 
        title={activeTab === "details" ? "Create Event" : "Customize Event"} 
        showBackButton={true}
        onBackClick={handleBackClick}
      />

      <div className="flex-1 p-4 pb-24 overflow-y-auto">
        <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab} 
          className="w-full"
        >
          <TabsList className="grid grid-cols-2 mb-6">
            <TabsTrigger value="details">Event Details</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
          </TabsList>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <TabsContent value="details" className="space-y-4 mt-0">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Title*</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter event title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="What's this event about?" 
                          className="resize-none" 
                          rows={3} 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <div className="flex">
                          <div className="relative flex-1">
                            <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input 
                              className="pl-10" 
                              placeholder="Where is the event?" 
                              {...field} 
                            />
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="locationLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Google Maps Link</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://maps.google.com/..." 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="isAllDay"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel>All Day Event</FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Start Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className="w-full pl-3 text-left font-normal flex justify-between items-center"
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <Calendar className="h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent
                                mode="single"
                                selected={field.value}
                                onSelect={(date) => {
                                  if (date) {
                                    field.onChange(date);
                                    // If end date is before start date, update it
                                    const endDate = form.getValues("endDate");
                                    if (endDate < date) {
                                      form.setValue("endDate", date);
                                    }
                                  }
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>End Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className="w-full pl-3 text-left font-normal flex justify-between items-center"
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <Calendar className="h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => {
                                  const startDate = form.getValues("startDate");
                                  return date < startDate;
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {!form.watch("isAllDay") && (
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="startTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Time</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input 
                                  type="time" 
                                  className="pl-10" 
                                  {...field} 
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="endTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Time</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input 
                                  type="time" 
                                  className="pl-10" 
                                  {...field} 
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="isPublic"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel>Public Event</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Anyone with the link can view and RSVP
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="appearance" className="space-y-6 mt-0">
                <div>
                  <h3 className="text-lg font-medium mb-4">Background</h3>
                  <Tabs 
                    defaultValue="color" 
                    onValueChange={(v) => setSelectedBackgroundType(v as any)} 
                    value={selectedBackgroundType}
                  >
                    <TabsList className="grid grid-cols-4 mb-4">
                      <TabsTrigger value="color">
                        <Palette className="h-4 w-4 mr-1" />
                        <span>Color</span>
                      </TabsTrigger>
                      <TabsTrigger value="gradient">Gradient</TabsTrigger>
                      <TabsTrigger value="image">
                        <Image className="h-4 w-4 mr-1" />
                        <span>Image</span>
                      </TabsTrigger>
                      <TabsTrigger value="ai">AI</TabsTrigger>
                    </TabsList>

                    <BackgroundSelector 
                      type={selectedBackgroundType}
                      form={form}
                      generateImage={generateAiImage}
                      isGeneratingImage={isGeneratingImage}
                      aiPrompt={aiPrompt}
                      setAiPrompt={setAiPrompt}
                    />
                  </Tabs>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Text Style</h3>
                  
                  <FormField
                    control={form.control}
                    name="textColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Text Color</FormLabel>
                        <FormControl>
                          <div className="flex items-center space-x-2">
                            <Input
                              type="color"
                              className="w-12 h-10 p-1"
                              {...field}
                            />
                            <Input
                              type="text"
                              value={field.value}
                              onChange={field.onChange}
                              className="flex-1"
                            />
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="fontSize"
                    render={({ field: { value, onChange, ...fieldProps } }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Font Size</FormLabel>
                          <span className="text-sm text-muted-foreground">
                            {value}px
                          </span>
                        </div>
                        <FormControl>
                          <Slider
                            min={12}
                            max={32}
                            step={1}
                            value={[value]}
                            onValueChange={(vals) => onChange(vals[0])}
                            className="py-4"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="buttonStyle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Button Style</FormLabel>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant={field.value === "rounded" ? "default" : "outline"}
                            className="rounded-full"
                            onClick={() => field.onChange("rounded")}
                          >
                            Rounded
                          </Button>
                          <Button
                            type="button"
                            variant={field.value === "square" ? "default" : "outline"}
                            className="rounded-md"
                            onClick={() => field.onChange("square")}
                          >
                            Square
                          </Button>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-3">Add to Calendar</h3>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addToCalendar("apple")}
                      className="flex-1"
                      size="sm"
                    >
                      Apple
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addToCalendar("google")}
                      className="flex-1"
                      size="sm"
                    >
                      Google
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addToCalendar("outlook")}
                      className="flex-1"
                      size="sm"
                    >
                      Outlook
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addToCalendar("wakti")}
                      className="flex-1"
                      size="sm"
                    >
                      WAKTI
                    </Button>
                  </div>
                </div>
                
                <div className="pt-4">
                  <Button 
                    type="button" 
                    className="w-full" 
                    variant="secondary"
                    onClick={() => navigate('/events/preview')}
                  >
                    Preview Event
                  </Button>
                </div>
              </TabsContent>

              <div className="sticky bottom-0 pt-4 pb-4 bg-background border-t">
                <Button type="submit" className="w-full">
                  Create Event
                </Button>
              </div>
            </form>
          </Form>
        </Tabs>
      </div>
    </div>
  );
}
