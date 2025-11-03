import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, MapPin, ArrowLeft, Save, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import BackgroundCustomizer from './BackgroundCustomizer';
import TextStyleControls from './TextStyleControls';

const eventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  location: z.string().optional(),
  location_link: z.string().url().optional().or(z.literal('')),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  is_all_day: z.boolean().default(false),
  is_public: z.boolean().default(false),
  rsvp_enabled: z.boolean().default(false),
  rsvp_deadline: z.string().optional(),
});

type EventFormData = z.infer<typeof eventSchema>;

export default function EventEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { language } = useTheme();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  
  // Background states
  const [backgroundColor, setBackgroundColor] = useState('#3b82f6');
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [imageBlur, setImageBlur] = useState(0);
  
  // Text styling states
  const [fontSize, setFontSize] = useState(18);
  const [textColor, setTextColor] = useState('#ffffff');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const [fontWeight, setFontWeight] = useState<'normal' | 'bold'>('normal');
  const [fontStyle, setFontStyle] = useState<'normal' | 'italic'>('normal');
  const [textDecoration, setTextDecoration] = useState<'none' | 'underline'>('none');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [textShadow, setTextShadow] = useState(false);

  // Fetch event data
  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      if (!id) throw new Error("No event ID provided");
      
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      is_all_day: false,
      is_public: false,
      rsvp_enabled: false,
    },
  });

  // Update form and styling when event data is loaded
  useEffect(() => {
    if (event) {
      reset({
        title: event.title,
        description: event.description || '',
        location: event.location || '',
        location_link: event.location_link || '',
        start_time: event.start_time ? new Date(event.start_time).toISOString().slice(0, 16) : '',
        end_time: event.end_time ? new Date(event.end_time).toISOString().slice(0, 16) : '',
        is_all_day: event.is_all_day || false,
        is_public: event.is_public || false,
        rsvp_enabled: (event.event_style as any)?.rsvp_enabled ?? false,
        rsvp_deadline: (event.event_style as any)?.rsvp_deadline ? new Date((event.event_style as any).rsvp_deadline).toISOString().slice(0, 16) : '',
      });

      // Set background data
      setBackgroundColor(event.background_color || '#3b82f6');
      setBackgroundImage(event.background_image || null);
      setImageBlur((event.event_style as any)?.image_blur ?? 0);

      // Set text styling
      setFontSize(event.font_size || 18);
      setTextColor(event.text_color || '#ffffff');
      setTextAlign((event.event_style as any)?.text_align ?? 'center');
      setFontWeight((event.event_style as any)?.font_weight ?? 'normal');
      setFontStyle((event.event_style as any)?.font_style ?? 'normal');
      setTextDecoration((event.event_style as any)?.text_decoration ?? 'none');
      setFontFamily((event.event_style as any)?.font_family ?? 'Inter');
    }
  }, [event, reset]);

  const isAllDay = watch('is_all_day');
  const isPublic = watch('is_public');
  const rsvpEnabled = watch('rsvp_enabled');
  const watchedTitle = watch('title');
  const watchedDescription = watch('description');

  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      if (!id) throw new Error("No event ID");

      const eventData = {
        title: data.title,
        description: data.description || null,
        location: data.location || null,
        location_link: data.location_link || null,
        start_time: data.start_time,
        end_time: data.end_time,
        is_all_day: data.is_all_day,
        is_public: data.is_public,
        rsvp_enabled: data.rsvp_enabled,
        rsvp_deadline: data.rsvp_deadline || null,
        background_color: backgroundColor,
        background_image: backgroundImage,
        image_blur: imageBlur,
        font_size: fontSize,
        text_color: textColor,
        text_align: textAlign,
        font_weight: fontWeight,
        font_style: fontStyle,
        text_decoration: textDecoration,
        font_family: fontFamily,
        updated_at: new Date().toISOString(),
      };

      const { data: updatedEvent, error } = await supabase
        .from('events')
        .update(eventData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updatedEvent;
    },
    onSuccess: () => {
      toast.success("Event updated successfully");
      queryClient.invalidateQueries({ queryKey: ["event", id] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      navigate(`/event/${id}`);
    },
    onError: (error) => {
      console.error('Update error:', error);
      toast.error('Failed to update event');
    }
  });

  const onSubmit = async (data: EventFormData) => {
    updateEventMutation.mutate(data);
  };

  const handleAllDayToggle = (checked: boolean) => {
    setValue('is_all_day', checked);
    if (checked) {
      // Set to full day times
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0);
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59);
      
      setValue('start_time', startOfDay.toISOString().slice(0, 16));
      setValue('end_time', endOfDay.toISOString().slice(0, 16));
    }
  };

  const handleFontSizeChange = (value: number[]) => {
    setFontSize(value[0]);
  };

  if (eventLoading) {
    return (
      <div className="flex flex-col h-screen">
        <header className="mobile-header shrink-0">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(`/event/${id}`)}
              className="mr-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">Loading...</h1>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse">Loading event...</div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex flex-col h-screen">
        <header className="mobile-header shrink-0">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/events')}
              className="mr-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">Event Not Found</h1>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Mobile Header */}
      <header className="mobile-header shrink-0">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(`/event/${id}`)}
            className="mr-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">{t("editEvent", language)}</h1>
        </div>
        <Button 
          type="submit" 
          form="event-edit-form"
          disabled={updateEventMutation.isPending}
          size="sm"
        >
          <Save className="h-4 w-4 mr-1" />
          {updateEventMutation.isPending ? t("updating", language) : t("save", language)}
        </Button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 pb-20">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {t("eventDetails", language)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form id="event-edit-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">{t("title", language)} *</Label>
                    <Input
                      id="title"
                      {...register('title')}
                      placeholder={t("enterEventTitle", language)}
                      className={errors.title ? 'border-destructive' : ''}
                    />
                    {errors.title && (
                      <p className="text-sm text-destructive mt-1">{errors.title.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="description">{t("description", language)}</Label>
                    <Textarea
                      id="description"
                      {...register('description')}
                      placeholder={t("enterEventDescription", language)}
                      rows={3}
                    />
                  </div>
                </div>

                {/* Location */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="location" className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {t("location", language)}
                    </Label>
                    <Input
                      id="location"
                      {...register('location')}
                      placeholder={t("enterLocation", language)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="location_link">{t("locationLink", language)}</Label>
                    <Input
                      id="location_link"
                      {...register('location_link')}
                      placeholder="https://maps.google.com/..."
                      type="url"
                      className={errors.location_link ? 'border-destructive' : ''}
                    />
                    {errors.location_link && (
                      <p className="text-sm text-destructive mt-1">{errors.location_link.message}</p>
                    )}
                  </div>
                </div>

                {/* Date and Time */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {t("dateTime", language)}
                    </Label>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_all_day"
                        checked={isAllDay}
                        onCheckedChange={handleAllDayToggle}
                      />
                      <Label htmlFor="is_all_day" className="text-sm">
                        {t("allDay", language)}
                      </Label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="start_time">{t("startTime", language)} *</Label>
                      <Input
                        id="start_time"
                        type="datetime-local"
                        {...register('start_time')}
                        className={errors.start_time ? 'border-destructive' : ''}
                      />
                      {errors.start_time && (
                        <p className="text-sm text-destructive mt-1">{errors.start_time.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="end_time">{t("endTime", language)} *</Label>
                      <Input
                        id="end_time"
                        type="datetime-local"
                        {...register('end_time')}
                        className={errors.end_time ? 'border-destructive' : ''}
                      />
                      {errors.end_time && (
                        <p className="text-sm text-destructive mt-1">{errors.end_time.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Settings */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="is_public">{t("publicEvent", language)}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t("publicEventDescription", language)}
                      </p>
                    </div>
                    <Switch
                      id="is_public"
                      checked={isPublic}
                      onCheckedChange={(checked) => setValue('is_public', checked)}
                    />
                  </div>
                  
                  {/* RSVP Settings */}
                  <div className="space-y-4 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="rsvp_enabled" className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {t("enableRsvp", language)}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {t("allowGuestRsvp", language)}
                        </p>
                      </div>
                      <Switch
                        id="rsvp_enabled"
                        checked={rsvpEnabled}
                        onCheckedChange={(checked) => setValue('rsvp_enabled', checked)}
                      />
                    </div>

                    {rsvpEnabled && (
                      <div>
                        <Label htmlFor="rsvp_deadline">{t("rsvpDeadline", language)}</Label>
                        <Input
                          id="rsvp_deadline"
                          type="datetime-local"
                          {...register('rsvp_deadline')}
                          placeholder="Optional RSVP deadline"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Leave empty for no deadline
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Background Customization */}
          <BackgroundCustomizer 
            backgroundColor={backgroundColor}
            backgroundImage={backgroundImage}
            imageBlur={imageBlur}
            onBackgroundColorChange={setBackgroundColor}
            onBackgroundImageChange={setBackgroundImage}
            onImageBlurChange={setImageBlur}
          />

          {/* Text Style Controls */}
          <TextStyleControls
            fontSize={fontSize}
            textColor={textColor}
            textAlignment={textAlign}
            fontWeight={fontWeight}
            fontStyle={fontStyle}
            textDecoration={textDecoration}
            fontFamily={fontFamily}
            textShadow={textShadow}
            onFontSizeChange={handleFontSizeChange}
            onTextColorChange={setTextColor}
            onTextAlignmentChange={setTextAlign}
            onFontWeightChange={setFontWeight}
            onFontStyleChange={setFontStyle}
            onTextDecorationChange={setTextDecoration}
            onFontFamilyChange={setFontFamily}
            onTextShadowChange={setTextShadow}
          />
        </div>
      </div>
    </div>
  );
}
