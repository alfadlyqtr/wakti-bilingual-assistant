import React, { useState, useEffect } from 'react';
import { NavigationHeader } from '@/components/navigation/NavigationHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/providers/AuthContext';
import { toast } from 'sonner';
import { 
  User, Bell, Palette, Globe, Shield, CreditCard, 
  Trash2, Download, Upload, Languages, Volume2,
  Moon, Sun, Monitor, Smartphone, Mail, MessageSquare,
  Calendar, Clock, Users, AlertTriangle, Eye, EyeOff
} from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';

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

const SettingsPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const { theme, setTheme, language, setLanguage } = useTheme();
  const [profile, setProfile] = useState<{
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
    website: string | null;
    email: string | null;
  }>({
    username: null,
    full_name: null,
    avatar_url: null,
    website: null,
    email: null,
  });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>({
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
    const getProfile = async () => {
      try {
        setLoading(true);
        if (!user) throw new Error('No user found');

        let { data, error, status } = await supabase
          .from('profiles')
          .select(`username, full_name, avatar_url, website, email`)
          .eq('id', user.id)
          .single();

        if (error && status !== 406) {
          throw error;
        }

        if (data) {
          setProfile({
            username: data.username,
            full_name: data.full_name,
            avatar_url: data.avatar_url,
            website: data.website,
            email: data.email || user.email,
          });
        }
      } catch (error: any) {
        toast.error(error.message);
      } finally {
        setLoading(false);
      }
    };

    const getNotificationPreferences = async () => {
      try {
        setLoading(true);
        if (!user) throw new Error('No user found');

        let { data, error } = await supabase
          .from('profiles')
          .select('notification_preferences')
          .eq('id', user.id)
          .single();

        if (error) {
          throw error;
        }

        if (data?.notification_preferences) {
          setNotificationPreferences(prev => ({
            ...prev,
            ...data.notification_preferences
          }));
        }
      } catch (error: any) {
        toast.error(error.message);
      } finally {
        setLoading(false);
      }
    };

    getProfile();
    getNotificationPreferences();
  }, [user]);

  async function updateProfile({
    username,
    full_name,
    website,
    avatar_url,
    email
  }: {
    username: string | null;
    full_name: string | null;
    website: string | null;
    avatar_url: string | null;
    email: string | null;
  }) {
    try {
      setUpdating(true);
      if (!user) throw new Error('Could not update profile: No user found');

      const updates = {
        id: user.id,
        username,
        full_name,
        website,
        avatar_url,
        email,
        updated_at: new Date(),
      };

      let { error } = await supabase.from('profiles').upsert(updates);

      if (error) {
        throw error;
      }
      setProfile({ username, full_name, avatar_url, website, email });
      toast.success('Profile updated successfully!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUpdating(false);
    }
  }

  async function updateNotificationPreferences(newPreferences: Partial<NotificationPreferences>) {
    try {
      setUpdating(true);
      if (!user) throw new Error('Could not update preferences: No user found');

      let { error } = await supabase
        .from('profiles')
        .update({ notification_preferences: { ...notificationPreferences, ...newPreferences } })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      setNotificationPreferences(prev => ({ ...prev, ...newPreferences }));
      toast.success('Notification preferences updated!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUpdating(false);
    }
  }

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
  };

  const handleLanguageChange = (newLanguage: 'en' | 'ar') => {
    setLanguage(newLanguage);
  };

  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader />
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-primary bg-clip-text text-transparent mb-4">
          Settings
        </h1>

        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList>
            <TabsTrigger value="profile">
              <User className="mr-2 h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="mr-2 h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <Palette className="mr-2 h-4 w-4" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="language">
              <Languages className="mr-2 h-4 w-4" />
              Language
            </TabsTrigger>
            <TabsTrigger value="security">
              <Shield className="mr-2 h-4 w-4" />
              Security
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    type="email"
                    id="email"
                    value={profile.email || ''}
                    disabled
                  />
                </div>
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    type="text"
                    id="username"
                    value={profile.username || ''}
                    onChange={(e) =>
                      setProfile({ ...profile, username: e.target.value })
                    }
                  />
                </div>
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    type="text"
                    id="full_name"
                    value={profile.full_name || ''}
                    onChange={(e) =>
                      setProfile({ ...profile, full_name: e.target.value })
                    }
                  />
                </div>
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    type="url"
                    id="website"
                    value={profile.website || ''}
                    onChange={(e) =>
                      setProfile({ ...profile, website: e.target.value })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={() => updateProfile({
                username: profile.username,
                full_name: profile.full_name,
                website: profile.website,
                avatar_url: profile.avatar_url,
                email: profile.email
              })}
              disabled={updating}
            >
              {updating ? 'Updating...' : 'Update Profile'}
            </Button>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="enableToasts">Enable Toasts</Label>
                  <Switch
                    id="enableToasts"
                    checked={notificationPreferences.enableToasts}
                    onCheckedChange={(checked) => updateNotificationPreferences({ enableToasts: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="enableBadges">Enable Badges</Label>
                  <Switch
                    id="enableBadges"
                    checked={notificationPreferences.enableBadges}
                    onCheckedChange={(checked) => updateNotificationPreferences({ enableBadges: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="enableVibration">Enable Vibration</Label>
                  <Switch
                    id="enableVibration"
                    checked={notificationPreferences.enableVibration}
                    onCheckedChange={(checked) => updateNotificationPreferences({ enableVibration: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="enableSounds">Enable Sounds</Label>
                  <Switch
                    id="enableSounds"
                    checked={notificationPreferences.enableSounds}
                    onCheckedChange={(checked) => updateNotificationPreferences({ enableSounds: checked })}
                  />
                </div>
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="soundVolume">Sound Volume</Label>
                  <Input
                    type="number"
                    id="soundVolume"
                    value={notificationPreferences.soundVolume}
                    onChange={(e) => updateNotificationPreferences({ soundVolume: parseInt(e.target.value) })}
                    min="0"
                    max="100"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notification Types</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="messages">Messages</Label>
                  <Switch
                    id="messages"
                    checked={notificationPreferences.messages}
                    onCheckedChange={(checked) => updateNotificationPreferences({ messages: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="contact_requests">Contact Requests</Label>
                  <Switch
                    id="contact_requests"
                    checked={notificationPreferences.contact_requests}
                    onCheckedChange={(checked) => updateNotificationPreferences({ contact_requests: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="task_updates">Task Updates</Label>
                  <Switch
                    id="task_updates"
                    checked={notificationPreferences.task_updates}
                    onCheckedChange={(checked) => updateNotificationPreferences({ task_updates: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="shared_task_updates">Shared Task Updates</Label>
                  <Switch
                    id="shared_task_updates"
                    checked={notificationPreferences.shared_task_updates}
                    onCheckedChange={(checked) => updateNotificationPreferences({ shared_task_updates: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="event_rsvps">Event RSVPs</Label>
                  <Switch
                    id="event_rsvps"
                    checked={notificationPreferences.event_rsvps}
                    onCheckedChange={(checked) => updateNotificationPreferences({ event_rsvps: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="calendar_reminders">Calendar Reminders</Label>
                  <Switch
                    id="calendar_reminders"
                    checked={notificationPreferences.calendar_reminders}
                    onCheckedChange={(checked) => updateNotificationPreferences({ calendar_reminders: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="admin_gifts">Admin Gifts</Label>
                  <Switch
                    id="admin_gifts"
                    checked={notificationPreferences.admin_gifts}
                    onCheckedChange={(checked) => updateNotificationPreferences({ admin_gifts: checked })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Appearance Settings</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="theme">Theme</Label>
                  <Select value={theme} onValueChange={handleThemeChange}>
                    <SelectTrigger id="theme">
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Language Tab */}
          <TabsContent value="language" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Language Settings</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="language">Language</Label>
                  <Select value={language} onValueChange={handleLanguageChange}>
                    <SelectTrigger id="language">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ar">العربية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Button variant="destructive" onClick={() => signOut()}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SettingsPage;
