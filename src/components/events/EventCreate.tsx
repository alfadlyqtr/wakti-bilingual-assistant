
import React, { useState } from 'react';
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, MapPin, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

const EventCreate: React.FC = () => {
  const { language } = useTheme();
  const navigate = useNavigate();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !date || !startTime || !endTime) {
      toast({
        title: t("error", language),
        description: t("pleaseCompleteAllRequiredFields", language),
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Format the start date and time
      const startDateTime = new Date(date!);
      const [startHours, startMinutes] = startTime.split(':').map(Number);
      startDateTime.setHours(startHours, startMinutes, 0, 0);
      
      // Format the end date and time  
      const endDateTime = new Date(date!);
      const [endHours, endMinutes] = endTime.split(':').map(Number);
      endDateTime.setHours(endHours, endMinutes, 0, 0);
      
      // Validate that end time is after start time
      if (endDateTime <= startDateTime) {
        toast({
          title: t("error", language),
          description: "End time must be after start time",
          variant: "destructive"
        });
        setIsSubmitting(false);
        return;
      }

      // Get current user
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        toast({
          title: t("error", language),
          description: "You must be logged in to create an event",
          variant: "destructive"
        });
        setIsSubmitting(false);
        return;
      }

      const { data, error } = await supabase
        .from('events')
        .insert({
          title,
          description: description || null,
          location: location || null,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          organizer_id: userData.user.id,
          is_public: true // Default to public for now
        })
        .select()
        .single();
      
      if (error) throw error;
      
      toast({
        title: t("success", language),
        description: t("eventCreatedSuccessfully", language)
      });
      
      // Navigate to the created event detail page
      navigate(`/event/${data.id}`);
    } catch (error) {
      console.error('Error creating event:', error);
      toast({
        title: t("error", language),
        description: t("errorCreatingEvent", language),
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="p-4">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("eventTitle", language)} *</label>
          <Input 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("enterEventTitle", language)}
            required
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("descriptionField", language)}</label>
          <Textarea 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("enterEventDescription", language)}
            className="min-h-[100px]"
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("location", language)}</label>
          <div className="relative">
            <MapPin className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t("enterLocation", language)}
              className="pl-8"
            />
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("date", language)} *</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : <span>{t("selectDate", language)}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Time *</label>
              <div className="relative">
                <Clock className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="pl-8"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">End Time *</label>
              <div className="relative">
                <Clock className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="pl-8"
                  required
                />
              </div>
            </div>
          </div>
        </div>
        
        <Button 
          type="submit" 
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? t("creating", language) : t("createEvent", language)}
        </Button>
      </form>
    </div>
  );
};

export default EventCreate;
