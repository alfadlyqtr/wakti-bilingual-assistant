
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Volume2, Play, Check } from 'lucide-react';
import { waktiSounds, WaktiSoundType } from '@/services/waktiSounds';
import { waktiNotifications } from '@/services/waktiNotifications';

export default function NotificationSettings() {
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

  const testNotificationSystem = async () => {
    console.log('🧪 Testing full notification system');
    await waktiNotifications.testNotification('message');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Sound Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sound Enable/Disable */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Enable Sounds</h3>
              <p className="text-sm text-muted-foreground">Play notification sounds</p>
            </div>
            <Switch
              checked={soundSettings.enabled}
              onCheckedChange={handleSoundToggle}
            />
          </div>

          {/* Volume Control */}
          {soundSettings.enabled && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Volume</h3>
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
          )}

          {/* Sound Selection */}
          {soundSettings.enabled && (
            <div className="space-y-3">
              <h3 className="font-medium">Notification Sound</h3>
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
                        <Badge variant="secondary" className="text-xs">Current</Badge>
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
                      {testingSound === sound ? 'Playing...' : 'Test'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Test Full System */}
          <div className="pt-4 border-t">
            <Button 
              onClick={testNotificationSystem}
              className="w-full"
              variant="secondary"
            >
              🧪 Test Complete Notification System
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              This will test sound + toast + badge systems together
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
