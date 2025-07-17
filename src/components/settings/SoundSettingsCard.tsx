
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTheme } from '@/providers/ThemeProvider';
import { waktiSounds, WaktiSoundType, SoundSettings } from '@/services/waktiSounds';
import { Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';

export function SoundSettingsCard() {
  const { language } = useTheme();
  const [settings, setSettings] = useState<SoundSettings>(waktiSounds.getSettings());
  const [testingSound, setTestingSound] = useState(false);

  useEffect(() => {
    setSettings(waktiSounds.getSettings());
  }, []);

  const handleSettingChange = (key: keyof SoundSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    waktiSounds.updateSettings({ [key]: value });
  };

  const handleTestSound = async () => {
    setTestingSound(true);
    try {
      await waktiSounds.testSound(settings.selectedSound);
      toast.success(language === 'ar' ? 'تم تشغيل الصوت بنجاح!' : 'Sound played successfully!');
    } catch (error) {
      console.error('Sound test failed:', error);
      toast.error(language === 'ar' ? 'فشل في تشغيل الصوت' : 'Failed to play sound');
    } finally {
      setTestingSound(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {settings.enabled ? (
            <Volume2 className="h-5 w-5" />
          ) : (
            <VolumeX className="h-5 w-5" />
          )}
          {language === 'ar' ? 'إعدادات الصوت' : 'Sound Settings'}
        </CardTitle>
        <CardDescription>
          {language === 'ar' 
            ? 'تخصيص أصوات الإشعارات والتنبيهات'
            : 'Customize notification sounds and alerts'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Sounds */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="sound-enabled">
              {language === 'ar' ? 'تفعيل الأصوات' : 'Enable Sounds'}
            </Label>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' 
                ? 'تشغيل أو إيقاف أصوات الإشعارات'
                : 'Turn notification sounds on or off'}
            </p>
          </div>
          <Switch
            id="sound-enabled"
            checked={settings.enabled}
            onCheckedChange={(checked) => handleSettingChange('enabled', checked)}
          />
        </div>

        {settings.enabled && (
          <>
            {/* Volume Control */}
            <div className="space-y-2">
              <Label>
                {language === 'ar' ? 'مستوى الصوت' : 'Volume'} ({settings.volume}%)
              </Label>
              <Slider
                value={[settings.volume]}
                onValueChange={([value]) => handleSettingChange('volume', value)}
                max={100}
                min={0}
                step={5}
                className="w-full"
              />
            </div>

            {/* Sound Selection */}
            <div className="space-y-2">
              <Label>
                {language === 'ar' ? 'نوع الصوت' : 'Notification Sound'}
              </Label>
              <Select
                value={settings.selectedSound}
                onValueChange={(value: WaktiSoundType) => handleSettingChange('selectedSound', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {waktiSounds.getAllSounds().map((sound) => (
                    <SelectItem key={sound} value={sound}>
                      {waktiSounds.getSoundDisplayName(sound)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Test Sound Button */}
            <Button
              onClick={handleTestSound}
              disabled={testingSound}
              variant="outline"
              className="w-full"
            >
              {testingSound ? (
                language === 'ar' ? 'جاري الاختبار...' : 'Testing...'
              ) : (
                language === 'ar' ? 'اختبار الصوت' : 'Test Sound'
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
