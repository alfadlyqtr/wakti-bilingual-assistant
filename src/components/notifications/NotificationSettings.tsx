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
    if (typeof window === 'undefined') return;
    // Check if we're truly inside the Natively native app shell
    // The SDK is loaded globally, but isNativeApp is only true inside the actual iOS/Android wrapper
    const natively = (window as any).natively;
    if (natively && (natively.isNativeApp === true || natively.isIOSApp === true || natively.isAndroidApp === true)) {
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

  const handleOpenPhoneSettings = () => {
    try {
      // Use Natively SDK to open the app's settings page in iOS/Android
      const natively = (window as any).natively;
      if (natively && typeof natively.openAppSettings === 'function') {
        natively.openAppSettings();
      } else {
        // Fallback: request permission which may show system prompt
        requestNativePermission(true);
        toast.info(language === 'ar' ? 'تم إرسال طلب الإذن' : 'Permission request sent');
      }
    } catch (error) {
      console.error('Failed to open phone settings:', error);
      toast.error(language === 'ar' ? 'فشل في فتح الإعدادات' : 'Failed to open settings');
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
      {/* Native App View: ONLY Show Settings & Types */}
      {isNative ? (
        <div className="space-y-6">
          <Card className="border-accent-blue/20 bg-accent-blue/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Smartphone className="h-5 w-5 text-accent-blue" />
                {language === 'ar' ? 'إشعارات الهاتف' : 'Mobile Push Notifications'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-6 py-2">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {language === 'ar' 
                      ? 'لتفعيل التنبيهات على هاتفك، تأكد من السماح بالإشعارات في إعدادات النظام.'
                      : 'To receive real-time alerts on your device, please ensure push notifications are enabled in your phone\'s system settings.'}
                  </p>
                </div>
                
                <Button 
                  onClick={handleOpenPhoneSettings}
                  className="w-full h-12 bg-accent-blue hover:bg-accent-blue/90 text-white shadow-lg shadow-accent-blue/20 rounded-xl font-medium transition-all active:scale-[0.98]"
                >
                  <Smartphone className="mr-2 h-4 w-4" />
                  {language === 'ar' ? 'إعدادات الهاتف' : 'Open Phone Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-accent-orange" />
                {language === 'ar' ? 'تخصيص التنبيهات' : 'Notification Preferences'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Messages */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-blue-500/10 shrink-0">
                    <MessageCircle className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <div className="font-semibold text-base">{language === 'ar' ? 'الرسائل' : 'Messages'}</div>
                    <div className="text-xs text-muted-foreground leading-tight mt-0.5">{language === 'ar' ? 'رسائل مباشرة من جهات الاتصال' : 'Direct messages from contacts'}</div>
                  </div>
                </div>
                <Switch checked={preferences.messages} onCheckedChange={(checked) => updatePreference('messages', checked)} />
              </div>

              {/* Contact Requests */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-green-500/10 shrink-0">
                    <Users className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <div className="font-semibold text-base">{language === 'ar' ? 'طلبات الاتصال' : 'Contact Requests'}</div>
                    <div className="text-xs text-muted-foreground leading-tight mt-0.5">{language === 'ar' ? 'طلبات جديدة من مستخدمين آخرين' : 'New requests from other users'}</div>
                  </div>
                </div>
                <Switch checked={preferences.contact_requests} onCheckedChange={(checked) => updatePreference('contact_requests', checked)} />
              </div>

              {/* Task Updates */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-purple-500/10 shrink-0">
                    <CheckSquare className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <div className="font-semibold text-base">{language === 'ar' ? 'المهام' : 'Tasks'}</div>
                    <div className="text-xs text-muted-foreground leading-tight mt-0.5">{language === 'ar' ? 'تحديثات على مهامك وتذكيراتك' : 'Updates on your tasks and reminders'}</div>
                  </div>
                </div>
                <Switch checked={preferences.task_updates} onCheckedChange={(checked) => updatePreference('task_updates', checked)} />
              </div>

              {/* Event RSVPs */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-orange-500/10 shrink-0">
                    <Calendar className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <div className="font-semibold text-base">{language === 'ar' ? 'المواعيد' : 'Events'}</div>
                    <div className="text-xs text-muted-foreground leading-tight mt-0.5">{language === 'ar' ? 'ردود على دعوات الأحداث' : 'Responses to event invitations'}</div>
                  </div>
                </div>
                <Switch checked={preferences.event_rsvps} onCheckedChange={(checked) => updatePreference('event_rsvps', checked)} />
              </div>

              <Separator className="opacity-50" />

              {/* Sounds & Toasts */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-3 p-4 rounded-2xl border border-accent-blue/10 bg-accent-blue/5">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-indigo-500" />
                    <span className="text-xs font-bold uppercase tracking-wider opacity-70">{language === 'ar' ? 'الأصوات' : 'Sounds'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground leading-tight max-w-[60%]">{language === 'ar' ? 'تنبيهات صوتية' : 'Audio alerts'}</span>
                    <Switch checked={preferences.enableSounds} onCheckedChange={(checked) => updatePreference('enableSounds', checked)} />
                  </div>
                </div>
                <div className="flex flex-col gap-3 p-4 rounded-2xl border border-cyan-500/10 bg-cyan-500/5">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-cyan-500" />
                    <span className="text-xs font-bold uppercase tracking-wider opacity-70">{language === 'ar' ? 'تنبيهات' : 'Toasts'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground leading-tight max-w-[60%]">{language === 'ar' ? 'تنبيهات منبثقة' : 'Popup toasts'}</span>
                    <Switch checked={preferences.enableToasts} onCheckedChange={(checked) => updatePreference('enableToasts', checked)} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Browser View: Standard Notification UI */
        <div className="space-y-6">
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
                    <p className="font-medium">{language === 'ar' ? 'حالة الإذن' : 'Permission Status'}</p>
                    <p className={`text-sm ${permissionInfo.color}`}>{permissionInfo.text}</p>
                  </div>
                </div>
                {permissionStatus !== 'granted' && (
                  <Button 
                    onClick={requestPermission}
                    disabled={isLoading || permissionStatus === 'denied'}
                    variant="outline"
                  >
                    {isLoading ? (language === 'ar' ? 'جاري الطلب...' : 'Requesting...') : (language === 'ar' ? 'طلب الإذن' : 'Request Permission')}
                  </Button>
                )}
              </div>
              {permissionStatus === 'denied' && (
                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-md border border-orange-200 dark:border-orange-800">
                  <p className="text-sm text-orange-800 dark:text-orange-200">
                    {language === 'ar' ? 'تم حظر الإشعارات من المتصفح.' : 'Notifications are blocked in your browser.'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

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
                    <div className="font-medium">{language === 'ar' ? 'الرسائل' : 'Messages'}</div>
                    <div className="text-sm text-muted-foreground">{language === 'ar' ? 'رسائل جديدة من جهات الاتصال' : 'New direct messages from contacts'}</div>
                  </div>
                </div>
                <Switch checked={preferences.messages} onCheckedChange={(checked) => updatePreference('messages', checked)} />
              </div>

              {/* Contact Requests */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-green-500" />
                  <div>
                    <div className="font-medium">{language === 'ar' ? 'طلبات الاتصال' : 'Contact Requests'}</div>
                    <div className="text-sm text-muted-foreground">{language === 'ar' ? 'طلبات جديدة من مستخدمين آخرين' : 'New requests from other users'}</div>
                  </div>
                </div>
                <Switch checked={preferences.contact_requests} onCheckedChange={(checked) => updatePreference('contact_requests', checked)} />
              </div>

              {/* Task Updates */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckSquare className="h-5 w-5 text-purple-500" />
                  <div>
                    <div className="font-medium">{language === 'ar' ? 'المهام' : 'Tasks'}</div>
                    <div className="text-sm text-muted-foreground">{language === 'ar' ? 'تحديثات على مهامك وتذكيراتك' : 'Updates on your tasks and reminders'}</div>
                  </div>
                </div>
                <Switch checked={preferences.task_updates} onCheckedChange={(checked) => updatePreference('task_updates', checked)} />
              </div>

              {/* Event RSVPs */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-orange-500" />
                  <div>
                    <div className="font-medium">{language === 'ar' ? 'المواعيد' : 'Events'}</div>
                    <div className="text-sm text-muted-foreground">{language === 'ar' ? 'ردود على دعوات الأحداث' : 'Responses to event invitations'}</div>
                  </div>
                </div>
                <Switch checked={preferences.event_rsvps} onCheckedChange={(checked) => updatePreference('event_rsvps', checked)} />
              </div>

              <Separator />

              {/* Sound Settings */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Volume2 className="h-5 w-5 text-indigo-500" />
                  <div>
                    <div className="font-medium">{language === 'ar' ? 'أصوات الإشعارات' : 'Notification Sounds'}</div>
                    <div className="text-sm text-muted-foreground">{language === 'ar' ? 'تشغيل الأصوات مع الإشعارات' : 'Play sounds with notifications'}</div>
                  </div>
                </div>
                <Switch checked={preferences.enableSounds} onCheckedChange={(checked) => updatePreference('enableSounds', checked)} />
              </div>

              {/* Toast Settings */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-cyan-500" />
                  <div>
                    <div className="font-medium">{language === 'ar' ? 'إشعارات على الشاشة' : 'Toast Notifications'}</div>
                    <div className="text-sm text-muted-foreground">{language === 'ar' ? 'عرض الإشعارات على الشاشة' : 'Show on-screen notification messages'}</div>
                  </div>
                </div>
                <Switch checked={preferences.enableToasts} onCheckedChange={(checked) => updatePreference('enableToasts', checked)} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
