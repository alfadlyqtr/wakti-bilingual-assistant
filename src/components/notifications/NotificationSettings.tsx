
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Volume2, Play, Check, Bell, BellOff, Clock, Smartphone } from 'lucide-react';
import { waktiSounds, WaktiSoundType } from '@/services/waktiSounds';
import { waktiNotifications } from '@/services/waktiNotifications';
import { useTheme } from '@/providers/ThemeProvider';

export default function NotificationSettings() {
  const { language } = useTheme();
  const [soundSettings, setSoundSettings] = useState(waktiSounds.getSettings());
  const [notificationConfig, setNotificationConfig] = useState(waktiNotifications.getConfig());
  const [testingSound, setTestingSound] = useState<string | null>(null);

  useEffect(() => {
    setSoundSettings(waktiSounds.getSettings());
    setNotificationConfig(waktiNotifications.getConfig());
  }, []);

  const handleSoundChange = async (soundType: WaktiSoundType) => {
    console.log('🎵 Changing sound to:', soundType);
    setTestingSound(soundType);
    
    const newSettings = { ...soundSettings, selectedSound: soundType };
    setSoundSettings(newSettings);
    waktiSounds.updateSettings(newSettings);
    
    try {
      await waktiSounds.testSound(soundType);
      console.log('✅ Sound test successful');
    } catch (error) {
      console.error('❌ Sound test failed:', error);
    } finally {
      setTestingSound(null);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newSettings = { ...soundSettings, volume: value[0] };
    setSoundSettings(newSettings);
    waktiSounds.updateSettings(newSettings);
  };

  const handleSoundToggle = (enabled: boolean) => {
    const newSettings = { ...soundSettings, enabled };
    setSoundSettings(newSettings);
    waktiSounds.updateSettings(newSettings);
  };

  const handleNotificationConfigChange = (key: keyof typeof notificationConfig, value: any) => {
    const newConfig = { ...notificationConfig, [key]: value };
    setNotificationConfig(newConfig);
    waktiNotifications.updateConfig(newConfig);
  };

  const handleQuietHoursChange = (key: 'enabled' | 'start' | 'end', value: boolean | string) => {
    const newQuietHours = { ...notificationConfig.quietHours, [key]: value };
    const newConfig = { ...notificationConfig, quietHours: newQuietHours };
    setNotificationConfig(newConfig);
    waktiNotifications.updateConfig(newConfig);
  };

  const testNotificationSystem = async () => {
    console.log('🧪 Testing full notification system');
    await waktiNotifications.testNotification('message');
  };

  const testSpecificNotification = async (type: string) => {
    await waktiNotifications.testNotification(type);
  };

  return (
    <div className="space-y-6">
      {/* Sound Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            {language === 'ar' ? 'إعدادات الصوت' : 'Sound Settings'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">
                {language === 'ar' ? 'تمكين الأصوات' : 'Enable Sounds'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {language === 'ar' ? 'تشغيل أصوات الإشعارات' : 'Play notification sounds'}
              </p>
            </div>
            <Switch
              checked={soundSettings.enabled}
              onCheckedChange={handleSoundToggle}
            />
          </div>

          {soundSettings.enabled && (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">
                    {language === 'ar' ? 'مستوى الصوت' : 'Volume'}
                  </h3>
                  <span className="text-sm text-muted-foreground">{soundSettings.volume}%</span>
                </div>
                <Slider
                  value={[soundSettings.volume]}
                  onValueChange={handleVolumeChange}
                  max={100}
                  min={0}
                  step={10}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <h3 className="font-medium">
                  {language === 'ar' ? 'صوت الإشعار' : 'Notification Sound'}
                </h3>
                <div className="grid gap-2">
                  {waktiSounds.getAllSounds().map((sound) => (
                    <div
                      key={sound}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {soundSettings.selectedSound === sound ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <div className="h-4 w-4" />
                          )}
                          <span className="font-medium">{waktiSounds.getSoundDisplayName(sound)}</span>
                        </div>
                        {soundSettings.selectedSound === sound && (
                          <Badge variant="secondary" className="text-xs">
                            {language === 'ar' ? 'الحالي' : 'Current'}
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSoundChange(sound)}
                        disabled={testingSound === sound}
                        className="flex items-center gap-2"
                      >
                        <Play className="h-3 w-3" />
                        {testingSound === sound ? 
                          (language === 'ar' ? 'يتم التشغيل...' : 'Playing...') : 
                          (language === 'ar' ? 'تجربة' : 'Test')
                        }
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
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
              checked={notificationConfig.enableToasts}
              onCheckedChange={(checked) => handleNotificationConfigChange('enableToasts', checked)}
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
              checked={notificationConfig.enableBadges}
              onCheckedChange={(checked) => handleNotificationConfigChange('enableBadges', checked)}
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
              checked={notificationConfig.enableVibration}
              onCheckedChange={(checked) => handleNotificationConfigChange('enableVibration', checked)}
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
              checked={notificationConfig.quietHours.enabled}
              onCheckedChange={(checked) => handleQuietHoursChange('enabled', checked)}
            />
          </div>

          {notificationConfig.quietHours.enabled && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quietStart">
                  {language === 'ar' ? 'وقت البدء' : 'Start Time'}
                </Label>
                <Input
                  id="quietStart"
                  type="time"
                  value={notificationConfig.quietHours.start}
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
                  value={notificationConfig.quietHours.end}
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
          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              onClick={() => testSpecificNotification('message')}
              className="w-full"
            >
              {language === 'ar' ? 'رسالة' : 'Message'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => testSpecificNotification('task')}
              className="w-full"
            >
              {language === 'ar' ? 'مهمة' : 'Task'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => testSpecificNotification('event')}
              className="w-full"
            >
              {language === 'ar' ? 'حدث' : 'Event'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => testSpecificNotification('contact')}
              className="w-full"
            >
              {language === 'ar' ? 'جهة اتصال' : 'Contact'}
            </Button>
          </div>

          <Separator />

          <Button 
            onClick={testNotificationSystem}
            className="w-full"
            variant="secondary"
          >
            🧪 {language === 'ar' ? 'اختبار النظام الكامل' : 'Test Complete System'}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            {language === 'ar' 
              ? 'سيتم اختبار الصوت + التوست + الشارات معاً'
              : 'This will test sound + toast + badge systems together'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
