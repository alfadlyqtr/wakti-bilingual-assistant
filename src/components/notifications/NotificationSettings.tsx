
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Bell, BellOff, Clock, Smartphone, CheckCircle, AlertCircle } from 'lucide-react';
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
    setPermissionStatus(wn1NotificationService.getPermissionStatus());
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    const currentPrefs = wn1NotificationService.getPreferences();
    setPreferences(currentPrefs);
  };

  const handlePreferenceChange = async (key: keyof WN1NotificationPreferences, value: any) => {
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
    await handlePreferenceChange('quietHours', newQuietHours);
  };

  const requestNotificationPermission = async () => {
    setIsLoading(true);
    try {
      const permission = await wn1NotificationService.requestPermission();
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

  const testWN1System = async () => {
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
                onClick={requestNotificationPermission}
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

      {/* Notification Types Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {language === 'ar' ? 'أنواع الإشعارات' : 'Notification Types'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-md border">
            <div className="space-y-1">
              <Label className="text-sm font-medium">
                {language === 'ar' ? 'تمكين التوست' : 'Enable Toasts'}
              </Label>
              <p className="text-xs text-muted-foreground">
                {language === 'ar' ? 'عرض إشعارات منبثقة على الشاشة' : 'Show popup notifications on screen'}
              </p>
            </div>
            <Switch
              checked={preferences.enableToasts}
              onCheckedChange={(checked) => handlePreferenceChange('enableToasts', checked)}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-md border">
            <div className="space-y-1">
              <Label className="text-sm font-medium">
                {language === 'ar' ? 'تمكين الشارات' : 'Enable Badges'}
              </Label>
              <p className="text-xs text-muted-foreground">
                {language === 'ar' ? 'عرض عدادات الإشعارات غير المقروءة' : 'Show unread notification counters'}
              </p>
            </div>
            <Switch
              checked={preferences.enableBadges}
              onCheckedChange={(checked) => handlePreferenceChange('enableBadges', checked)}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-md border">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                <Label className="text-sm font-medium">
                  {language === 'ar' ? 'تمكين الاهتزاز' : 'Enable Vibration'}
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                {language === 'ar' ? 'اهتزاز الجهاز عند الإشعارات' : 'Vibrate device on notifications'}
              </p>
            </div>
            <Switch
              checked={preferences.enableVibration}
              onCheckedChange={(checked) => handlePreferenceChange('enableVibration', checked)}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-md border">
            <div className="space-y-1">
              <Label className="text-sm font-medium">
                {language === 'ar' ? 'تمكين الأصوات' : 'Enable Sounds'}
              </Label>
              <p className="text-xs text-muted-foreground">
                {language === 'ar' ? 'تشغيل أصوات الإشعارات' : 'Play notification sounds'}
              </p>
            </div>
            <Switch
              checked={preferences.enableSounds}
              onCheckedChange={(checked) => handlePreferenceChange('enableSounds', checked)}
            />
          </div>

          {preferences.enableSounds && (
            <div className="space-y-3 pl-4 border-l-2 border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">
                  {language === 'ar' ? 'مستوى الصوت' : 'Sound Volume'}
                </h3>
                <span className="text-sm text-muted-foreground">{preferences.soundVolume}%</span>
              </div>
              <Slider
                value={[preferences.soundVolume]}
                onValueChange={(value) => handlePreferenceChange('soundVolume', value[0])}
                max={100}
                min={0}
                step={10}
                className="w-full"
              />
            </div>
          )}
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

      {/* Test WN1 System */}
      <Card>
        <CardHeader>
          <CardTitle>
            {language === 'ar' ? 'اختبار نظام WN1' : 'Test WN1 System'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
              {language === 'ar' 
                ? 'WN1 هو نظام الإشعارات الجديد المدمج داخلياً والمحسّن للـ PWA'
                : 'WN1 is the new internal notification system optimized for PWA'}
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
            onClick={testWN1System}
            className="w-full"
            variant="default"
          >
            🧪 {language === 'ar' ? 'اختبار نظام WN1' : 'Test WN1 System'}
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
