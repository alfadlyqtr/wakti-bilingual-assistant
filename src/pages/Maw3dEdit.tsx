
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

interface EventData {
  id: string;
  title: string;
  description: string;
  location: string;
  google_maps_link?: string;
  organizer?: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  is_all_day: boolean;
  is_public: boolean;
  background_type: string;
  background_value: string;
  text_style: any;
  template_type?: string;
  created_by: string;
  show_attending_count: boolean;
  auto_delete_enabled: boolean;
  image_blur: number;
  language: string;
}

export default function Maw3dEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [event, setEvent] = useState<EventData | null>(null);

  useEffect(() => {
    if (id) {
      fetchEvent();
    }
  }, [id]);

  const fetchEvent = async () => {
    try {
      const { data, error } = await supabase
        .from('maw3d_events')
        .select('*')
        .eq('id', id)
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
          location: event.location,
          google_maps_link: event.google_maps_link,
          organizer: event.organizer,
          event_date: event.event_date,
          start_time: event.start_time,
          end_time: event.end_time,
          is_all_day: event.is_all_day,
          is_public: event.is_public,
          background_type: event.background_type,
          background_value: event.background_value,
          text_style: event.text_style,
          show_attending_count: event.show_attending_count,
          auto_delete_enabled: event.auto_delete_enabled,
          image_blur: event.image_blur,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast.success(language === 'ar' ? 'تم تحديث الحدث بنجاح' : 'Event updated successfully');
      navigate(`/maw3d/event/${id}`);
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
        .eq('event_id', id);

      // Delete the event
      const { error } = await supabase
        .from('maw3d_events')
        .delete()
        .eq('id', id);

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

            {/* Organizer */}
            <div className="space-y-2">
              <Label htmlFor="organizer">
                {language === 'ar' ? 'المنظم' : 'Organizer'}
              </Label>
              <Input
                id="organizer"
                value={event.organizer || ''}
                onChange={(e) => updateEvent('organizer', e.target.value)}
                placeholder={language === 'ar' ? 'أدخل اسم المنظم' : 'Enter organizer name'}
              />
            </div>

            {/* Date */}
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

            {/* All Day Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="isAllDay">
                  {language === 'ar' ? 'طوال اليوم' : 'All Day'}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'حدث لطوال اليوم' : 'Event lasts all day'}
                </p>
              </div>
              <Switch
                id="isAllDay"
                checked={event.is_all_day}
                onCheckedChange={(checked) => updateEvent('is_all_day', checked)}
              />
            </div>

            {/* Time Fields - Only show if not all day */}
            {!event.is_all_day && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {language === 'ar' ? 'وقت البداية' : 'Start Time'}
                  </Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={event.start_time || ''}
                    onChange={(e) => updateEvent('start_time', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {language === 'ar' ? 'وقت النهاية' : 'End Time'}
                  </Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={event.end_time || ''}
                    onChange={(e) => updateEvent('end_time', e.target.value)}
                  />
                </div>
              </div>
            )}

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

            {/* Google Maps Link */}
            <div className="space-y-2">
              <Label htmlFor="googleMapsLink">
                {language === 'ar' ? 'رابط خرائط جوجل' : 'Google Maps Link'}
              </Label>
              <Input
                id="googleMapsLink"
                value={event.google_maps_link || ''}
                onChange={(e) => updateEvent('google_maps_link', e.target.value)}
                placeholder={language === 'ar' ? 'أدخل رابط خرائط جوجل' : 'Enter Google Maps link'}
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
                  <Label htmlFor="showAttendingCount">
                    {language === 'ar' ? 'عرض عدد الحضور' : 'Show Attending Count'}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {language === 'ar' ? 'عرض عدد الأشخاص المؤكدين للحضور' : 'Display number of confirmed attendees'}
                  </p>
                </div>
                <Switch
                  id="showAttendingCount"
                  checked={event.show_attending_count}
                  onCheckedChange={(checked) => updateEvent('show_attending_count', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="autoDelete">
                    {language === 'ar' ? 'حذف تلقائي' : 'Auto Delete'}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {language === 'ar' ? 'حذف الحدث تلقائياً بعد انتهائه' : 'Automatically delete event after it ends'}
                  </p>
                </div>
                <Switch
                  id="autoDelete"
                  checked={event.auto_delete_enabled}
                  onCheckedChange={(checked) => updateEvent('auto_delete_enabled', checked)}
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
