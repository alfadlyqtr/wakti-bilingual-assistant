import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, MapPin, Users, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { wn1NotificationService } from '@/services/wn1NotificationService';

interface EventData {
  id: string;
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  location: string;
  max_attendees: number;
  is_public: boolean;
  requires_approval: boolean;
  created_by: string;
}

export default function Maw3dEdit() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { language } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [event, setEvent] = useState<EventData | null>(null);

  // Clear Maw3d event badges when visiting this page
  useEffect(() => {
    if (user) {
      wn1NotificationService.clearBadgeOnPageVisit('maw3d');
    }
  }, [user]);

  useEffect(() => {
    if (eventId) {
      fetchEvent();
    }
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      const { data, error } = await supabase
        .from('maw3d_events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (error) throw error;

      if (data.created_by !== user?.id) {
        toast.error(language === 'ar' ? 'غير مصرح لك بتعديل هذا الحدث' : 'You are not authorized to edit this event');
        navigate('/maw3d');
        return;
      }

      setEvent(data);
    } catch (error) {
      console.error('Error fetching event:', error);
      toast.error(language === 'ar' ? 'فشل في تحميل الحدث' : 'Failed to load event');
      navigate('/maw3d');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!event) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('maw3d_events')
        .update({
          title: event.title,
          description: event.description,
          event_date: event.event_date,
          event_time: event.event_time,
          location: event.location,
          max_attendees: event.max_attendees,
          is_public: event.is_public,
          requires_approval: event.requires_approval,
          updated_at: new Date().toISOString()
        })
        .eq('id', eventId);

      if (error) throw error;

      toast.success(language === 'ar' ? 'تم تحديث الحدث بنجاح' : 'Event updated successfully');
      navigate(`/maw3d/event/${eventId}`);
    } catch (error) {
      console.error('Error updating event:', error);
      toast.error(language === 'ar' ? 'فشل في تحديث الحدث' : 'Failed to update event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا الحدث؟' : 'Are you sure you want to delete this event?')) {
      return;
    }

    setDeleting(true);
    try {
      // Delete RSVPs first
      await supabase
        .from('maw3d_rsvps')
        .delete()
        .eq('event_id', eventId);

      // Delete the event
      const { error } = await supabase
        .from('maw3d_events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;

      toast.success(language === 'ar' ? 'تم حذف الحدث بنجاح' : 'Event deleted successfully');
      navigate('/maw3d');
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error(language === 'ar' ? 'فشل في حذف الحدث' : 'Failed to delete event');
    } finally {
      setDeleting(false);
    }
  };

  const updateEvent = (field: keyof EventData, value: any) => {
    if (event) {
      setEvent({ ...event, [field]: value });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-4">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-64 bg-muted rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {language === 'ar' ? 'الحدث غير موجود' : 'Event not found'}
          </h2>
          <Button onClick={() => navigate('/maw3d')}>
            {language === 'ar' ? 'العودة للأحداث' : 'Back to Events'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/maw3d')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {language === 'ar' ? 'العودة' : 'Back'}
          </Button>
          <h1 className="text-2xl font-bold text-foreground">
            {language === 'ar' ? 'تعديل الحدث' : 'Edit Event'}
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {language === 'ar' ? 'تفاصيل الحدث' : 'Event Details'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                {language === 'ar' ? 'عنوان الحدث' : 'Event Title'}
              </Label>
              <Input
                id="title"
                value={event.title}
                onChange={(e) => updateEvent('title', e.target.value)}
                placeholder={language === 'ar' ? 'أدخل عنوان الحدث' : 'Enter event title'}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                {language === 'ar' ? 'وصف الحدث' : 'Event Description'}
              </Label>
              <Textarea
                id="description"
                value={event.description}
                onChange={(e) => updateEvent('description', e.target.value)}
                placeholder={language === 'ar' ? 'أدخل وصف الحدث' : 'Enter event description'}
                rows={4}
              />
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {language === 'ar' ? 'التاريخ' : 'Date'}
                </Label>
                <Input
                  id="date"
                  type="date"
                  value={event.event_date}
                  onChange={(e) => updateEvent('event_date', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {language === 'ar' ? 'الوقت' : 'Time'}
                </Label>
                <Input
                  id="time"
                  type="time"
                  value={event.event_time}
                  onChange={(e) => updateEvent('event_time', e.target.value)}
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {language === 'ar' ? 'الموقع' : 'Location'}
              </Label>
              <Input
                id="location"
                value={event.location}
                onChange={(e) => updateEvent('location', e.target.value)}
                placeholder={language === 'ar' ? 'أدخل موقع الحدث' : 'Enter event location'}
              />
            </div>

            {/* Max Attendees */}
            <div className="space-y-2">
              <Label htmlFor="maxAttendees" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {language === 'ar' ? 'الحد الأقصى للحضور' : 'Maximum Attendees'}
              </Label>
              <Input
                id="maxAttendees"
                type="number"
                min="1"
                value={event.max_attendees}
                onChange={(e) => updateEvent('max_attendees', parseInt(e.target.value) || 1)}
              />
            </div>

            {/* Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">
                {language === 'ar' ? 'إعدادات الحدث' : 'Event Settings'}
              </h3>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="isPublic">
                    {language === 'ar' ? 'حدث عام' : 'Public Event'}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {language === 'ar' ? 'يمكن لأي شخص رؤية هذا الحدث' : 'Anyone can see this event'}
                  </p>
                </div>
                <Switch
                  id="isPublic"
                  checked={event.is_public}
                  onCheckedChange={(checked) => updateEvent('is_public', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="requiresApproval">
                    {language === 'ar' ? 'يتطلب موافقة' : 'Requires Approval'}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {language === 'ar' ? 'يجب الموافقة على طلبات الحضور' : 'Attendance requests must be approved'}
                  </p>
                </div>
                <Switch
                  id="requiresApproval"
                  checked={event.requires_approval}
                  onCheckedChange={(checked) => updateEvent('requires_approval', checked)}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 flex-1"
              >
                <Save className="h-4 w-4" />
                {saving ? 
                  (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') :
                  (language === 'ar' ? 'حفظ التغييرات' : 'Save Changes')
                }
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? 
                  (language === 'ar' ? 'جاري الحذف...' : 'Deleting...') :
                  (language === 'ar' ? 'حذف الحدث' : 'Delete Event')
                }
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
