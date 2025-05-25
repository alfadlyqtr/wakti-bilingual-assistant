
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { BackgroundCustomizer } from '@/components/maw3d/BackgroundCustomizer';
import { TextStyleCustomizer } from '@/components/maw3d/TextStyleCustomizer';
import { EventPreview } from '@/components/maw3d/EventPreview';
import { ContactsSelector } from '@/components/maw3d/ContactsSelector';
import { Maw3dService } from '@/services/maw3dService';
import { Maw3dEvent, TextStyle } from '@/types/maw3d';

export default function Maw3dEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [event, setEvent] = useState<Maw3dEvent | null>(null);
  const [showContactsSelector, setShowContactsSelector] = useState(false);
  const [invitedContacts, setInvitedContacts] = useState<string[]>([]);

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

      setEvent(eventData);

      // Fetch current invitations
      if (!eventData.is_public) {
        const invitations = await Maw3dService.getEventInvitations(eventData.id);
        setInvitedContacts(invitations.map(inv => inv.invited_user_id));
      }
    } catch (error) {
      console.error('Error fetching event:', error);
      toast.error('Failed to load event');
      navigate('/maw3d');
    }
  };

  const handleInputChange = (field: keyof Maw3dEvent, value: any) => {
    if (!event) return;
    setEvent(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleTextStyleChange = (updates: Partial<TextStyle>) => {
    if (!event) return;
    setEvent(prev => prev ? {
      ...prev,
      text_style: { ...prev.text_style, ...updates }
    } : null);
  };

  const handleBackgroundChange = (type: 'color' | 'gradient' | 'image' | 'ai', value: string) => {
    if (!event) return;
    setEvent(prev => prev ? {
      ...prev,
      background_type: type,
      background_value: value
    } : null);
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
      // Update the event
      await Maw3dService.updateEvent(event.id, event);

      // Update invitations if it's a private event
      if (!event.is_public) {
        // This would require additional API methods to handle invitation updates
        // For now, we'll skip this complex logic
      }

      toast.success('Event updated successfully!');
      navigate('/maw3d');
    } catch (error) {
      console.error('Error updating event:', error);
      toast.error('Failed to update event. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-64 h-48 bg-gray-200 rounded-lg mx-auto mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-48 mx-auto mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-32 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col h-screen">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <Button variant="ghost" size="sm" onClick={() => navigate('/maw3d')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-lg font-semibold">Edit Event</h1>
          <Button onClick={handleSubmit} disabled={isLoading}>
            <Save className="w-4 h-4 mr-2" />
            {isLoading ? 'Saving...' : 'Save'}
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
                  event={event}
                  textStyle={event.text_style}
                  backgroundType={event.background_type}
                  backgroundValue={event.background_value}
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
                    value={event.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="Enter event title"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={event.description || ''}
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
                    <Label htmlFor="all_day">All Day Event</Label>
                  </div>
                </div>

                {!event.is_all_day && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="start_time">Start Time</Label>
                      <Input
                        id="start_time"
                        type="time"
                        value={event.start_time || ''}
                        onChange={(e) => handleInputChange('start_time', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="end_time">End Time</Label>
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
                  <Label htmlFor="location">Location (Optional)</Label>
                  <Input
                    id="location"
                    value={event.location || ''}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    placeholder="Enter event location"
                  />
                </div>

                <div>
                  <Label htmlFor="google_maps_link">Google Maps Link (Optional)</Label>
                  <Input
                    id="google_maps_link"
                    value={event.google_maps_link || ''}
                    onChange={(e) => handleInputChange('google_maps_link', e.target.value)}
                    placeholder="https://maps.google.com/..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Privacy Settings */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <h2 className="text-lg font-semibold">Privacy Settings</h2>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_public"
                    checked={event.is_public}
                    onCheckedChange={(checked) => handleInputChange('is_public', checked)}
                  />
                  <Label htmlFor="is_public">Public Event (Anyone with link can view)</Label>
                </div>
              </CardContent>
            </Card>

            {/* Background Customization */}
            <Card>
              <CardContent className="p-6">
                <BackgroundCustomizer
                  backgroundType={event.background_type}
                  backgroundValue={event.background_value}
                  onBackgroundChange={handleBackgroundChange}
                />
              </CardContent>
            </Card>

            {/* Text Styling */}
            <Card>
              <CardContent className="p-6">
                <TextStyleCustomizer
                  textStyle={event.text_style}
                  onTextStyleChange={handleTextStyleChange}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
