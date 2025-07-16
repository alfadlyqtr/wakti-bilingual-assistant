import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, BellOff, Clock, Smartphone, CheckCircle, AlertCircle, MessageCircle, Users, CheckSquare, Calendar, Volume2 } from 'lucide-react';
import { wn1NotificationService, WN1NotificationPreferences } from '@/services/wn1NotificationService';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function NotificationSettings() {
  const { language } = useTheme();
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<WN1NotificationPreferences>(wn1NotificationService.getPreferences());
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkNotificationPermission();
    loadPreferences();
  }, []);

  const checkNotificationPermission = async () => {
    if (!('Notification' in window)) {
      setPermissionStatus('denied');
      return;
    }
    setPermissionStatus(Notification.permission);
  };

  const loadPreferences = async () => {
    const currentPrefs = wn1NotificationService.getPreferences();
    setPreferences(currentPrefs);
  };

  const updatePreference = async (key: keyof WN1NotificationPreferences, value: any) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    
    try {
      await wn1NotificationService.updatePreferences({ [key]: value });
      
      // Update user preferences in database
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

  const handleQuietHoursChange = async (key: 'enabled' | 'start' | 'end', value: boolean | string) => {
    const newQuietHours = { ...preferences.quietHours, [key]: value };
    await updatePreference('quietHours', newQuietHours);
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

  const testNotificationSystem = async () => {
    try {
      await wn1NotificationService.testNotification();
      toast.success(language === 'ar' ? 'تم إرسال إشعار تجريبي' : 'Test notification sent');
    } catch (error) {
      console.error('Test notification failed:', error);
      toast.error(language === 'ar' ? 'فشل الإشعار التجريبي' : 'Test notification failed');
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
      {/* Browser Permission Status */}
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

          {/* Shared Task Updates */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckSquare className="h-5 w-5 text-orange-500" />
              <div>
                <div className="font-medium">
                  {language === 'ar' ? 'تحديثات المهام المشتركة' : 'Shared Task Updates'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'تعليقات وإنجازات على المهام المشتركة' : 'Comments and completions on shared tasks'}
                </div>
              </div>
            </div>
            <Switch
              checked={preferences.shared_task_updates}
              onCheckedChange={(checked) => updatePreference('shared_task_updates', checked)}
            />
          </div>

          {/* Event RSVPs */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-pink-500" />
              <div>
                <div className="font-medium">
                  {language === 'ar' ? 'ردود أحداث موعد' : 'Event RSVP Updates'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'ردود على دعوات أحداث موعد' : 'Responses to your Maw3d event invitations'}
                </div>
              </div>
            </div>
            <Switch
              checked={preferences.event_rsvps}
              onCheckedChange={(checked) => updatePreference('event_rsvps', checked)}
            />
          </div>

          {/* Calendar Reminders */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <div className="font-medium">
                  {language === 'ar' ? 'تذكيرات التقويم' : 'Calendar Reminders'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'تذكيرات الأحداث والمواعيد القادمة' : 'Upcoming events and appointment reminders'}
                </div>
              </div>
            </div>
            <Switch
              checked={preferences.calendar_reminders}
              onCheckedChange={(checked) => updatePreference('calendar_reminders', checked)}
            />
          </div>

          {/* Admin Gifts */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-red-500" />
              <div>
                <div className="font-medium">
                  {language === 'ar' ? 'إشعارات النظام' : 'System Notifications'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'تحديثات مهمة وهدايا من فريق WAKTI' : 'Important updates and gifts from WAKTI team'}
                </div>
              </div>
            </div>
            <Switch
              checked={preferences.admin_gifts}
              onCheckedChange={(checked) => updatePreference('admin_gifts', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Sound & Badge Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            {language === 'ar' ? 'إعدادات الصوت والشارات' : 'Sound & Badge Settings'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Notification Sound */}
          <div className="space-y-2">
            <Label>{language === 'ar' ? 'صوت الإشعار' : 'Notification Sound'}</Label>
            <Select
              value={preferences.notification_sound}
              onValueChange={(value: 'chime' | 'beep' | 'ding') => updatePreference('notification_sound', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chime">{language === 'ar' ? 'جرس لطيف' : 'Chime'}</SelectItem>
                <SelectItem value="beep">{language === 'ar' ? 'صفير كلاسيكي' : 'Beep'}</SelectItem>
                <SelectItem value="ding">{language === 'ar' ? 'دينغ لطيف' : 'Ding'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sound Volume */}
          {preferences.enableSounds && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{language === 'ar' ? 'مستوى الصوت' : 'Sound Volume'}</Label>
                <span className="text-sm text-muted-foreground">{preferences.soundVolume}%</span>
              </div>
              <Slider
                value={[preferences.soundVolume]}
                onValueChange={(value) => updatePreference('soundVolume', value[0])}
                max={100}
                min={0}
                step={10}
                className="w-full"
              />
            </div>
          )}

          {/* Badge Notifications */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">
                {language === 'ar' ? 'إظهار الشارات' : 'Show Badges'}
              </div>
              <div className="text-sm text-muted-foreground">
                {language === 'ar' ? 'عرض شارات عدد الإشعارات على أيقونات التطبيق' : 'Display notification count badges on app icons'}
              </div>
            </div>
            <Switch
              checked={preferences.show_badges}
              onCheckedChange={(checked) => updatePreference('show_badges', checked)}
            />
          </div>

          {/* Enable Toasts */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">
                {language === 'ar' ? 'تمكين التوست' : 'Enable Toasts'}
              </div>
              <div className="text-sm text-muted-foreground">
                {language === 'ar' ? 'عرض إشعارات منبثقة على الشاشة' : 'Show popup notifications on screen'}
              </div>
            </div>
            <Switch
              checked={preferences.enableToasts}
              onCheckedChange={(checked) => updatePreference('enableToasts', checked)}
            />
          </div>

          {/* Enable Vibration */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              <div>
                <div className="font-medium">
                  {language === 'ar' ? 'تمكين الاهتزاز' : 'Enable Vibration'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'اهتزاز الجهاز عند الإشعارات' : 'Vibrate device on notifications'}
                </div>
              </div>
            </div>
            <Switch
              checked={preferences.enableVibration}
              onCheckedChange={(checked) => updatePreference('enableVibration', checked)}
            />
          </div>

          {/* Enable Sounds */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">
                {language === 'ar' ? 'تمكين الأصوات' : 'Enable Sounds'}
              </div>
              <div className="text-sm text-muted-foreground">
                {language === 'ar' ? 'تشغيل أصوات الإشعارات' : 'Play notification sounds'}
              </div>
            </div>
            <Switch
              checked={preferences.enableSounds}
              onCheckedChange={(checked) => updatePreference('enableSounds', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {language === 'ar' ? 'ساعات الهدوء' : 'Quiet Hours'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">
                {language === 'ar' ? 'تمكين ساعات الهدوء' : 'Enable Quiet Hours'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {language === 'ar' ? 'إيقاف الإشعارات في أوقات محددة' : 'Disable notifications during specific times'}
              </p>
            </div>
            <Switch
              checked={preferences.quietHours.enabled}
              onCheckedChange={(checked) => handleQuietHoursChange('enabled', checked)}
            />
          </div>

          {preferences.quietHours.enabled && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quietStart">
                  {language === 'ar' ? 'وقت البدء' : 'Start Time'}
                </Label>
                <Input
                  id="quietStart"
                  type="time"
                  value={preferences.quietHours.start}
                  onChange={(e) => handleQuietHoursChange('start', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quietEnd">
                  {language === 'ar' ? 'وقت الانتهاء' : 'End Time'}
                </Label>
                <Input
                  id="quietEnd"
                  type="time"
                  value={preferences.quietHours.end}
                  onChange={(e) => handleQuietHoursChange('end', e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>
            {language === 'ar' ? 'اختبار الإشعارات' : 'Test Notifications'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
              {language === 'ar' 
                ? 'اختبر نظام الإشعارات الموحد WN1'
                : 'Test the unified WN1 notification system'}
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge variant="secondary" className="text-xs">
                🔔 {language === 'ar' ? 'إشعارات المتصفح' : 'Browser Notifications'}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                🔊 {language === 'ar' ? 'نظام صوتي' : 'Audio System'}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                📴 {language === 'ar' ? 'طابور غير متصل' : 'Offline Queue'}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                ⚡ {language === 'ar' ? 'فوري' : 'Real-time'}
              </Badge>
            </div>
          </div>
          
          <Button 
            onClick={testNotificationSystem}
            className="w-full"
            variant="default"
          >
            🧪 {language === 'ar' ? 'اختبار النظام الموحد' : 'Test Unified System'}
          </Button>
          
          <p className="text-xs text-muted-foreground text-center">
            {language === 'ar' 
              ? 'سيتم اختبار التوست + الصوت + إشعارات المتصفح + الاهتزاز'
              : 'This will test toast + sound + browser notifications + vibration'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
