
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from "@/lib/utils";
import { format } from 'date-fns';
import { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

// Define types inline
type EventType = 'personal' | 'work' | 'family' | 'other';

interface EventFormValues {
  title: string;
  description: string;
  location: string;
  start_date: Date;
  end_date: Date;
  event_type: EventType;
  is_public: boolean;
  invited_users: string[];
}

export default function Maw3dCreate() {
  const navigate = useNavigate();
  const { language } = useTheme();
  const { user } = useAuth();
  const [editorContent, setEditorContent] = useState('');
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(new Date().setDate(new Date().getDate() + 7)),
  });
  const [isPublic, setIsPublic] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    getValues,
    watch,
  } = useForm<EventFormValues>({
    defaultValues: {
      title: "",
      description: "",
      location: "",
      start_date: date?.from || new Date(),
      end_date: date?.to || new Date(new Date().setDate(new Date().getDate() + 7)),
      event_type: "personal",
      is_public: false,
      invited_users: [],
    },
  });

  useEffect(() => {
    if (date?.from) {
      setValue("start_date", date.from);
    }
    if (date?.to) {
      setValue("end_date", date.to);
    }
  }, [date, setValue]);

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .neq('id', user?.id);

        if (error) {
          console.error("Error fetching users:", error);
          toast.error("Failed to fetch users.");
        } else {
          setAvailableUsers(data || []);
        }
      } catch (error) {
        console.error("Unexpected error fetching users:", error);
        toast.error("Unexpected error occurred while fetching users.");
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchUsers();
    }
  }, [user]);

  const onSubmit = async (data: EventFormValues) => {
    if (!user) {
      toast.error("You must be logged in to create an event.");
      return;
    }

    try {
      const { error } = await supabase
        .from('maw3d_events')
        .insert([
          {
            created_by: user.id,
            title: data.title,
            description: data.description,
            location: data.location,
            start_date: data.start_date.toISOString(),
            end_date: data.end_date.toISOString(),
            event_type: data.event_type as EventType,
            is_public: data.is_public,
            invited_users: selectedUsers,
          },
        ]);

      if (error) {
        console.error("Error creating event:", error);
        toast.error("Failed to create event.");
      } else {
        toast.success("Event created successfully!");
        navigate("/maw3d");
      }
    } catch (error) {
      console.error("Unexpected error creating event:", error);
      toast.error("Unexpected error occurred while creating the event.");
    }
  };

  const handleEditorChange = (content: string) => {
    setEditorContent(content);
    setValue("description", content);
  };

  const filteredUsers = availableUsers.filter((user) => {
    const fullName = user.full_name || "";
    return fullName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">{language === 'ar' ? 'إنشاء حدث جديد' : 'Create New Event'}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{language === 'ar' ? 'تفاصيل الحدث' : 'Event Details'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="title">{language === 'ar' ? 'عنوان الحدث' : 'Event Title'}</Label>
              <Controller
                name="title"
                control={control}
                rules={{ required: "Title is required" }}
                render={({ field }) => (
                  <Input id="title" placeholder={language === 'ar' ? 'أدخل عنوان الحدث' : 'Enter event title'} {...field} />
                )}
              />
              {errors.title && <p className="text-red-500">{errors.title.message}</p>}
            </div>

            <div>
              <Label htmlFor="description">{language === 'ar' ? 'وصف الحدث' : 'Event Description'}</Label>
              <Controller
                name="description"
                control={control}
                rules={{ required: "Description is required" }}
                render={({ field }) => (
                  <Textarea 
                    id="description" 
                    placeholder={language === 'ar' ? 'أدخل وصف الحدث' : 'Enter event description'}
                    rows={5}
                    {...field}
                  />
                )}
              />
              {errors.description && <p className="text-red-500">{errors.description.message}</p>}
            </div>

            <div>
              <Label htmlFor="location">{language === 'ar' ? 'الموقع' : 'Location'}</Label>
              <Controller
                name="location"
                control={control}
                rules={{ required: "Location is required" }}
                render={({ field }) => (
                  <Input id="location" placeholder={language === 'ar' ? 'أدخل موقع الحدث' : 'Enter event location'} {...field} />
                )}
              />
              {errors.location && <p className="text-red-500">{errors.location.message}</p>}
            </div>

            <div>
              <Label>{language === 'ar' ? 'تاريخ ووقت البدء والانتهاء' : 'Start and End Date & Time'}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-[300px] justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    {date?.from ? (
                      date.to ? (
                        `${format(date.from, "LLL dd, y")} - ${format(date.to, "LLL dd, y")}`
                      ) : (
                        format(date.from, "LLL dd, y")
                      )
                    ) : (
                      <span>{language === 'ar' ? "اختر تاريخ" : "Pick a date"}</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center" side="bottom">
                  <Calendar
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={setDate}
                    numberOfMonths={2}
                    pagedNavigation
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label htmlFor="event_type">{language === 'ar' ? 'نوع الحدث' : 'Event Type'}</Label>
              <Controller
                name="event_type"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <SelectTrigger className="w-[300px]">
                      <SelectValue placeholder={language === 'ar' ? "اختر نوع الحدث" : "Select event type"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personal">{language === 'ar' ? 'شخصي' : 'Personal'}</SelectItem>
                      <SelectItem value="work">{language === 'ar' ? 'عمل' : 'Work'}</SelectItem>
                      <SelectItem value="family">{language === 'ar' ? 'عائلة' : 'Family'}</SelectItem>
                      <SelectItem value="other">{language === 'ar' ? 'آخر' : 'Other'}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={isPublic}
                onCheckedChange={(checked: boolean) => {
                  setIsPublic(checked);
                  setValue("is_public", checked);
                }}
              />
              <Label htmlFor="is_public">{language === 'ar' ? 'حدث عام' : 'Public Event'}</Label>
            </div>

            <Button type="submit">{language === 'ar' ? 'إنشاء الحدث' : 'Create Event'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
