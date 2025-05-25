
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Users, Share2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { EventTemplates } from '@/components/maw3d/EventTemplates';
import { BackgroundCustomizer } from '@/components/maw3d/BackgroundCustomizer';
import { TextStyleCustomizer } from '@/components/maw3d/TextStyleCustomizer';
import { EventPreview } from '@/components/maw3d/EventPreview';
import { ContactsSelector } from '@/components/maw3d/ContactsSelector';
import { Maw3dService } from '@/services/maw3dService';
import { CreateEventFormData, EventTemplate, TextStyle } from '@/types/maw3d';

export default function Maw3dCreate() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showContactsSelector, setShowContactsSelector] = useState(false);

  const [selectedTemplate, setSelectedTemplate] = useState<EventTemplate | null>(null);
  const [formData, setFormData] = useState<CreateEventFormData>({
    title: '',
    description: '',
    event_date: '',
    start_time: '09:00',
    end_time: '17:00',
    is_all_day: false,
    location: '',
    google_maps_link: '',
    is_public: false,
    background_type: 'color',
    background_value: '#3b82f6',
    text_style: {
      fontSize: 16,
      fontFamily: 'Arial',
      isBold: false,
      isItalic: false,
      isUnderline: false,
      hasShadow: false,
      alignment: 'left',
      color: '#000000'
    },
    invited_contacts: []
  });

  useEffect(() => {
    if (selectedTemplate) {
      setFormData(prev => ({
        ...prev,
        title: selectedTemplate.title,
        description: selectedTemplate.description,
        background_type: selectedTemplate.background_type,
        background_value: selectedTemplate.background_value,
        text_style: selectedTemplate.text_style,
        template_type: selectedTemplate.id
      }));
    }
  }, [selectedTemplate]);

  const handleInputChange = (field: keyof CreateEventFormData, value: any) => {
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

  const handleSubmit = async () => {
    if (!user) {
      toast.error('You must be logged in to create an event');
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
      // Create the event
      const eventData = {
        ...formData,
        created_by: user.id
      };

      const event = await Maw3dService.createEvent(eventData);

      // Create invitations for selected contacts
      if (!formData.is_public && formData.invited_contacts.length > 0) {
        await Maw3dService.createInvitations(event.id, formData.invited_contacts);
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
    <div className="min-h-screen bg-background">
      <div className="flex flex-col h-screen">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <Button variant="ghost" size="sm" onClick={() => navigate('/maw3d')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-lg font-semibold">Create Event</h1>
          <Button onClick={handleSubmit} disabled={isLoading}>
            <Save className="w-4 h-4 mr-2" />
            {isLoading ? 'Creating...' : 'Create'}
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 pb-20">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Preview */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4">Preview</h2>
                <EventPreview
                  event={formData}
                  textStyle={formData.text_style}
                  backgroundType={formData.background_type}
                  backgroundValue={formData.background_value}
                />
              </CardContent>
            </Card>

            {/* Templates */}
            <Card>
              <CardContent className="p-6">
                <EventTemplates
                  onSelectTemplate={setSelectedTemplate}
                  selectedTemplate={selectedTemplate}
                />
              </CardContent>
            </Card>

            {/* Basic Information */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <h2 className="text-lg font-semibold">Event Details</h2>
                
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
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Tell people about your event"
                    rows={3}
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
                        value={formData.start_time}
                        onChange={(e) => handleInputChange('start_time', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="end_time">End Time</Label>
                      <Input
                        id="end_time"
                        type="time"
                        value={formData.end_time}
                        onChange={(e) => handleInputChange('end_time', e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="location">Location (Optional)</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    placeholder="Enter event location"
                  />
                </div>

                <div>
                  <Label htmlFor="google_maps_link">Google Maps Link (Optional)</Label>
                  <Input
                    id="google_maps_link"
                    value={formData.google_maps_link}
                    onChange={(e) => handleInputChange('google_maps_link', e.target.value)}
                    placeholder="https://maps.google.com/..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Privacy Settings */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <h2 className="text-lg font-semibold">Privacy & Invitations</h2>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_public"
                    checked={formData.is_public}
                    onCheckedChange={(checked) => handleInputChange('is_public', checked)}
                  />
                  <Label htmlFor="is_public">Public Event (Anyone with link can view)</Label>
                </div>

                {!formData.is_public && (
                  <div>
                    <Button
                      variant="outline"
                      onClick={() => setShowContactsSelector(true)}
                      className="w-full"
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Select Contacts to Invite ({formData.invited_contacts.length} selected)
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Background Customization */}
            <Card>
              <CardContent className="p-6">
                <BackgroundCustomizer
                  backgroundType={formData.background_type}
                  backgroundValue={formData.background_value}
                  onBackgroundChange={handleBackgroundChange}
                />
              </CardContent>
            </Card>

            {/* Text Styling */}
            <Card>
              <CardContent className="p-6">
                <TextStyleCustomizer
                  textStyle={formData.text_style}
                  onTextStyleChange={handleTextStyleChange}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <ContactsSelector
        isOpen={showContactsSelector}
        onClose={() => setShowContactsSelector(false)}
        selectedContacts={formData.invited_contacts}
        onContactsChange={(contacts) => handleInputChange('invited_contacts', contacts)}
      />
    </div>
  );
}
