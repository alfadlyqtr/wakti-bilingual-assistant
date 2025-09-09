import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { Plus, ArrowLeft, Calendar, MapPin, Users, Palette, Type, Settings, ChevronDown, Folder, FileText, Brush, Image, Lock, AlertTriangle, Mic } from 'lucide-react';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CreateEventFormData, TextStyle } from '@/types/maw3d';
import TextStyleCustomizer from '@/components/maw3d/TextStyleCustomizer';
import BackgroundCustomizer from '@/components/events/BackgroundCustomizer';
import { t } from '@/utils/translations';

const templates = [
  {
    id: 'blank',
    name: 'Blank Template',
    title: 'Event Title',
    description: '',
    background_type: 'color' as const,
    background_value: '#3b82f6',
    text_style: {
      fontFamily: 'Inter',
      fontSize: 24,
      color: '#ffffff',
      isBold: true,
      isItalic: false,
      isUnderline: false,
      alignment: 'center' as const,
      hasShadow: true,
      shadowIntensity: 5
    }
  },
  {
    id: 'birthday',
    name: 'Birthday',
    title: 'Happy Birthday!',
    description: 'Join us for a birthday celebration',
    background_type: 'gradient' as const,
    background_value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    text_style: {
      fontFamily: 'Arial',
      fontSize: 24,
      color: '#ffffff',
      isBold: true,
      isItalic: false,
      isUnderline: false,
      alignment: 'center' as const,
      hasShadow: true,
      shadowIntensity: 5
    }
  },
  {
    id: 'meeting',
    name: 'Meeting',
    title: 'Team Meeting',
    description: 'Important team discussion',
    background_type: 'color' as const,
    background_value: '#1e40af',
    text_style: {
      fontFamily: 'Arial',
      fontSize: 18,
      color: '#ffffff',
      isBold: false,
      isItalic: false,
      isUnderline: false,
      alignment: 'left' as const,
      hasShadow: false,
      shadowIntensity: 0
    }
  },
  {
    id: 'gathering',
    name: 'Gathering',
    title: 'Friends Gathering',
    description: 'Come and join us for a fun time',
    background_type: 'gradient' as const,
    background_value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    text_style: {
      fontFamily: 'Arial',
      fontSize: 20,
      color: '#ffffff',
      isBold: true,
      isItalic: false,
      isUnderline: false,
      alignment: 'center' as const,
      hasShadow: true,
      shadowIntensity: 3
    }
  }
];

