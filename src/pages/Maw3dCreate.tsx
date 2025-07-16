import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Editor } from '@tinymce/tinymce-react';
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
import { useToast } from "@/hooks/use-toast";
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { EventType } from '@/types';
import { MultiSelect } from '@/components/ui/multi-select';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
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
import { wn1NotificationService } from '@/services/wn1NotificationService';

const eventSchema = yup.object({
  title: yup.string().required("Title is required"),
  description: yup.string().required("Description is required"),
  location: yup.string().required("Location is required"),
  start_date: yup.date().required("Start date is required"),
  end_date: yup.date().required("End date is required"),
  event_type: yup.string().required("Event type is required"),
  is_public: yup.boolean().default(false),
  invited_users: yup.array().of(yup.string()).default([]),
});

type EventFormValues = yup.InferType<typeof eventSchema>;

export default function Maw3dCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
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
    resolver: yupResolver(eventSchema),
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

  // Clear Maw3d event badges when visiting this page
  useEffect(() => {
    if (user) {
      wn1NotificationService.clearBadgeOnPageVisit('maw3d');
    }
  }, [user]);

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
          toast({
            title: "Error",
            description: "Failed to fetch users.",
            variant: "destructive",
          });
        } else {
          setAvailableUsers(data || []);
        }
      } catch (error) {
        console.error("Unexpected error fetching users:", error);
        toast({
          title: "Error",
          description: "Unexpected error occurred while fetching users.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchUsers();
    }
  }, [user, toast]);

  const onSubmit = async (data: EventFormValues) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create an event.",
        variant: "destructive",
      });
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
        toast({
          title: "Error",
          description: "Failed to create event.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Event created successfully!",
        });
        navigate("/maw3d");
      }
    } catch (error) {
      console.error("Unexpected error creating event:", error);
      toast({
        title: "Error",
        description: "Unexpected error occurred while creating the event.",
        variant: "destructive",
      });
    }
  };

  const handleEditorChange = (content: string) => {
    setEditorContent(content);
    setValue("description", content);
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsPublic(e.target.checked);
    setValue("is_public", e.target.checked);
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
                render={({ field }) => (
                  <Input id="title" placeholder={language === 'ar' ? 'أدخل عنوان الحدث' : 'Enter event title'} {...field} />
                )}
              />
              {errors.title && <p className="text-red-500">{errors.title.message}</p>}
            </div>

            <div>
              <Label htmlFor="description">{language === 'ar' ? 'وصف الحدث' : 'Event Description'}</Label>
              <Editor
                apiKey="YOUR_TINYMCE_API_KEY"
                value={editorContent}
                init={{
                  height: 300,
                  menubar: false,
                  plugins: [
                    'advlist autolink lists link image charmap print preview anchor',
                    'searchreplace visualblocks code fullscreen',
                    'insertdatetime media table paste code help wordcount'
                  ],
                  toolbar:
                    'undo redo | formatselect | ' +
                    'bold italic backcolor | alignleft aligncenter ' +
                    'alignright alignjustify | bullist numlist outdent indent | ' +
                    'removeformat | help',
                  content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }'
                }}
                onEditorChange={handleEditorChange}
              />
              {errors.description && <p className="text-red-500">{errors.description.message}</p>}
            </div>

            <div>
              <Label htmlFor="location">{language === 'ar' ? 'الموقع' : 'Location'}</Label>
              <Controller
                name="location"
                control={control}
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
              {errors.start_date && <p className="text-red-500">{errors.start_date.message}</p>}
              {errors.end_date && <p className="text-red-500">{errors.end_date.message}</p>}
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
              {errors.event_type && <p className="text-red-500">{errors.event_type.message}</p>}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_public"
                checked={isPublic}
                onCheckedChange={handleCheckboxChange}
              />
              <Label htmlFor="is_public">{language === 'ar' ? 'حدث عام' : 'Public Event'}</Label>
            </div>

            <div>
              <Label>{language === 'ar' ? 'دعوة مستخدمين' : 'Invite Users'}</Label>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    {language === 'ar' ? 'دعوة مستخدمين' : 'Invite Users'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>{language === 'ar' ? 'دعوة مستخدمين' : 'Invite Users'}</DialogTitle>
                    <DialogDescription>
                      {language === 'ar' ? 'اختر المستخدمين لدعوتهم إلى هذا الحدث' : 'Choose users to invite to this event'}
                    </DialogDescription>
                  </DialogHeader>
                  <Command>
                    <CommandInput
                      placeholder={language === 'ar' ? "ابحث عن مستخدم..." : "Type to search..."}
                      value={searchTerm}
                      onValueChange={setSearchTerm}
                    />
                    <CommandList>
                      <CommandEmpty>{language === 'ar' ? "لا يوجد مستخدمين" : "No users found."}</CommandEmpty>
                      <CommandGroup heading={language === 'ar' ? "المستخدمين" : "Users"}>
                        <ScrollArea className="h-[200px] w-full rounded-md border">
                          {filteredUsers.map((user) => (
                            <CommandItem
                              key={user.id}
                              onSelect={() => {
                                if (selectedUsers.includes(user.id)) {
                                  setSelectedUsers(selectedUsers.filter((id) => id !== user.id));
                                } else {
                                  setSelectedUsers([...selectedUsers, user.id]);
                                }
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={selectedUsers.includes(user.id)}
                                  id={user.id}
                                  className="mr-2"
                                />
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={user.avatar_url} alt={user.full_name} />
                                  <AvatarFallback>{user.full_name?.slice(0, 2)}</AvatarFallback>
                                </Avatar>
                                <span>{user.full_name}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </ScrollArea>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                  <DialogFooter>
                    <Button type="button" onClick={() => setOpen(false)}>
                      {language === 'ar' ? 'حفظ' : 'Save'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedUsers.map((userId) => {
                    const user = availableUsers.find((u) => u.id === userId);
                    return (
                      user ? (
                        <Badge key={userId} variant="secondary">
                          <Avatar className="h-4 w-4 mr-1">
                            <AvatarImage src={user.avatar_url} alt={user.full_name} />
                            <AvatarFallback>{user.full_name?.slice(0, 2)}</AvatarFallback>
                          </Avatar>
                          {user.full_name}
                        </Badge>
                      ) : null
                    );
                  })}
                </div>
              )}
            </div>

            <Button type="submit">{language === 'ar' ? 'إنشاء الحدث' : 'Create Event'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
