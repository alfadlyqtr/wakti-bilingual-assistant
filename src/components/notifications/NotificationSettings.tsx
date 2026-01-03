// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Bell, BellOff, CheckCircle, AlertCircle, MessageCircle, Users, CheckSquare, Calendar, Volume2, Info, Smartphone } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { requestNotificationPermission as requestNativePermission } from '@/integrations/natively/notificationsBridge';

interface NotificationPreferences {
  messages: boolean;
  contact_requests: boolean;
  task_updates: boolean;
  shared_task_updates: boolean;
  event_rsvps: boolean;
  enableSounds: boolean;
  enableToasts: boolean;
}

export default function NotificationSettings() {
  const { language } = useTheme();
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    messages: true,
    contact_requests: true,
    task_updates: true,
    shared_task_updates: true,
    event_rsvps: true,
    enableSounds: true,
    enableToasts: true,
  });
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(false);
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    checkNotificationPermission();
    loadPreferences();
    checkIfNative();
  }, []);

  const checkIfNative = () => {
    if (typeof window !== 'undefined' && (window as any).NativelyNotifications) {
      setIsNative(true);
    }
  };

  const checkNotificationPermission = async () => {
    if (!('Notification' in window)) {
      setPermissionStatus('denied');
      return;
    }
    setPermissionStatus(Notification.permission);
  };

  const loadPreferences = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('notification_preferences')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data?.notification_preferences) {
        setPreferences({ ...preferences, ...data.notification_preferences });
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    
    try {
      if (user) {
        await supabase
          .from('profiles')
          .update({ 
            notification_preferences: newPreferences,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
      }
      
      toast.success(language === 'ar' ? 'تم تحديث الإعدادات' : 'Settings updated');
    } catch (error) {
      console.error('Failed to update preferences:', error);
      toast.error(language === 'ar' ? 'فشل في تحديث الإعدادات' : 'Failed to update settings');
    }
  };

  const requestPermission = async () => {
    setIsLoading(true);
    try {
      if (!('Notification' in window)) {
        setPermissionStatus('denied');
        toast.error(language === 'ar' ? 'المتصفح لا يدعم الإشعارات' : 'Browser does not support notifications');
        return;
      }
      
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      
      if (permission === 'granted') {
        toast.success(language === 'ar' ? 'تم منح إذن الإشعارات' : 'Notification permission granted');
      } else {
        toast.error(language === 'ar' ? 'تم رفض إذن الإشعارات' : 'Notification permission denied');
      }
    } catch (error) {
      console.error('Permission request failed:', error);
      toast.error(language === 'ar' ? 'فشل في طلب الإذن' : 'Permission request failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNativePermissionRequest = () => {
    try {
      requestNativePermission(true);
      toast.info(language === 'ar' ? 'تم إرسال طلب الإذن' : 'Permission request sent');
    } catch (error) {
      console.error('Native permission request failed:', error);
    }
  };

  const getPermissionStatusInfo = () => {
    switch (permissionStatus) {
      case 'granted':
        return {
          icon: <CheckCircle className="h-4 w-4 text-green-500" />,
          text: language === 'ar' ? 'مُفعّل' : 'Enabled',
          color: 'text-green-600'
        };
      case 'denied':
        return {
          icon: <AlertCircle className="h-4 w-4 text-red-500" />,
          text: language === 'ar' ? 'مرفوض' : 'Blocked',
          color: 'text-red-600'
        };
      default:
        return {
          icon: <AlertCircle className="h-4 w-4 text-orange-500" />,
          text: language === 'ar' ? 'غير مُفعّل' : 'Not Set',
          color: 'text-orange-600'
        };
    }
  };

  const permissionInfo = getPermissionStatusInfo();

  return (
    <div className="space-y-6">
      {/* Browser Permission Status - Hidden for Native App */}
      {!isNative && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {language === 'ar' ? 'إذن إشعارات المتصفح' : 'Browser Notification Permission'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-md border">
              <div className="flex items-center gap-3">
                {permissionInfo.icon}
                <div>
                  <p className="font-medium">
                    {language === 'ar' ? 'حالة الإذن' : 'Permission Status'}
                  </p>
                  <p className={`text-sm ${permissionInfo.color}`}>
                    {permissionInfo.text}
                  </p>
                </div>
              </div>
              {permissionStatus !== 'granted' && (
                <Button 
                  onClick={requestPermission}
                  disabled={isLoading || permissionStatus === 'denied'}
                  variant="outline"
                >
                  {isLoading ? 
                    (language === 'ar' ? 'جاري الطلب...' : 'Requesting...') :
                    (language === 'ar' ? 'طلب الإذن' : 'Request Permission')
                  }
                </Button>
              )}
            </div>
            
            {permissionStatus === 'denied' && (
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-md border border-orange-200 dark:border-orange-800">
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  {language === 'ar' 
                    ? 'تم حظر الإشعارات. يرجى تمكينها من إعدادات المتصفح.'
                    : 'Notifications are blocked. Please enable them in your browser settings.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Native App Permission Info */}
      {isNative && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              {language === 'ar' ? 'إشعارات التطبيق' : 'App Notifications'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-md border">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">
                    {language === 'ar' ? 'حالة إشعارات الهاتف' : 'Mobile Notification Status'}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {language === 'ar' ? 'مدعوم عبر النظام' : 'Managed by System'}
                  </p>
                </div>
              </div>
              <Button 
                onClick={handleNativePermissionRequest}
                variant="outline"
              >
                {language === 'ar' ? 'تحديث الإعدادات' : 'Update Settings'}
              </Button>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {language === 'ar' 
                  ? 'يتم إدارة إشعارات التطبيق مباشرة عبر إعدادات هاتفك للحصول على أفضل أداء.'
                  : 'App notifications are managed directly via your phone settings for the best reliability.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notification Types */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {language === 'ar' ? 'أنواع الإشعارات' : 'Notification Types'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Messages */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-5 w-5 text-blue-500" />
              <div>
                <div className="font-medium">
                  {language === 'ar' ? 'الرسائل' : 'Messages'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'رسائل جديدة من جهات الاتصال' : 'New direct messages from contacts'}
                </div>
              </div>
            </div>
            <Switch
              checked={preferences.messages}
              onCheckedChange={(checked) => updatePreference('messages', checked)}
            />
          </div>

          {/* Contact Requests */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-green-500" />
              <div>
                <div className="font-medium">
                  {language === 'ar' ? 'طلبات الاتصال' : 'Contact Requests'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'طلبات اتصال جديدة من مستخدمين آخرين' : 'New contact requests from other users'}
                </div>
              </div>
            </div>
            <Switch
              checked={preferences.contact_requests}
              onCheckedChange={(checked) => updatePreference('contact_requests', checked)}
            />
          </div>

          {/* Task Updates */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckSquare className="h-5 w-5 text-purple-500" />
              <div>
                <div className="font-medium">
                  {language === 'ar' ? 'تحديثات المهام' : 'Task Updates'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'تحديثات على مهامك وتذكيراتك' : 'Updates on your tasks and reminders'}
                </div>
              </div>
            </div>
            <Switch
              checked={preferences.task_updates}
              onCheckedChange={(checked) => updatePreference('task_updates', checked)}
            />
          </div>

          {/* Event RSVPs */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-orange-500" />
              <div>
                <div className="font-medium">
                  {language === 'ar' ? 'ردود الأحداث' : 'Event RSVPs'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'ردود على دعوات الأحداث' : 'Responses to event invitations'}
                </div>
              </div>
            </div>
            <Switch
              checked={preferences.event_rsvps}
              onCheckedChange={(checked) => updatePreference('event_rsvps', checked)}
            />
          </div>

          <Separator />

          {/* Sound Settings */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className="h-5 w-5 text-indigo-500" />
              <div>
                <div className="font-medium">
                  {language === 'ar' ? 'أصوات الإشعارات' : 'Notification Sounds'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'تشغيل الأصوات مع الإشعارات' : 'Play sounds with notifications'}
                </div>
              </div>
            </div>
            <Switch
              checked={preferences.enableSounds}
              onCheckedChange={(checked) => updatePreference('enableSounds', checked)}
            />
          </div>

          {/* Toast Settings */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-cyan-500" />
              <div>
                <div className="font-medium">
                  {language === 'ar' ? 'إشعارات على الشاشة' : 'Toast Notifications'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'عرض الإشعارات على الشاشة' : 'Show on-screen notification messages'}
                </div>
              </div>
            </div>
            <Switch
              checked={preferences.enableToasts}
              onCheckedChange={(checked) => updatePreference('enableToasts', checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