export default function Maw3dCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, theme } = useTheme();
  const { user } = useAuth();
  
  // Form state
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  // Collapsible states - all closed by default
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [textStylingOpen, setTextStylingOpen] = useState(false);
  const [backgroundOpen, setBackgroundOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  
  // Event styling state
  const [backgroundType, setBackgroundType] = useState<'color' | 'gradient' | 'image' | 'ai'>('color');
  const [backgroundColor, setBackgroundColor] = useState('#3b82f6');
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [imageBlur, setImageBlur] = useState(0);
  
  // Audio section state (simple for now)
  const [audioSrc, setAudioSrc] = useState<string>('/lovable-uploads/beep.mp3');
  const [audioSearch, setAudioSearch] = useState<string>('');
  const [ytResults, setYtResults] = useState<Array<{ videoId: string; title: string; thumbnail: string | null }>>([]);
  const [ytLoading, setYtLoading] = useState<boolean>(false);
  const [ytError, setYtError] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [selectedVideoTitle, setSelectedVideoTitle] = useState<string | null>(null);
  const [attachToEvent, setAttachToEvent] = useState<boolean>(false);
  const [autoplayInEvent, setAutoplayInEvent] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [ytApiReady, setYtApiReady] = useState<boolean>(false);
  const ytPlayerRef = React.useRef<any>(null);

  // Load YouTube IFrame API once when needed
  useEffect(() => {
    if (!selectedVideoId) return; // load only when user picks a song
    if ((window as any).YT && (window as any).YT.Player) {
      setYtApiReady(true);
      return;
    }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(tag);
    (window as any).onYouTubeIframeAPIReady = () => {
      setYtApiReady(true);
    };
  }, [selectedVideoId]);

  // Create / update player when API ready and a video is selected
  useEffect(() => {
    if (!ytApiReady || !selectedVideoId) return;
    // Destroy previous player
    if (ytPlayerRef.current && ytPlayerRef.current.destroy) {
      ytPlayerRef.current.destroy();
      ytPlayerRef.current = null;
    }
    const YT = (window as any).YT;
    ytPlayerRef.current = new YT.Player('yt-audio-player', {
      height: '0',
      width: '0',
      videoId: selectedVideoId,
      playerVars: {
        controls: 0,
        modestBranding: 1,
        rel: 0,
        playsinline: 1,
        autoplay: 0,
        origin: window.location.origin,
        enablejsapi: 1
      },
      events: {
        onStateChange: (e: any) => {
          // 1 = playing, 2 = paused, 0 = ended
          if (e.data === 1) setIsPlaying(true);
          else if (e.data === 2 || e.data === 0) setIsPlaying(false);
        }
      }
    });
  }, [ytApiReady, selectedVideoId]);

  const handlePlaySelected = () => {
    if (ytPlayerRef.current && ytPlayerRef.current.playVideo) {
      ytPlayerRef.current.playVideo();
    }
  };

  const handlePauseSelected = () => {
    if (ytPlayerRef.current && ytPlayerRef.current.pauseVideo) {
      ytPlayerRef.current.pauseVideo();
    }
  };

  const handleYouTubeSearch = async () => {
    const q = audioSearch.trim();
    if (!q) return;
    try {
      setYtLoading(true);
      setYtError(null);
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        setYtError('Please sign in to search YouTube');
        return;
      }
      const resp = await fetch(`https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/youtube-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`
        },
        body: JSON.stringify({ query: q })
      });
      const json = await resp.json();
      if (!resp.ok) {
        setYtError('Network error searching YouTube');
        return;
      }
      if (json?.error) {
        if (json.error === 'quota_exceeded') setYtError('YouTube quota exceeded. Please try again later.');
        else setYtError('YouTube search error');
        setYtResults([]);
        return;
      }
      const results = (json?.results || []).map((r: any) => ({
        videoId: r.videoId,
        title: r.title,
        thumbnail: r.thumbnail || null
      }));
      setYtResults(results);
    } catch (e) {
      setYtError('Unexpected error searching YouTube');
      setYtResults([]);
    } finally {
      setYtLoading(false);
    }
  };
  
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
      show_attending_count: false, // Changed default to false
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

  // Detect edit mode via query param ?id
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    setEditId(id);
  }, [location.search]);

  // Load event when in edit mode
  useEffect(() => {
    const loadForEdit = async () => {
      if (!editId) return;
      try {
        const { data, error } = await supabase
          .from('maw3d_events')
          .select('*')
          .eq('id', editId)
          .single();
        if (error) throw error;
        if (data.created_by !== user?.id) {
          toast.error('You are not authorized to edit this event');
          navigate('/maw3d');
          return;
        }

        // Prefill form values
        setValue('title', data.title || '');
        setValue('description', data.description || '');
        setValue('location', data.location || '');
        setValue('google_maps_link', data.google_maps_link || '');
        setValue('organizer', data.organizer || '');
        setValue('event_date', data.event_date);
        setValue('is_all_day', !!data.is_all_day);
        setValue('start_time', data.start_time || '');
        setValue('end_time', data.end_time || '');
        setValue('is_public', !!data.is_public);
        setValue('show_attending_count', !!data.show_attending_count);
        setValue('auto_delete_enabled', data.auto_delete_enabled !== false);
        setValue('template_type', data.template_type || null);
        setValue('image_blur', data.image_blur || 0);

        // Background
        const bgType = (data.background_type as 'color' | 'gradient' | 'image' | 'ai') || 'color';
        const bgValue = data.background_value || '#3b82f6';
        setBackgroundType(bgType);
        if (bgType === 'image') {
          setBackgroundImage(bgValue);
        } else {
          setBackgroundColor(bgValue);
        }
        setValue('background_type', bgType);
        setValue('background_value', bgValue);
        setImageBlur(data.image_blur || 0);

        // Text style
        const ts = typeof data.text_style === 'object' ? data.text_style : {};
        const mergedTs: TextStyle = {
          fontFamily: ts.fontFamily || 'Inter',
          fontSize: ts.fontSize || 24,
          color: ts.color || '#ffffff',
          isBold: ts.isBold !== undefined ? ts.isBold : true,
          isItalic: ts.isItalic || false,
          isUnderline: ts.isUnderline || false,
          alignment: ts.alignment || 'center',
          hasShadow: ts.hasShadow !== undefined ? ts.hasShadow : true,
          shadowIntensity: ts.shadowIntensity !== undefined ? ts.shadowIntensity : 5,
        } as TextStyle;
        setTextStyle(mergedTs);
        setValue('text_style', mergedTs);
      } catch (e) {
        console.error('Failed to load event for edit:', e);
        toast.error('Failed to load event');
        navigate('/maw3d');
      }
    };
    loadForEdit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

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

  const onSubmit = async (data: CreateEventFormData) => {
    if (!user) {
      toast.error("You must be logged in to create an event");
      return;
    }

    setIsLoading(true);
    
    try {
      // Prepare base event data
      const baseData = {
        title: data.title,
        description: data.description || null,
        location: data.location || null,
        google_maps_link: data.google_maps_link || null,
        organizer: data.organizer || null,
        event_date: data.event_date,
        start_time: data.is_all_day ? null : (data.start_time || null),
        end_time: data.is_all_day ? null : (data.end_time || null),
        is_all_day: data.is_all_day,
        is_public: data.is_public,
        show_attending_count: data.show_attending_count,
        auto_delete_enabled: data.auto_delete_enabled,
        background_type: backgroundType,
        background_value: backgroundType === 'image' ? (backgroundImage || backgroundColor) : backgroundColor,
        text_style: textStyle,
        template_type: data.template_type,
        image_blur: backgroundType === 'image' ? imageBlur : 0,
      };

      if (editId) {
        console.log('Updating event with data:', { id: editId, ...baseData });
        const { error } = await supabase
          .from('maw3d_events')
          .update({ ...baseData, language })
          .eq('id', editId);
        if (error) {
          console.error('Error updating event:', error);
          toast.error('Failed to update event');
          return;
        }
        toast.success('Event updated successfully');
        navigate(`/maw3d/manage/${editId}`);
      } else {
        const createData = { created_by: user.id, language, ...baseData };
        console.log('Creating event with data:', createData);
        const { data: createdEvent, error } = await supabase
          .from('maw3d_events')
          .insert([createData])
          .select('*')
          .single();
        if (error) {
          console.error('Error creating event:', error);
          toast.error('Failed to create event');
          return;
        }
        toast.success('Event created successfully!');
        navigate('/maw3d');
      }
      
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
    <div className="min-h-screen bg-gradient-background">
      {/* Improved Header - Non-sticky, Better Organization */}
      <div className="bg-gradient-nav border-b border-border/50 shadow-vibrant">
        <div className="container mx-auto px-6 py-6">
          {/* Title and Description Row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                {editId ? 'Edit Event' : 'Create Event'}
              </h1>
              <p className="text-sm text-muted-foreground/80 font-medium">
                Create and manage events
              </p>
            </div>
          </div>

          {/* Buttons Row */}
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/maw3d')}
              className="group hover:bg-accent/20 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:shadow-soft"
            >
              <ArrowLeft className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:-translate-x-1" />
              <span className="font-medium">{t('back', language)}</span>
            </Button>

            <Button 
              type="submit" 
              form="event-form"
              disabled={isLoading}
              className="group px-6 py-2.5 bg-gradient-primary hover:shadow-glow transition-all duration-300 hover:scale-105 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:rotate-90" />
              <span>{editId ? (isLoading ? 'Saving...' : 'Save Changes') : (isLoading ? t('creating', language) : 'Create Event')}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <form id="event-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Event Templates Section */}
          <Collapsible open={templatesOpen} onOpenChange={setTemplatesOpen}>
            <Card className="backdrop-blur-xl bg-gradient-card border-border/50 shadow-vibrant hover:shadow-glow transition-all duration-500">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/10 transition-all duration-300 rounded-t-xl">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Folder className="w-5 h-5 text-accent-purple drop-shadow-glow-purple" />
                      <span className="bg-gradient-primary bg-clip-text text-transparent">
                        {t('eventTemplate', language)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {templatesOpen ? '−' : '+'}
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${templatesOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="backdrop-blur-sm">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-enhanced-heading">
                      {t('chooseTemplate', language)} ({t('optional', language)})
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {templates.map((template) => (
                        <Card 
                          key={template.id}
                          className={`cursor-pointer border-2 transition-all duration-300 hover:scale-105 backdrop-blur-lg ${
                            selectedTemplate?.id === template.id 
                              ? 'border-primary shadow-glow-blue bg-gradient-vibrant/10' 
                              : 'border-border/50 hover:border-primary/50 bg-gradient-card'
                          }`}
                          onClick={() => setSelectedTemplate(template)}
                        >
                          <CardContent className="p-4 text-center">
                            <div 
                              className="w-full h-24 rounded-md mb-2 flex items-center justify-center backdrop-blur-sm"
                              style={{
                                background: template.background_type === 'gradient' 
                                  ? template.background_value 
                                  : template.background_value,
                                color: template.text_style.color,
                                fontSize: `${Math.max(template.text_style.fontSize - 8, 12)}px`,
                                fontWeight: template.text_style.isBold ? 'bold' : 'normal',
                                fontStyle: template.text_style.isItalic ? 'italic' : 'normal',
                                textDecoration: template.text_style.isUnderline ? 'underline' : 'none',
                                textShadow: template.text_style.hasShadow ? `2px 2px 4px rgba(0,0,0,${(template.text_style.shadowIntensity || 5) / 10})` : 'none',
                                textAlign: template.text_style.alignment
                              }}
                            >
                              {template.id === 'blank' ? 'Start from scratch' : template.title}
                            </div>
                            <h4 className="font-medium">{template.name}</h4>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Event Details Section */}
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <Card className="backdrop-blur-xl bg-gradient-card border-border/50 shadow-vibrant hover:shadow-glow transition-all duration-500">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/10 transition-all duration-300 rounded-t-xl">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-accent-blue drop-shadow-glow-blue" />
                      <span className="bg-gradient-primary bg-clip-text text-transparent">
                        {t('basicInformation', language)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {detailsOpen ? '−' : '+'}
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${detailsOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 backdrop-blur-sm">
                  <div>
                    <Label htmlFor="title" className="text-enhanced-heading">{t('eventTitle', language)} *</Label>
                    <Controller
                      name="title"
                      control={control}
                      rules={{ required: "Title is required" }}
                      render={({ field }) => (
                        <Input 
                          id="title" 
                          placeholder={t('enterEventTitle', language)}
                          className="input-enhanced backdrop-blur-sm"
                          {...field} 
                        />
                      )}
                    />
                    {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
                  </div>

                  <div>
                    <Label htmlFor="description" className="text-enhanced-heading">{t('description', language)}</Label>
                    <Controller
                      name="description"
                      control={control}
                      render={({ field }) => (
                        <Textarea 
                          id="description" 
                          placeholder={t('enterEventDescription', language)}
                          rows={3}
                          className="input-enhanced backdrop-blur-sm"
                          {...field}
                        />
                      )}
                    />
                  </div>

                  <div>
                    <Label htmlFor="organizer" className="text-enhanced-heading">{t('organizer', language)}</Label>
                    <Controller
                      name="organizer"
                      control={control}
                      render={({ field }) => (
                        <Input 
                          id="organizer" 
                          placeholder={t('enterOrganizerName', language)}
                          className="input-enhanced backdrop-blur-sm"
                          {...field}
                        />
                      )}
                    />
                  </div>

                  <div>
                    <Label htmlFor="event_date" className="text-enhanced-heading">{t('eventDate', language)} *</Label>
                    <Controller
                      name="event_date"
                      control={control}
                      rules={{ required: "Event date is required" }}
                      render={({ field }) => (
                        <Input 
                          id="event_date" 
                          type="date"
                          className="input-enhanced backdrop-blur-sm"
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
                          className="data-[state=checked]:bg-gradient-primary"
                        />
                      )}
                    />
                    <Label htmlFor="is_all_day" className="text-enhanced-heading">{t('allDayEvent', language)}</Label>
                  </div>

                  {!watchedValues.is_all_day && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="start_time" className="text-enhanced-heading">{t('startTime', language)}</Label>
                        <Controller
                          name="start_time"
                          control={control}
                          render={({ field }) => (
                            <Input 
                              id="start_time" 
                              type="time"
                              className="input-enhanced backdrop-blur-sm"
                              {...field}
                            />
                          )}
                        />
                      </div>
                      <div>
                        <Label htmlFor="end_time" className="text-enhanced-heading">{t('endTime', language)}</Label>
                        <Controller
                          name="end_time"
                          control={control}
                          render={({ field }) => (
                            <Input 
                              id="end_time" 
                              type="time"
                              className="input-enhanced backdrop-blur-sm"
                              {...field}
                            />
                          )}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="location" className="text-enhanced-heading">{t('eventLocation', language)}</Label>
                    <Controller
                      name="location"
                      control={control}
                      render={({ field }) => (
                        <Input 
                          id="location" 
                          placeholder={t('enterLocation', language)}
                          className="input-enhanced backdrop-blur-sm"
                          {...field}
                        />
                      )}
                    />
                  </div>

                  <div>
                    <Label htmlFor="google_maps_link" className="text-enhanced-heading">{t('googleMapsLink', language)}</Label>
                    <Controller
                      name="google_maps_link"
                      control={control}
                      render={({ field }) => (
                        <Input 
                          id="google_maps_link" 
                          placeholder="https://maps.google.com/..."
                          className="input-enhanced backdrop-blur-sm"
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
            <Card className="backdrop-blur-xl bg-gradient-card border-border/50 shadow-vibrant hover:shadow-glow transition-all duration-500">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/10 transition-all duration-300 rounded-t-xl">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Type className="w-5 h-5 text-accent-green drop-shadow-glow-green" />
                      <span className="bg-gradient-primary bg-clip-text text-transparent">
                        {t('textStyle', language)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {textStylingOpen ? '−' : '+'}
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${textStylingOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="backdrop-blur-sm">
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
            <Card className="backdrop-blur-xl bg-gradient-card border-border/50 shadow-vibrant hover:shadow-glow transition-all duration-500">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/10 transition-all duration-300 rounded-t-xl">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Image className="w-5 h-5 text-accent-orange drop-shadow-glow-orange" />
                      <span className="bg-gradient-primary bg-clip-text text-transparent">
                        {t('background', language)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {backgroundOpen ? '−' : '+'}
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${backgroundOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 backdrop-blur-sm">
                  {/* Event Preview integrated within background section */}
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-enhanced-heading">Preview</h3>
                    <div 
                      className="relative w-full h-64 rounded-lg flex flex-col items-center justify-center p-6 overflow-hidden backdrop-blur-lg border border-border/30 shadow-vibrant"
                      style={previewStyle}
                    >
                      <div className="text-center space-y-2 relative z-10">
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
                    <p className="text-sm text-muted-foreground">
                      Preview with current blur settings, {imageBlur}px
                    </p>
                  </div>

                  <Separator className="bg-gradient-to-r from-transparent via-border to-transparent" />

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

          {/* Audio Section */}
          <Collapsible open={audioOpen} onOpenChange={setAudioOpen}>
            <Card className="backdrop-blur-xl bg-gradient-card border-border/50 shadow-vibrant hover:shadow-glow transition-all duration-500">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/10 transition-all duration-300 rounded-t-xl">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Mic className="w-5 h-5 text-accent-blue drop-shadow-glow-blue" />
                      <span className="bg-gradient-primary bg-clip-text text-transparent">Audio</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{audioOpen ? '−' : '+'}</span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${audioOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 backdrop-blur-sm">
                  {/* Search bar (hidden after selection) */}
                  {!selectedVideoId && (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Search audio..."
                        value={audioSearch}
                        onChange={(e) => setAudioSearch(e.target.value)}
                        className="input-enhanced"
                      />
                      <Button type="button" variant="secondary" onClick={handleYouTubeSearch} disabled={ytLoading}>
                        {ytLoading ? 'Searching...' : 'Search'}
                      </Button>
                    </div>
                  )}

                  {/* Results */}
                  {ytError && (
                    <p className="text-sm text-destructive">{ytError}</p>
                  )}

                  {ytResults.length > 0 && !selectedVideoId && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {ytResults.map(r => (
                        <button
                          key={r.videoId}
                          type="button"
                          onClick={() => {
                            setSelectedVideoId(r.videoId);
                            setSelectedVideoTitle(r.title);
                            // Keep existing audio element; we are not showing video.
                          }}
                          className={`flex gap-3 items-center p-2 rounded-lg border transition hover:bg-accent/10 text-left ${selectedVideoId === r.videoId ? 'border-primary' : 'border-border/40'}`}
                        >
                          {r.thumbnail ? (
                            <img src={r.thumbnail} alt={r.title} className="w-16 h-10 object-cover rounded" />
                          ) : (
                            <div className="w-16 h-10 rounded bg-muted" />
                          )}
                          <span className="text-sm line-clamp-2">{r.title}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Player (audio only, powered by hidden YouTube iframe when selected) */}
                  <div className="rounded-lg p-4 bg-gradient-card border border-border/30 space-y-2">
                    {selectedVideoId ? (
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium truncate">{selectedVideoTitle}</div>
                        <div className="flex gap-2">
                          {!isPlaying ? (
                            <Button size="sm" onClick={handlePlaySelected}>Play</Button>
                          ) : (
                            <Button size="sm" variant="secondary" onClick={handlePauseSelected}>Pause</Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedVideoId(null); setSelectedVideoTitle(null); setYtResults([]); setIsPlaying(false); }}>Change</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <audio controls src={audioSrc} className="w-full">
                          Your browser does not support the audio element.
                        </audio>
                        <p className="text-xs text-muted-foreground">Default sample: {audioSrc}</p>
                      </>
                    )}
                    {/* Hidden YT player container */}
                    <div id="yt-audio-player" style={{ width: 0, height: 0, overflow: 'hidden' }} />
                  </div>

                  {/* Attach/autoplay toggles (local only for now) */}
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={attachToEvent} onChange={(e) => setAttachToEvent(e.target.checked)} />
                      Attach selected song to event card
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={autoplayInEvent} onChange={(e) => setAutoplayInEvent(e.target.checked)} disabled={!attachToEvent} />
                      Autoplay on event page
                    </label>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Privacy Settings Section */}
          <Collapsible open={privacyOpen} onOpenChange={setPrivacyOpen}>
            <Card className="backdrop-blur-xl bg-gradient-card border-border/50 shadow-vibrant hover:shadow-glow transition-all duration-500">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/10 transition-all duration-300 rounded-t-xl">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Lock className="w-5 h-5 text-accent-cyan drop-shadow-glow-cyan" />
                      <span className="bg-gradient-primary bg-clip-text text-transparent">
                        {t('eventSettings', language)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {privacyOpen ? '−' : '+'}
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${privacyOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-6 backdrop-blur-sm">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-card border border-border/30 backdrop-blur-sm">
                    <div>
                      <Label htmlFor="is_public" className="text-enhanced-heading">{t('publicEvent', language)}</Label>
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
                          className="data-[state=checked]:bg-gradient-primary"
                        />
                      )}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-card border border-border/30 backdrop-blur-sm">
                    <div>
                      <Label htmlFor="show_attending_count" className="text-enhanced-heading">{t('showAttendingCount', language)}</Label>
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
                          className="data-[state=checked]:bg-gradient-primary"
                        />
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-card border border-border/30 backdrop-blur-sm">
                      <div>
                        <Label htmlFor="auto_delete_enabled" className="text-enhanced-heading">{t('autoDelete', language)}</Label>
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
                            className="data-[state=checked]:bg-gradient-primary"
                          />
                        )}
                      />
                    </div>

                    {watchedValues.auto_delete_enabled && (
                      <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-orange-50/80 to-orange-100/80 dark:from-orange-950/50 dark:to-orange-900/50 border border-orange-200/50 dark:border-orange-800/50 rounded-lg backdrop-blur-sm">
                        <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-orange-800 dark:text-orange-200">Auto-delete Warning</p>
                          <p className="text-orange-700 dark:text-orange-300 mt-1">
                            This event will be automatically deleted 24 hours after the event date passes. 
                            All associated data including RSVPs and messages will be permanently removed.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator className="bg-gradient-to-r from-transparent via-border to-transparent" />

                  <div className="space-y-2 p-4 rounded-lg bg-gradient-card border border-border/30 backdrop-blur-sm">
                    <h4 className="font-medium text-enhanced-heading">Shareable Link</h4>
                    <p className="text-sm text-muted-foreground">
                      Once created, your event will have a unique shareable link that you can send to others. 
                      The link will allow people to view and RSVP to your event based on your privacy settings.
                    </p>
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
