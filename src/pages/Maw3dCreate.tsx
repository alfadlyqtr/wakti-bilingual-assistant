
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { Plus, ArrowLeft, Calendar, MapPin, Users, Palette, Type, Settings, ChevronDown, Folder, FileText, Brush, Image, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CreateEventFormData, TextStyle } from '@/types/maw3d';
import { EventTemplates } from '@/components/maw3d/EventTemplates';
import TextStyleCustomizer from '@/components/maw3d/TextStyleCustomizer';
import BackgroundCustomizer from '@/components/events/BackgroundCustomizer';
import { t } from '@/utils/translations';

interface User {
  id: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
}

export default function Maw3dCreate() {
  const navigate = useNavigate();
  const { language, theme } = useTheme();
  const { user } = useAuth();
  
  // Form state
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Collapsible states
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [textStylingOpen, setTextStylingOpen] = useState(false);
  const [backgroundOpen, setBackgroundOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  
  // Event styling state
  const [backgroundType, setBackgroundType] = useState<'color' | 'gradient' | 'image' | 'ai'>('color');
  const [backgroundColor, setBackgroundColor] = useState('#3b82f6');
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [imageBlur, setImageBlur] = useState(0);
  
  // Text styling state
  const [textStyle, setTextStyle] = useState<TextStyle>({
    fontFamily: 'Inter',
    fontSize: 24,
    color: '#ffffff',
    isBold: true,
    isItalic: false,
    isUnderline: false,
    alignment: 'center',
    hasShadow: true,
    shadowIntensity: 5
  });

  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<CreateEventFormData>({
    defaultValues: {
      title: "",
      description: "",
      location: "",
      google_maps_link: "",
      organizer: "",
      event_date: new Date().toISOString().split('T')[0],
      start_time: "18:00",
      end_time: "20:00",
      is_all_day: false,
      is_public: true,
      show_attending_count: true,
      auto_delete_enabled: true,
      background_type: 'color',
      background_value: '#3b82f6',
      text_style: textStyle,
      template_type: null,
      invited_contacts: [],
      image_blur: 0
    }
  });

  const watchedValues = watch();

  // Apply template when selected
  useEffect(() => {
    if (selectedTemplate) {
      setValue('title', selectedTemplate.title);
      setValue('description', selectedTemplate.description);
      setValue('background_type', selectedTemplate.background_type);
      setValue('background_value', selectedTemplate.background_value);
      setValue('text_style', selectedTemplate.text_style);
      setValue('template_type', selectedTemplate.id);
      
      setBackgroundType(selectedTemplate.background_type);
      setBackgroundColor(selectedTemplate.background_value);
      setTextStyle(selectedTemplate.text_style);
    }
  }, [selectedTemplate, setValue]);

  // Fetch available users for invitations
  useEffect(() => {
    const fetchUsers = async () => {
      if (!user) return;
      
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, display_name, first_name, last_name, avatar_url')
          .neq('id', user.id)
          .order('display_name', { ascending: true });

        if (error) {
          console.error("Error fetching users:", error);
          toast.error("Failed to fetch users");
        } else {
          setAvailableUsers(data || []);
        }
      } catch (error) {
        console.error("Unexpected error fetching users:", error);
        toast.error("Unexpected error occurred while fetching users");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [user]);

  const onSubmit = async (data: CreateEventFormData) => {
    if (!user) {
      toast.error("You must be logged in to create an event");
      return;
    }

    setIsLoading(true);
    
    try {
      // Prepare event data for database
      const eventData = {
        created_by: user.id,
        title: data.title,
        description: data.description || null,
        location: data.location || null,
        google_maps_link: data.google_maps_link || null,
        organizer: data.organizer || null,
        event_date: data.event_date,
        start_time: data.is_all_day ? null : data.start_time,
        end_time: data.is_all_day ? null : data.end_time,
        is_all_day: data.is_all_day,
        is_public: data.is_public,
        show_attending_count: data.show_attending_count,
        auto_delete_enabled: data.auto_delete_enabled,
        background_type: backgroundType,
        background_value: backgroundType === 'image' ? backgroundImage || backgroundColor : backgroundColor,
        text_style: textStyle,
        template_type: data.template_type,
        language: language,
        image_blur: backgroundType === 'image' ? imageBlur : 0
      };

      console.log('Creating event with data:', eventData);

      const { data: createdEvent, error } = await supabase
        .from('maw3d_events')
        .insert([eventData])
        .select('*')
        .single();

      if (error) {
        console.error("Error creating event:", error);
        toast.error("Failed to create event");
        return;
      }

      // Create invitations if users are selected
      if (selectedUsers.length > 0 && createdEvent) {
        const invitations = selectedUsers.map(userId => ({
          event_id: createdEvent.id,
          invited_user_id: userId
        }));

        const { error: inviteError } = await supabase
          .from('maw3d_invitations')
          .insert(invitations);

        if (inviteError) {
          console.error("Error creating invitations:", inviteError);
          toast.error("Event created but failed to send some invitations");
        }
      }

      toast.success("Event created successfully!");
      navigate("/maw3d");
      
    } catch (error) {
      console.error("Unexpected error creating event:", error);
      toast.error("Unexpected error occurred while creating the event");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextStyleChange = (updates: Partial<TextStyle>) => {
    const newTextStyle = { ...textStyle, ...updates };
    setTextStyle(newTextStyle);
    setValue('text_style', newTextStyle);
  };

  const handleBackgroundChange = (type: 'color' | 'gradient' | 'image' | 'ai', value: string) => {
    setBackgroundType(type);
    if (type === 'image') {
      setBackgroundImage(value);
    } else {
      setBackgroundColor(value);
    }
    setValue('background_type', type);
    setValue('background_value', value);
  };

  const getUserDisplayName = (user: User) => {
    if (user.display_name) return user.display_name;
    if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`;
    if (user.first_name) return user.first_name;
    return 'Unknown User';
  };

  // Preview styles
  const previewStyle = {
    background: backgroundType === 'image' && backgroundImage 
      ? `url(${backgroundImage})` 
      : backgroundType === 'gradient' 
        ? backgroundColor 
        : backgroundColor,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    filter: backgroundType === 'image' ? `blur(${imageBlur}px)` : 'none',
    color: textStyle.color,
    fontSize: `${Math.min(textStyle.fontSize, 32)}px`,
    fontFamily: textStyle.fontFamily,
    fontWeight: textStyle.isBold ? 'bold' : 'normal',
    fontStyle: textStyle.isItalic ? 'italic' : 'normal',
    textDecoration: textStyle.isUnderline ? 'underline' : 'none',
    textAlign: textStyle.alignment as any,
    textShadow: textStyle.hasShadow ? `2px 2px 4px rgba(0,0,0,${(textStyle.shadowIntensity || 5) / 10})` : 'none'
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/maw3d')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('back', language)}
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{t('createEvent', language)}</h1>
                <p className="text-muted-foreground">{t('createAndManageEvents', language)}</p>
              </div>
            </div>
            <Button 
              type="submit" 
              form="event-form"
              disabled={isLoading}
              className="px-6"
            >
              <Plus className="w-4 h-4 mr-2" />
              {isLoading ? t('creating', language) : t('createEvent', language)}
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Event Preview Card - Top */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('preview', language)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="relative w-full h-64 rounded-lg flex flex-col items-center justify-center p-6 overflow-hidden"
              style={previewStyle}
            >
              <div className="text-center space-y-2">
                <h2 className="font-bold leading-tight">
                  {watchedValues.title || t('eventTitle', language)}
                </h2>
                {watchedValues.description && (
                  <p className="text-sm opacity-90 line-clamp-2">
                    {watchedValues.description}
                  </p>
                )}
                {watchedValues.organizer && (
                  <p className="text-xs opacity-75">
                    {t('by', language)} {watchedValues.organizer}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <form id="event-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Event Templates Section */}
          <Collapsible open={templatesOpen} onOpenChange={setTemplatesOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Folder className="w-5 h-5" />
                      {t('eventTemplate', language)}
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform ${templatesOpen ? 'rotate-180' : ''}`} />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <EventTemplates 
                    onSelectTemplate={setSelectedTemplate}
                    selectedTemplate={selectedTemplate}
                    language={language}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Event Details Section */}
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      {t('basicInformation', language)}
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="title">{t('eventTitle', language)} *</Label>
                    <Controller
                      name="title"
                      control={control}
                      rules={{ required: "Title is required" }}
                      render={({ field }) => (
                        <Input 
                          id="title" 
                          placeholder={t('enterEventTitle', language)}
                          {...field} 
                        />
                      )}
                    />
                    {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
                  </div>

                  <div>
                    <Label htmlFor="description">{t('description', language)}</Label>
                    <Controller
                      name="description"
                      control={control}
                      render={({ field }) => (
                        <Textarea 
                          id="description" 
                          placeholder={t('enterEventDescription', language)}
                          rows={3}
                          {...field}
                        />
                      )}
                    />
                  </div>

                  <div>
                    <Label htmlFor="organizer">{t('organizer', language)}</Label>
                    <Controller
                      name="organizer"
                      control={control}
                      render={({ field }) => (
                        <Input 
                          id="organizer" 
                          placeholder={t('enterOrganizerName', language)}
                          {...field}
                        />
                      )}
                    />
                  </div>

                  <div>
                    <Label htmlFor="event_date">{t('eventDate', language)} *</Label>
                    <Controller
                      name="event_date"
                      control={control}
                      rules={{ required: "Event date is required" }}
                      render={({ field }) => (
                        <Input 
                          id="event_date" 
                          type="date"
                          {...field}
                        />
                      )}
                    />
                    {errors.event_date && <p className="text-sm text-destructive mt-1">{errors.event_date.message}</p>}
                  </div>

                  <div className="flex items-center space-x-2">
                    <Controller
                      name="is_all_day"
                      control={control}
                      render={({ field }) => (
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          id="is_all_day"
                        />
                      )}
                    />
                    <Label htmlFor="is_all_day">{t('allDayEvent', language)}</Label>
                  </div>

                  {!watchedValues.is_all_day && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="start_time">{t('startTime', language)}</Label>
                        <Controller
                          name="start_time"
                          control={control}
                          render={({ field }) => (
                            <Input 
                              id="start_time" 
                              type="time"
                              {...field}
                            />
                          )}
                        />
                      </div>
                      <div>
                        <Label htmlFor="end_time">{t('endTime', language)}</Label>
                        <Controller
                          name="end_time"
                          control={control}
                          render={({ field }) => (
                            <Input 
                              id="end_time" 
                              type="time"
                              {...field}
                            />
                          )}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="location">{t('eventLocation', language)}</Label>
                    <Controller
                      name="location"
                      control={control}
                      render={({ field }) => (
                        <Input 
                          id="location" 
                          placeholder={t('enterLocation', language)}
                          {...field}
                        />
                      )}
                    />
                  </div>

                  <div>
                    <Label htmlFor="google_maps_link">{t('googleMapsLink', language)}</Label>
                    <Controller
                      name="google_maps_link"
                      control={control}
                      render={({ field }) => (
                        <Input 
                          id="google_maps_link" 
                          placeholder="https://maps.google.com/..."
                          {...field}
                        />
                      )}
                    />
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Text Styling Section */}
          <Collapsible open={textStylingOpen} onOpenChange={setTextStylingOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Type className="w-5 h-5" />
                      {t('textStyle', language)}
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform ${textStylingOpen ? 'rotate-180' : ''}`} />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <TextStyleCustomizer
                    textStyle={textStyle}
                    onTextStyleChange={handleTextStyleChange}
                    language={language}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Background Customization Section */}
          <Collapsible open={backgroundOpen} onOpenChange={setBackgroundOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Image className="w-5 h-5" />
                      {t('background', language)}
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform ${backgroundOpen ? 'rotate-180' : ''}`} />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <BackgroundCustomizer
                    backgroundColor={backgroundColor}
                    backgroundImage={backgroundImage}
                    imageBlur={imageBlur}
                    onBackgroundColorChange={(color) => handleBackgroundChange('color', color)}
                    onBackgroundImageChange={(image) => handleBackgroundChange('image', image || '')}
                    onImageBlurChange={setImageBlur}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Privacy Settings Section */}
          <Collapsible open={privacyOpen} onOpenChange={setPrivacyOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="w-5 h-5" />
                      {t('eventSettings', language)}
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform ${privacyOpen ? 'rotate-180' : ''}`} />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="is_public">{t('publicEvent', language)}</Label>
                      <p className="text-sm text-muted-foreground">{t('anyoneCanViewAndRSVP', language)}</p>
                    </div>
                    <Controller
                      name="is_public"
                      control={control}
                      render={({ field }) => (
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          id="is_public"
                        />
                      )}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="show_attending_count">{t('showAttendingCount', language)}</Label>
                      <p className="text-sm text-muted-foreground">{t('displayNumberOfAttendees', language)}</p>
                    </div>
                    <Controller
                      name="show_attending_count"
                      control={control}
                      render={({ field }) => (
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          id="show_attending_count"
                        />
                      )}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="auto_delete_enabled">{t('autoDelete', language)}</Label>
                      <p className="text-sm text-muted-foreground">{t('deleteEventAfter24Hours', language)}</p>
                    </div>
                    <Controller
                      name="auto_delete_enabled"
                      control={control}
                      render={({ field }) => (
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          id="auto_delete_enabled"
                        />
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-medium flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      {t('inviteContacts', language)}
                    </h3>
                    
                    <div className="flex flex-wrap gap-2">
                      {selectedUsers.map(userId => {
                        const selectedUser = availableUsers.find(u => u.id === userId);
                        return selectedUser ? (
                          <Badge key={userId} variant="secondary" className="flex items-center gap-1">
                            {getUserDisplayName(selectedUser)}
                            <button
                              type="button"
                              onClick={() => setSelectedUsers(prev => prev.filter(id => id !== userId))}
                              className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                            >
                              ×
                            </button>
                          </Badge>
                        ) : null;
                      })}
                    </div>
                    
                    <Select onValueChange={(userId) => {
                      if (userId && !selectedUsers.includes(userId)) {
                        setSelectedUsers(prev => [...prev, userId]);
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('selectUsersToInvite', language)} />
                      </SelectTrigger>
                      <SelectContent>
                        <ScrollArea className="h-48">
                          {availableUsers
                            .filter(user => !selectedUsers.includes(user.id))
                            .map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {getUserDisplayName(user)}
                              </SelectItem>
                            ))}
                        </ScrollArea>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </form>
      </div>
    </div>
  );
}
