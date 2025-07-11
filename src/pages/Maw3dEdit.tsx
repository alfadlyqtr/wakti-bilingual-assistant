
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ArrowLeft, Save, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { BackgroundCustomizer } from '@/components/maw3d/BackgroundCustomizer';
import TextStyleCustomizer from '@/components/maw3d/TextStyleCustomizer';
import { EventPreview } from '@/components/maw3d/EventPreview';
import { EventTemplates } from '@/components/maw3d/EventTemplates';
import AutoDeleteToggle from '@/components/maw3d/AutoDeleteToggle';
import { Maw3dService } from '@/services/maw3dService';
import { Maw3dEvent, TextStyle, EventTemplate } from '@/types/maw3d';

export default function Maw3dEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [event, setEvent] = useState<Maw3dEvent | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<EventTemplate | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (id) {
      fetchEvent();
    }
  }, [id]);

  const fetchEvent = async () => {
    try {
      if (!id) return;
      
      const eventData = await Maw3dService.getEvent(id);
      if (!eventData) {
        toast.error('Event not found');
        navigate('/maw3d');
        return;
      }

      if (eventData.created_by !== user?.id) {
        toast.error('You can only edit events you created');
        navigate('/maw3d');
        return;
      }

      // Set defaults for events that don't have these values set
      const eventWithDefaults = {
        ...eventData,
        is_public: eventData.is_public !== undefined ? eventData.is_public : true,
        show_attending_count: eventData.show_attending_count !== undefined ? eventData.show_attending_count : false,
        image_blur: eventData.image_blur !== undefined ? eventData.image_blur : 0
      };

      console.log('Event loaded with image_blur:', eventWithDefaults.image_blur);
      setEvent(eventWithDefaults);
    } catch (error) {
      console.error('Error fetching event:', error);
      toast.error('Failed to load event');
      navigate('/maw3d');
    }
  };

  const handleInputChange = (field: keyof Maw3dEvent, value: any) => {
    if (!event) return;
    console.log(`Updating field ${String(field)} with value:`, value);
    setEvent(prev => prev ? { ...prev, [field]: value } : null);
    setIsSaved(false); // Mark as unsaved when changes are made
  };

  const handleTextStyleChange = (updates: Partial<TextStyle>) => {
    if (!event) return;
    setEvent(prev => prev ? {
      ...prev,
      text_style: { ...prev.text_style, ...updates }
    } : null);
    setIsSaved(false);
  };

  const handleBackgroundChange = (type: 'color' | 'gradient' | 'image' | 'ai', value: string) => {
    if (!event) return;
    console.log('Background change:', { type, value });
    setEvent(prev => prev ? {
      ...prev,
      background_type: type,
      background_value: value
    } : null);
    setIsSaved(false);
  };

  const handleImageBlurChange = (blur: number) => {
    if (!event) return;
    console.log('=== IMAGE BLUR CHANGE ===');
    console.log('Previous blur value:', event.image_blur);
    console.log('New blur value:', blur);
    console.log('Blur value type:', typeof blur);
    
    setEvent(prev => {
      if (!prev) return null;
      const updatedEvent = {
        ...prev,
        image_blur: blur
      };
      console.log('Event state updated with image_blur:', updatedEvent.image_blur);
      return updatedEvent;
    });
    setIsSaved(false);
    
    // Show real-time feedback
    toast(`Image blur set to ${blur}px`, { 
      duration: 1500,
      description: 'Changes will be saved when you click Save'
    });
  };

  const handleTemplateSelect = (template: EventTemplate | null) => {
    setSelectedTemplate(template);
    if (template && event) {
      setEvent(prev => prev ? {
        ...prev,
        title: template.title,
        description: template.description,
        organizer: template.organizer || prev.organizer,
        background_type: template.background_type,
        background_value: template.background_value,
        text_style: template.text_style
      } : null);
      setIsSaved(false);
    }
  };

  const handleSubmit = async () => {
    if (!event || !user) return;

    if (!event.title.trim()) {
      toast.error('Please enter an event title');
      return;
    }

    if (!event.event_date) {
      toast.error('Please select an event date');
      return;
    }

    setIsLoading(true);
    try {
      console.log('=== SAVING EVENT WITH DETAILED LOGGING ===');
      console.log('Event image_blur before save:', event.image_blur);
      console.log('Event image_blur type:', typeof event.image_blur);
      console.log('Full event object:', {
        id: event.id,
        title: event.title,
        image_blur: event.image_blur,
        background_type: event.background_type,
        background_value: event.background_value
      });
      
      // Ensure the event language is set to current UI language and image_blur is a number
      const updatedEventData = {
        ...event,
        language: language, // Save the current language setting
        image_blur: Number(event.image_blur) // Ensure it's saved as a number
      };
      
      console.log('Final event data being saved:', {
        id: updatedEventData.id,
        image_blur: updatedEventData.image_blur,
        image_blur_type: typeof updatedEventData.image_blur
      });
      
      // Update the event
      const updatedEvent = await Maw3dService.updateEvent(event.id, updatedEventData);
      console.log('=== EVENT SAVED SUCCESSFULLY ===');
      console.log('Returned event image_blur:', updatedEvent.image_blur);
      console.log('Returned event image_blur type:', typeof updatedEvent.image_blur);

      // Set success states
      setIsSaved(true);
      setShowSuccessMessage(true);
      
      // Show comprehensive success message
      toast.success(`Event updated successfully! Image blur: ${updatedEvent.image_blur}px`, {
        duration: 4000,
        description: 'All settings have been saved to the database.'
      });

      // Update local state with the returned data to ensure sync
      setEvent(updatedEvent);

      // Delay navigation to show success state
      setTimeout(() => {
        navigate('/maw3d');
      }, 3000);
    } catch (error) {
      console.error('=== ERROR SAVING EVENT ===');
      console.error('Error details:', error);
      toast.error('Failed to update event. Please try again.');
      setIsSaved(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (!event) {
    return (
      <div className="flex-1 overflow-y-auto bg-background flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-64 h-48 bg-gray-200 rounded-lg mx-auto mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-48 mx-auto mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-32 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide bg-background">
      <div className="p-4 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigate('/maw3d')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('backToEvents', language)}
          </Button>
          <h1 className="text-lg font-semibold">{t('editEvent', language)}</h1>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isSaved ? (
              <>
                <Check className="w-4 h-4 mr-2 text-green-600" />
                {t('save', language) + 'd'}
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {isLoading ? t('updating', language) : t('save', language)}
              </>
            )}
          </Button>
        </div>

        {/* Success Banner */}
        {showSuccessMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <Check className="w-5 h-5 text-green-600 mr-2" />
              <div>
                <p className="text-green-800 font-medium">Event saved successfully!</p>
                <p className="text-green-600 text-sm">
                  All settings including image blur ({event.image_blur}px) have been saved to the database.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Preview */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4">{t('eventPreview', language)}</h2>
              <div className="mb-2 text-sm text-muted-foreground">
                Current image blur: {event.image_blur}px {!isSaved && '(unsaved)'}
              </div>
              <EventPreview
                event={event}
                textStyle={event.text_style}
                backgroundType={event.background_type}
                backgroundValue={event.background_value}
                rsvpCount={{ accepted: 0, declined: 0 }}
                showAttendingCount={event.show_attending_count}
                language={language}
                imageBlur={event.image_blur}
              />
            </CardContent>
          </Card>

          {/* Collapsible Sections - All collapsed by default */}
          <Accordion type="multiple" className="space-y-4">
            
            {/* Choose Template Section */}
            <AccordionItem value="templates" className="border rounded-lg">
              <Card>
                <AccordionTrigger className="px-6 pt-6 pb-2 hover:no-underline">
                  <h2 className="text-lg font-semibold">📂 {t('chooseTemplate', language)}</h2>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="px-6 pb-6">
                    <EventTemplates
                      onSelectTemplate={handleTemplateSelect}
                      selectedTemplate={selectedTemplate}
                      language={language}
                    />
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            {/* Event Details Section */}
            <AccordionItem value="details" className="border rounded-lg">
              <Card>
                <AccordionTrigger className="px-6 pt-6 pb-2 hover:no-underline">
                  <h2 className="text-lg font-semibold">📝 {t('eventDetails', language)}</h2>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="px-6 pb-6 space-y-4">
                    
                    <div>
                      <Label htmlFor="title">{t('eventTitle', language)} *</Label>
                      <Input
                        id="title"
                        value={event.title}
                        onChange={(e) => handleInputChange('title', e.target.value)}
                        placeholder={t('enterEventTitle', language)}
                      />
                    </div>

                    <div>
                      <Label htmlFor="description">{t('description', language)}</Label>
                      <Textarea
                        id="description"
                        value={event.description || ''}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        placeholder={t('enterEventDescription', language)}
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label htmlFor="organizer">{t('organizer', language)}</Label>
                      <Input
                        id="organizer"
                        value={event.organizer || ''}
                        onChange={(e) => handleInputChange('organizer', e.target.value)}
                        placeholder={t('enterOrganizerName', language)}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="event_date">{t('date', language)} *</Label>
                        <Input
                          id="event_date"
                          type="date"
                          value={event.event_date}
                          onChange={(e) => handleInputChange('event_date', e.target.value)}
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="all_day"
                          checked={event.is_all_day}
                          onCheckedChange={(checked) => handleInputChange('is_all_day', checked)}
                        />
                        <Label htmlFor="all_day">{t('allDay', language)}</Label>
                      </div>
                    </div>

                    {!event.is_all_day && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="start_time">{t('startTime', language)}</Label>
                          <Input
                            id="start_time"
                            type="time"
                            value={event.start_time || ''}
                            onChange={(e) => handleInputChange('start_time', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="end_time">{t('endTime', language)}</Label>
                          <Input
                            id="end_time"
                            type="time"
                            value={event.end_time || ''}
                            onChange={(e) => handleInputChange('end_time', e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <Label htmlFor="location">{t('location', language)} ({t('optional', language)})</Label>
                      <Input
                        id="location"
                        value={event.location || ''}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                        placeholder={t('enterLocation', language)}
                      />
                    </div>

                    <div>
                      <Label htmlFor="google_maps_link">{t('googleMapsLink', language)} ({t('optional', language)})</Label>
                      <Input
                        id="google_maps_link"
                        value={event.google_maps_link || ''}
                        onChange={(e) => handleInputChange('google_maps_link', e.target.value)}
                        placeholder="https://maps.google.com/..."
                      />
                    </div>
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            {/* Text Styling Section */}
            <AccordionItem value="text-styling" className="border rounded-lg">
              <Card>
                <AccordionTrigger className="px-6 pt-6 pb-2 hover:no-underline">
                  <h2 className="text-lg font-semibold">🎨 {t('textStyling', language)}</h2>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="px-6 pb-6">
                    <TextStyleCustomizer
                      textStyle={event.text_style}
                      onTextStyleChange={handleTextStyleChange}
                      language={language}
                    />
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            {/* Background Customization Section */}
            <AccordionItem value="background" className="border rounded-lg">
              <Card>
                <AccordionTrigger className="px-6 pt-6 pb-2 hover:no-underline">
                  <h2 className="text-lg font-semibold">🖼️ {t('backgroundCustomization', language)}</h2>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="px-6 pb-6">
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center">
                        <div className="text-blue-600 text-sm">
                          💡 Current image blur setting: <strong>{event.image_blur}px</strong>
                          {!isSaved && <span className="text-orange-600 ml-2">(unsaved)</span>}
                        </div>
                      </div>
                    </div>
                    <BackgroundCustomizer
                      backgroundType={event.background_type}
                      backgroundValue={event.background_value}
                      imageBlur={event.image_blur}
                      onBackgroundChange={handleBackgroundChange}
                      onImageBlurChange={handleImageBlurChange}
                      language={language}
                    />
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            {/* Privacy Settings Section */}
            <AccordionItem value="privacy" className="border rounded-lg">
              <Card>
                <AccordionTrigger className="px-6 pt-6 pb-2 hover:no-underline">
                  <h2 className="text-lg font-semibold">🔒 {t('privacySettings', language)}</h2>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="px-6 pb-6 space-y-6">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_public"
                        checked={event.is_public}
                        onCheckedChange={(checked) => handleInputChange('is_public', checked)}
                      />
                      <Label htmlFor="is_public">{t('enableShareableLink', language)}</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="show_attending_count"
                        checked={event.show_attending_count}
                        onCheckedChange={(checked) => {
                          console.log('Toggle changed to:', checked);
                          handleInputChange('show_attending_count', checked);
                        }}
                      />
                      <Label htmlFor="show_attending_count">{t('showAttendingCount', language)}</Label>
                    </div>

                    {/* Auto Delete Toggle Component */}
                    <AutoDeleteToggle
                      enabled={event.auto_delete_enabled}
                      onChange={(enabled) => handleInputChange('auto_delete_enabled', enabled)}
                      language={language}
                    />

                    <div className="bg-muted/50 p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        {t('shareableLinkDescription', language)}
                      </p>
                    </div>
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

          </Accordion>
        </div>
      </div>
    </div>
  );
}
