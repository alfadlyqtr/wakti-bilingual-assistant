
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bell, Clock, MessageCircle, Calendar, Users, CheckSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { progressierService } from '@/services/progressierService';

interface NotificationPreferences {
  messages: boolean;
  task_updates: boolean;
  contact_requests: boolean;
  event_rsvps: boolean;
  calendar_reminders: boolean;
  quiet_hours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

export default function NotificationSettings() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    messages: true,
    task_updates: true,
    contact_requests: true,
    event_rsvps: true,
    calendar_reminders: true,
    quiet_hours: {
      enabled: false,
      start: '22:00',
      end: '08:00',
    },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');

  useEffect(() => {
    loadPreferences();
    checkNotificationPermission();
  }, []);

  const loadPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('notification_preferences')
        .eq('id', user?.id)
        .single();

      if (error) throw error;

      if (data?.notification_preferences) {
        setPreferences(data.notification_preferences);
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
      toast.error('Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  const checkNotificationPermission = async () => {
    const permission = await progressierService.getNotificationPermission();
    setPermissionStatus(permission);
  };

  const requestPermission = async () => {
    const permission = await progressierService.requestNotificationPermission();
    setPermissionStatus(permission);
    
    if (permission === 'granted') {
      toast.success('Notifications enabled successfully!');
    } else {
      toast.error('Notification permission denied');
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ notification_preferences: preferences })
        .eq('id', user?.id);

      if (error) throw error;

      toast.success('Notification settings saved successfully!');
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save notification settings');
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = (key: keyof NotificationPreferences, value: any) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const updateQuietHours = (key: 'enabled' | 'start' | 'end', value: any) => {
    setPreferences(prev => ({
      ...prev,
      quiet_hours: {
        ...prev.quiet_hours,
        [key]: value,
      },
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Permission Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Permission
          </CardTitle>
          <CardDescription>
            Enable browser notifications to receive updates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">
                Status: {permissionStatus === 'granted' ? 'Enabled' : 
                        permissionStatus === 'denied' ? 'Denied' : 'Not Set'}
              </div>
              <div className="text-sm text-muted-foreground">
                {permissionStatus === 'granted' && 'You will receive push notifications'}
                {permissionStatus === 'denied' && 'Notifications are blocked. Enable them in your browser settings.'}
                {permissionStatus === 'default' && 'Click to enable notifications'}
              </div>
            </div>
            {permissionStatus !== 'granted' && (
              <Button onClick={requestPermission} variant="outline">
                Enable Notifications
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notification Types */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Types</CardTitle>
          <CardDescription>
            Choose which notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageCircle className="h-5 w-5 text-blue-500" />
                <div>
                  <Label htmlFor="messages">Messages</Label>
                  <div className="text-sm text-muted-foreground">
                    New chat messages from contacts
                  </div>
                </div>
              </div>
              <Switch
                id="messages"
                checked={preferences.messages}
                onCheckedChange={(checked) => updatePreference('messages', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckSquare className="h-5 w-5 text-green-500" />
                <div>
                  <Label htmlFor="task_updates">Task Updates</Label>
                  <div className="text-sm text-muted-foreground">
                    Shared task completions and comments
                  </div>
                </div>
              </div>
              <Switch
                id="task_updates"
                checked={preferences.task_updates}
                onCheckedChange={(checked) => updatePreference('task_updates', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-purple-500" />
                <div>
                  <Label htmlFor="contact_requests">Contact Requests</Label>
                  <div className="text-sm text-muted-foreground">
                    New friend requests and connections
                  </div>
                </div>
              </div>
              <Switch
                id="contact_requests"
                checked={preferences.contact_requests}
                onCheckedChange={(checked) => updatePreference('contact_requests', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-orange-500" />
                <div>
                  <Label htmlFor="event_rsvps">Event RSVPs</Label>
                  <div className="text-sm text-muted-foreground">
                    Responses to your event invitations
                  </div>
                </div>
              </div>
              <Switch
                id="event_rsvps"
                checked={preferences.event_rsvps}
                onCheckedChange={(checked) => updatePreference('event_rsvps', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-red-500" />
                <div>
                  <Label htmlFor="calendar_reminders">Calendar Reminders</Label>
                  <div className="text-sm text-muted-foreground">
                    Upcoming tasks and events
                  </div>
                </div>
              </div>
              <Switch
                id="calendar_reminders"
                checked={preferences.calendar_reminders}
                onCheckedChange={(checked) => updatePreference('calendar_reminders', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle>Quiet Hours</CardTitle>
          <CardDescription>
            Set times when you don't want to receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="quiet_hours">Enable Quiet Hours</Label>
            <Switch
              id="quiet_hours"
              checked={preferences.quiet_hours.enabled}
              onCheckedChange={(checked) => updateQuietHours('enabled', checked)}
            />
          </div>

          {preferences.quiet_hours.enabled && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_time">Start Time</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={preferences.quiet_hours.start}
                  onChange={(e) => updateQuietHours('start', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="end_time">End Time</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={preferences.quiet_hours.end}
                  onChange={(e) => updateQuietHours('end', e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={savePreferences} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
