import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ArrowLeft, Plus, Users, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { BackgroundCustomizer } from '@/components/maw3d/BackgroundCustomizer';
import { TextStyleCustomizer } from '@/components/maw3d/TextStyleCustomizer';
import { EventPreview } from '@/components/maw3d/EventPreview';
import { ContactsSelector } from '@/components/maw3d/ContactsSelector';
import { EventTemplates } from '@/components/maw3d/EventTemplates';
import { Maw3dService } from '@/services/maw3dService';
import { CreateEventFormData, TextStyle, EventTemplate } from '@/types/maw3d';

const defaultTextStyle: TextStyle = {
  fontSize: 16,
  fontFamily: 'Arial',
  color: '#000000',
  isBold: false,
  isItalic: false,
  isUnderline: false,
  hasShadow: false,
  alignment: 'center'
};

export default function Maw3dCreate() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showContactsSelector, setShowContactsSelector] = useState(false);
  const [invitedContacts, setInvitedContacts] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EventTemplate | null>(null);

  const [formData, setFormData] = useState<CreateEventFormData>({
    title: '',
    description: '',
    location: '',
    google_maps_link: '',
    organizer: '',
    event_date: '',
    start_time: '',
    end_time: '',
    is_all_day: false,
    is_public: false,
    show_attending_count: true,
    background_type: 'color',
    background_value: '#3b82f6',
    text_style: defaultTextStyle,
    template_type: null,
    invited_contacts: []
  });

  const handleInputChange = (field: keyof CreateEventFormData, value: any) => {
    console.log(`Updating field ${field} with value:`, value);
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
        template_type: template.type
      }));
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Please log in to create an event');
      return;
    }

    if (!formData.title.trim()) {
      toast.error('Please enter an event title');
      return;
    }

    if (!formData.event_date) {
      toast.error('Please select an event date');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Creating event with data:', formData);
      
      // Create the event
      const eventData = {
        ...formData,
        created_by: user.id,
        start_time: formData.is_all_day ? null : formData.start_time,
        end_time: formData.is_all_day ? null : formData.end_time,
      };

      // Remove invited_contacts from the event data as it's not a database field
      const { invited_contacts, ...dbEventData } = eventData;
      
      const newEvent = await Maw3dService.createEvent(dbEventData);
      console.log('Event created successfully:', newEvent);

      // Create invitations if any contacts are selected
      if (invitedContacts.length > 0) {
        await Maw3dService.createInvitations(newEvent.id, invitedContacts);
        console.log(`Created ${invitedContacts.length} invitations`);
      }

      toast.success('Event created successfully!');
      navigate('/maw3d');
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Failed to create event. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="p-4 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigate('/maw3d')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-lg font-semibold">Create Event</h1>
          <Button onClick={handleSubmit} disabled={isLoading}>
            <Plus className="w-4 h-4 mr-2" />
            {isLoading ? 'Creating...' : 'Create'}
          </Button>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Preview */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4">Preview</h2>
              <EventPreview
                event={{
                  id: '',
                  title: formData.title || 'Event Title',
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
                  short_id: null
                }}
                textStyle={formData.text_style}
                backgroundType={formData.background_type}
                backgroundValue={formData.background_value}
                showAttendingCount={formData.show_attending_count}
              />
            </CardContent>
          </Card>

          {/* Collapsible Sections */}
          <Accordion type="multiple" className="space-y-4">
            
            {/* Choose Template Section */}
            <AccordionItem value="templates" className="border rounded-lg">
              <Card>
                <AccordionTrigger className="px-6 pt-6 pb-2 hover:no-underline">
                  <h2 className="text-lg font-semibold">📂 Choose Template</h2>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="px-6 pb-6">
                    <EventTemplates
                      onSelectTemplate={handleTemplateSelect}
                      selectedTemplate={selectedTemplate}
                    />
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            {/* Event Details Section */}
            <AccordionItem value="details" className="border rounded-lg">
              <Card>
                <AccordionTrigger className="px-6 pt-6 pb-2 hover:no-underline">
                  <h2 className="text-lg font-semibold">📝 Event Details</h2>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="px-6 pb-6 space-y-4">
                    <div>
                      <Label htmlFor="title">Event Title *</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => handleInputChange('title', e.target.value)}
                        placeholder="Enter event title"
                      />
                    </div>

                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description || ''}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        placeholder="Tell people about your event"
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label htmlFor="organizer">Organizer</Label>
                      <Input
                        id="organizer"
                        value={formData.organizer || ''}
                        onChange={(e) => handleInputChange('organizer', e.target.value)}
                        placeholder="Enter organizer name"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="event_date">Date *</Label>
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
                        <Label htmlFor="all_day">All Day Event</Label>
                      </div>
                    </div>

                    {!formData.is_all_day && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="start_time">Start Time</Label>
                          <Input
                            id="start_time"
                            type="time"
                            value={formData.start_time || ''}
                            onChange={(e) => handleInputChange('start_time', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="end_time">End Time</Label>
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
                      <Label htmlFor="location">Location (Optional)</Label>
                      <Input
                        id="location"
                        value={formData.location || ''}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                        placeholder="Enter event location"
                      />
                    </div>

                    <div>
                      <Label htmlFor="google_maps_link">Google Maps Link (Optional)</Label>
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
                  <h2 className="text-lg font-semibold">🎨 Text Styling</h2>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="px-6 pb-6">
                    <TextStyleCustomizer
                      textStyle={formData.text_style}
                      onTextStyleChange={handleTextStyleChange}
                    />
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            {/* Background Customization Section */}
            <AccordionItem value="background" className="border rounded-lg">
              <Card>
                <AccordionTrigger className="px-6 pt-6 pb-2 hover:no-underline">
                  <h2 className="text-lg font-semibold">🖼️ Background Customization</h2>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="px-6 pb-6">
                    <BackgroundCustomizer
                      backgroundType={formData.background_type}
                      backgroundValue={formData.background_value}
                      onBackgroundChange={handleBackgroundChange}
                    />
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            {/* Privacy & Invitations Section */}
            <AccordionItem value="privacy" className="border rounded-lg">
              <Card>
                <AccordionTrigger className="px-6 pt-6 pb-2 hover:no-underline">
                  <h2 className="text-lg font-semibold">🔒 Privacy & Invitations</h2>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="px-6 pb-6 space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_public"
                        checked={formData.is_public}
                        onCheckedChange={(checked) => handleInputChange('is_public', checked)}
                      />
                      <Label htmlFor="is_public">Enable shareable link (Anyone with link can view and RSVP)</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="show_attending_count"
                        checked={formData.show_attending_count}
                        onCheckedChange={(checked) => handleInputChange('show_attending_count', checked)}
                      />
                      <Label htmlFor="show_attending_count">Show attending count to invitees</Label>
                    </div>

                    {/* Send to Contacts Section */}
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <Label className="text-base font-medium">Send to Contacts</Label>
                          <p className="text-sm text-muted-foreground">Invite your Wakti contacts to this event</p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => setShowContactsSelector(true)}
                          className="gap-2"
                        >
                          <UserPlus className="w-4 h-4" />
                          Select Contacts
                        </Button>
                      </div>
                      
                      {invitedContacts.length > 0 && (
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span className="text-sm font-medium">
                              {invitedContacts.length} contact{invitedContacts.length !== 1 ? 's' : ''} will be invited
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

          </Accordion>
        </div>

        {/* ContactsSelector */}
        <ContactsSelector
          isOpen={showContactsSelector}
          onClose={() => setShowContactsSelector(false)}
          selectedContacts={invitedContacts}
          onContactsChange={setInvitedContacts}
          isEditMode={false}
        />
      </div>
    </div>
  );
}
