
import React, { useState } from 'react';
import { NavigationHeader } from '@/components/navigation/NavigationHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/providers/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Calendar } from 'lucide-react';

const Maw3dCreate = () => {
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_date: '',
    start_time: '',
    end_time: '',
    location: '',
    is_all_day: false,
    max_attendees: '',
    auto_delete_enabled: true
  });
  
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setCreating(true);
    try {
      const eventData = {
        title: formData.title,
        description: formData.description || null,
        event_date: formData.event_date,
        start_time: formData.is_all_day ? null : formData.start_time || null,
        end_time: formData.is_all_day ? null : formData.end_time || null,
        location: formData.location || null,
        is_all_day: formData.is_all_day,
        max_attendees: formData.max_attendees ? parseInt(formData.max_attendees) : null,
        auto_delete_enabled: formData.auto_delete_enabled,
        created_by: user.id
      };

      const { data, error } = await supabase
        .from('maw3d_events')
        .insert([eventData])
        .select()
        .single();

      if (error) throw error;

      toast.success('Event created successfully!');
      navigate('/maw3d-events');
    } catch (error: any) {
      console.error('Error creating event:', error);
      toast.error('Failed to create event');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader />
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/maw3d-events')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Events
          </Button>
          <h1 className="text-2xl font-bold text-foreground mb-2">Create New Event</h1>
          <p className="text-muted-foreground">Plan and organize your Maw3d event.</p>
        </div>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Event Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="title">Event Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter event title"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe your event (optional)"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="event_date">Event Date *</Label>
                  <Input
                    id="event_date"
                    type="date"
                    value={formData.event_date}
                    onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Event location (optional)"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>All Day Event</Label>
                  <p className="text-sm text-muted-foreground">Toggle for all-day events</p>
                </div>
                <Switch
                  checked={formData.is_all_day}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_all_day: checked })}
                />
              </div>

              {!formData.is_all_day && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_time">Start Time</Label>
                    <Input
                      id="start_time"
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_time">End Time</Label>
                    <Input
                      id="end_time"
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="max_attendees">Maximum Attendees</Label>
                <Input
                  id="max_attendees"
                  type="number"
                  min="1"
                  value={formData.max_attendees}
                  onChange={(e) => setFormData({ ...formData, max_attendees: e.target.value })}
                  placeholder="Leave empty for unlimited"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-delete after event</Label>
                  <p className="text-sm text-muted-foreground">Automatically delete 24h after event ends</p>
                </div>
                <Switch
                  checked={formData.auto_delete_enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, auto_delete_enabled: checked })}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigate('/maw3d-events')}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Event'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Maw3dCreate;
