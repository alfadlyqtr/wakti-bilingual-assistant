
import React, { useState } from 'react';
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, MapPin, Clock, Users } from "lucide-react";
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
  const [time, setTime] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !date || !time) {
      toast.error({
        title: t("error", language),
        description: t("pleaseCompleteAllRequiredFields", language),
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Format the date and time
      const eventDate = new Date(date!);
      const [hours, minutes] = time.split(':').map(Number);
      eventDate.setHours(hours, minutes);
      
      // Set end time to 1 hour after start time by default
      const endTime = new Date(eventDate);
      endTime.setHours(endTime.getHours() + 1);

      const { data, error } = await supabase
        .from('events')
        .insert({
          title,
          description,
          location,
          start_time: eventDate.toISOString(),
          end_time: endTime.toISOString(),
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select();
      
      if (error) throw error;
      
      toast.success({
        title: t("success", language),
        description: t("eventCreatedSuccessfully", language)
      });
      
      if (data && data[0]) {
        navigate(`/event/${data[0].id}`);
      } else {
        navigate('/events');
      }
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error({
        title: t("error", language),
        description: t("errorCreatingEvent", language),
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
        
        <div className="grid grid-cols-2 gap-4">
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
          
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("time", language)} *</label>
            <div className="relative">
              <Clock className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="pl-8"
                required
              />
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
