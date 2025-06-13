
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ArrowLeft, Plus } from 'lucide-react';
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
import { EventFormData, TextStyle, EventTemplate } from '@/types/maw3d';

const defaultTextStyle: TextStyle = {
  fontSize: 16,
  fontFamily: 'Arial',
  color: '#000000',
  isBold: false,
  isItalic: false,
  isUnderline: false,
  hasShadow: false,
  shadowIntensity: 0,
  alignment: 'center'
};

export default function Maw3dCreate() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EventTemplate | null>(null);
  const [imageBlur, setImageBlur] = useState(0);
  const [searchParams] = useSearchParams();

  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    description: '',
    location: '',
    google_maps_link: '',
    organizer: '',
    event_date: '',
    start_time: '',
    end_time: '',
    is_all_day: false,
    is_public: true,
    show_attending_count: false,
    auto_delete_enabled: true,
    background_type: 'color',
    background_value: '#3b82f6',
    text_style: defaultTextStyle,
    template_type: null,
    invited_contacts: [],
    image_blur: 0
  });

  // Check for background image URL parameter on component mount
  useEffect(() => {
    const bgImage = searchParams.get('bg_image');
    const bgType = searchParams.get('bg_type');
    
    if (bgImage) {
      console.log('Applying background image from URL parameter:', bgImage);
      setFormData(prev => ({
        ...prev,
        background_type: (bgType as 'ai' | 'image') || 'ai',
        background_value: bgImage
      }));
      
      // Show success message
      toast.success(
        language === 'ar' 
          ? 'تم تطبيق خلفية الذكي الاصطناعي بنجاح!' 
          : 'AI background applied successfully!'
      );
      
      // Clear the URL parameters for cleaner URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [searchParams, language]);

  const handleInputChange = (field: keyof EventFormData, value: any) => {
    console.log(`Updating field ${String(field)} with value:`, value);
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTextStyleChange = (updates: Partial<TextStyle>) => {
    setFormData(prev => ({
      ...prev,
      text_style: { ...prev.text_style, ...updates }
    }));
  };

  const handleBackgroundChange = (type: 'color' | 'gradient' | 'image' | 'ai', value: string) => {
    setFormData(prev => ({
      ...prev,
      background_type: type,
      background_value: value
    }));
  };

  const handleImageBlurChange = (blur: number) => {
    setImageBlur(blur);
    setFormData(prev => ({
      ...prev,
      image_blur: blur
    }));
  };

  const handleTemplateSelect = (template: EventTemplate | null) => {
    setSelectedTemplate(template);
    if (template) {
      setFormData(prev => ({
        ...prev,
        title: template.title,
        description: template.description,
        organizer: template.organizer || prev.organizer,
        background_type: template.background_type,
        background_value: template.background_value,
        text_style: template.text_style,
        template_type: template.id
      }));
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error(t('pleaseCompleteAllRequiredFields', language));
      return;
    }

    if (!formData.title.trim()) {
      toast.error(t('enterEventTitle', language));
      return;
    }

    if (!formData.event_date) {
      toast.error(t('selectDate', language));
      return;
    }

    setIsLoading(true);
    try {
      console.log('Creating event with form data:', formData);
      
      // Sanitize time fields - convert empty strings to null
      const sanitizeTimeField = (timeValue: string | null): string | null => {
        if (!timeValue || timeValue.trim() === '') {
          return null;
        }
        return timeValue.trim();
      };

      // Create the event with proper time field handling
      const eventData = {
        ...formData,
        created_by: user.id,
        // Critical fix: Convert empty time strings to null for PostgreSQL compatibility
        start_time: formData.is_all_day ? null : sanitizeTimeField(formData.start_time),
        end_time: formData.is_all_day ? null : sanitizeTimeField(formData.end_time),
        language: language // Set current language
      };

      console.log('Sanitized event data before DB insert:', {
        ...eventData,
        start_time: eventData.start_time,
        end_time: eventData.end_time,
        is_all_day: eventData.is_all_day,
        auto_delete_enabled: eventData.auto_delete_enabled,
        image_blur: eventData.image_blur
      });

      // Remove invited_contacts from the event data as it's not used anymore
      const { invited_contacts, ...dbEventData } = eventData;
      
      const newEvent = await Maw3dService.createEvent(dbEventData);
      console.log('Event created successfully:', newEvent);

      toast.success(t('eventCreatedSuccessfully', language));
      navigate('/maw3d');
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error(t('errorCreatingEvent', language));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide bg-background">
      <div className="p-4 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigate('/maw3d')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('backToEvents', language)}
          </Button>
          <h1 className="text-lg font-semibold">{t('createEvent', language)}</h1>
          <Button onClick={handleSubmit} disabled={isLoading}>
            <Plus className="w-4 h-4 mr-2" />
            {isLoading ? t('creating', language) : t('create', language)}
          </Button>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Preview */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4">{t('eventDetails', language)}</h2>
              <EventPreview
                event={{
                  id: '',
                  title: formData.title || t('eventTitle', language),
                  description: formData.description,
                  location: formData.location,
                  google_maps_link: formData.google_maps_link,
                  organizer: formData.organizer,
                  event_date: formData.event_date,
                  start_time: formData.start_time,
                  end_time: formData.end_time,
                  is_all_day: formData.is_all_day,
                  is_public: formData.is_public,
                  show_attending_count: formData.show_attending_count,
                  background_type: formData.background_type,
                  background_value: formData.background_value,
                  text_style: formData.text_style,
                  template_type: formData.template_type,
                  created_by: user?.id || '',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  short_id: null,
                  language: language,
                  auto_delete_enabled: formData.auto_delete_enabled,
                  image_blur: formData.image_blur
                }}
                textStyle={formData.text_style}
                backgroundType={formData.background_type}
                backgroundValue={formData.background_value}
                rsvpCount={{ accepted: 0, declined: 0 }}
                showAttendingCount={formData.show_attending_count}
                language={language}
                imageBlur={imageBlur}
              />
            </CardContent>
          </Card>

          {/* Collapsible Sections */}
          <Accordion type="multiple" className="space-y-4">
            
            {/* Choose Template Section */}
            <AccordionItem value="templates" className="border rounded-lg">
              <Card>
                <AccordionTrigger className="px-6 pt-6 pb-2 hover:no-underline">
                  <h2 className="text-lg font-semibold">📂 {t('eventTemplates', language)}</h2>
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
                        value={formData.title}
                        onChange={(e) => handleInputChange('title', e.target.value)}
                        placeholder={t('enterEventTitle', language)}
                      />
                    </div>

                    <div>
                      <Label htmlFor="description">{t('description', language)}</Label>
                      <Textarea
                        id="description"
                        value={formData.description || ''}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        placeholder={t('enterEventDescription', language)}
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label htmlFor="organizer">{t('organizer', language)}</Label>
                      <Input
                        id="organizer"
                        value={formData.organizer || ''}
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
                          value={formData.event_date}
                          onChange={(e) => handleInputChange('event_date', e.target.value)}
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="all_day"
                          checked={formData.is_all_day}
                          onCheckedChange={(checked) => handleInputChange('is_all_day', checked)}
                        />
                        <Label htmlFor="all_day">{t('allDay', language)}</Label>
                      </div>
                    </div>

                    {!formData.is_all_day && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="start_time">{t('startTime', language)}</Label>
                          <Input
                            id="start_time"
                            type="time"
                            value={formData.start_time || ''}
                            onChange={(e) => handleInputChange('start_time', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="end_time">{t('endTime', language)}</Label>
                          <Input
                            id="end_time"
                            type="time"
                            value={formData.end_time || ''}
                            onChange={(e) => handleInputChange('end_time', e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <Label htmlFor="location">{t('location', language)} ({t('optional', language)})</Label>
                      <Input
                        id="location"
                        value={formData.location || ''}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                        placeholder={t('enterLocation', language)}
                      />
                    </div>

                    <div>
                      <Label htmlFor="google_maps_link">{t('googleMapsLink', language)} ({t('optional', language)})</Label>
                      <Input
                        id="google_maps_link"
                        value={formData.google_maps_link || ''}
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
                      textStyle={formData.text_style}
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
                    <BackgroundCustomizer
                      backgroundType={formData.background_type}
                      backgroundValue={formData.background_value}
                      imageBlur={imageBlur}
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
                        checked={formData.is_public}
                        onCheckedChange={(checked) => handleInputChange('is_public', checked)}
                      />
                      <Label htmlFor="is_public">{t('enableShareableLink', language)}</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="show_attending_count"
                        checked={formData.show_attending_count}
                        onCheckedChange={(checked) => handleInputChange('show_attending_count', checked)}
                      />
                      <Label htmlFor="show_attending_count">{t('showAttendingCount', language)}</Label>
                    </div>

                    {/* Auto Delete Toggle Component */}
                    <AutoDeleteToggle
                      enabled={formData.auto_delete_enabled}
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
