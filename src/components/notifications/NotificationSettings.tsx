
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/providers/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Bell, 
  Volume2, 
  Vibrate, 
  Moon, 
  MessageSquare, 
  Users, 
  CheckSquare, 
  Calendar,
  Gift
} from 'lucide-react';

interface NotificationPreferences {
  enableToasts: boolean;
  enableBadges: boolean;
  enableVibration: boolean;
  enableSounds: boolean;
  soundVolume: number;
  // Specific notification types
  messages: boolean;
  contact_requests: boolean;
  task_updates: boolean;
  shared_task_updates: boolean;
  event_rsvps: boolean;
  calendar_reminders: boolean;
  admin_gifts: boolean;
  // Sound and badge settings
  notification_sound: 'chime' | 'beep' | 'ding';
  show_badges: boolean;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

export const NotificationSettings: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    enableToasts: true,
    enableBadges: true,
    enableVibration: true,
    enableSounds: true,
    soundVolume: 70,
    // Notification types - all enabled by default
    messages: true,
    contact_requests: true,
    task_updates: true,
    shared_task_updates: true,
    event_rsvps: true,
    calendar_reminders: true,
    admin_gifts: true,
    // Sound and badge settings
    notification_sound: 'chime',
    show_badges: true,
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00'
    }
  });

  useEffect(() => {
    if (!user) return;
    
    const loadPreferences = async () => {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('profiles')
          .select('notification_preferences')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        if (data?.notification_preferences) {
          setPreferences(prev => ({
            ...prev,
            ...data.notification_preferences
          }));
        }
      } catch (error) {
        console.error('Error loading notification preferences:', error);
        toast.error('Failed to load notification preferences');
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [user]);

  const savePreferences = async (newPreferences: Partial<NotificationPreferences>) => {
    if (!user) return;

    try {
      setSaving(true);
      
      const updatedPreferences = { ...preferences, ...newPreferences };
      
      const { error } = await supabase
        .from('profiles')
        .update({ 
          notification_preferences: updatedPreferences,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      setPreferences(updatedPreferences);
      toast.success('Notification preferences updated');
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      toast.error('Failed to save notification preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: keyof NotificationPreferences, value: boolean) => {
    savePreferences({ [key]: value });
  };

  const handleSliderChange = (key: keyof NotificationPreferences, value: number[]) => {
    savePreferences({ [key]: value[0] });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-8 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            General Notification Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Toasts</Label>
              <p className="text-sm text-muted-foreground">Show popup notifications</p>
            </div>
            <Switch 
              checked={preferences.enableToasts}
              onCheckedChange={(checked) => handleToggle('enableToasts', checked)}
              disabled={saving}
            />
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Badges</Label>
              <p className="text-sm text-muted-foreground">Show notification count badges</p>
            </div>
            <Switch 
              checked={preferences.enableBadges}
              onCheckedChange={(checked) => handleToggle('enableBadges', checked)}
              disabled={saving}
            />
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                Enable Sounds
              </Label>
              <p className="text-sm text-muted-foreground">Play notification sounds</p>
            </div>
            <Switch 
              checked={preferences.enableSounds}
              onCheckedChange={(checked) => handleToggle('enableSounds', checked)}
              disabled={saving}
            />
          </div>
          
          {preferences.enableSounds && (
            <div className="space-y-2 ml-6">
              <Label>Sound Volume: {preferences.soundVolume}%</Label>
              <Slider
                value={[preferences.soundVolume]}
                onValueChange={(value) => handleSliderChange('soundVolume', value)}
                max={100}
                step={10}
                className="w-full"
                disabled={saving}
              />
              
              <div className="space-y-2">
                <Label>Notification Sound</Label>
                <Select 
                  value={preferences.notification_sound} 
                  onValueChange={(value: 'chime' | 'beep' | 'ding') => savePreferences({ notification_sound: value })}
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chime">Chime</SelectItem>
                    <SelectItem value="beep">Beep</SelectItem>
                    <SelectItem value="ding">Ding</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Vibrate className="h-4 w-4" />
                Enable Vibration
              </Label>
              <p className="text-sm text-muted-foreground">Vibrate on mobile devices</p>
            </div>
            <Switch 
              checked={preferences.enableVibration}
              onCheckedChange={(checked) => handleToggle('enableVibration', checked)}
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Types */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Types</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Messages
              </Label>
              <p className="text-sm text-muted-foreground">New messages from contacts</p>
            </div>
            <Switch 
              checked={preferences.messages}
              onCheckedChange={(checked) => handleToggle('messages', checked)}
              disabled={saving}
            />
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Contact Requests
              </Label>
              <p className="text-sm text-muted-foreground">New contact requests</p>
            </div>
            <Switch 
              checked={preferences.contact_requests}
              onCheckedChange={(checked) => handleToggle('contact_requests', checked)}
              disabled={saving}
            />
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4" />
                Task Updates
              </Label>
              <p className="text-sm text-muted-foreground">Task status changes and reminders</p>
            </div>
            <Switch 
              checked={preferences.task_updates}
              onCheckedChange={(checked) => handleToggle('task_updates', checked)}
              disabled={saving}
            />
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4" />
                Shared Task Updates
              </Label>
              <p className="text-sm text-muted-foreground">Updates on shared tasks</p>
            </div>
            <Switch 
              checked={preferences.shared_task_updates}
              onCheckedChange={(checked) => handleToggle('shared_task_updates', checked)}
              disabled={saving}
            />
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Event RSVPs
              </Label>
              <p className="text-sm text-muted-foreground">Event responses and updates</p>
            </div>
            <Switch 
              checked={preferences.event_rsvps}
              onCheckedChange={(checked) => handleToggle('event_rsvps', checked)}
              disabled={saving}
            />
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Calendar Reminders
              </Label>
              <p className="text-sm text-muted-foreground">Upcoming events and tasks</p>
            </div>
            <Switch 
              checked={preferences.calendar_reminders}
              onCheckedChange={(checked) => handleToggle('calendar_reminders', checked)}
              disabled={saving}
            />
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Gift className="h-4 w-4" />
                Admin Gifts
              </Label>
              <p className="text-sm text-muted-foreground">Gifts and bonuses from admin</p>
            </div>
            <Switch 
              checked={preferences.admin_gifts}
              onCheckedChange={(checked) => handleToggle('admin_gifts', checked)}
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5" />
            Quiet Hours
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Quiet Hours</Label>
              <p className="text-sm text-muted-foreground">Mute notifications during specified hours</p>
            </div>
            <Switch 
              checked={preferences.quietHours.enabled}
              onCheckedChange={(checked) => savePreferences({ 
                quietHours: { ...preferences.quietHours, enabled: checked }
              })}
              disabled={saving}
            />
          </div>
          
          {preferences.quietHours.enabled && (
            <div className="grid grid-cols-2 gap-4 ml-6">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <input
                  type="time"
                  value={preferences.quietHours.start}
                  onChange={(e) => savePreferences({
                    quietHours: { ...preferences.quietHours, start: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-input rounded-md"
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <input
                  type="time"
                  value={preferences.quietHours.end}
                  onChange={(e) => savePreferences({
                    quietHours: { ...preferences.quietHours, end: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-input rounded-md"
                  disabled={saving}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
