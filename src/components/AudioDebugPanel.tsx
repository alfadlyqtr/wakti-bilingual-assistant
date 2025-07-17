
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { waktiSounds, WaktiSoundType } from '@/services/waktiSounds';
import { Volume2, VolumeX, Play, Settings, RefreshCw } from 'lucide-react';

export function AudioDebugPanel() {
  const [audioStatus, setAudioStatus] = useState(waktiSounds.getAudioStatus());
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | 'pending'>>({});
  const [isUnlocking, setIsUnlocking] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setAudioStatus(waktiSounds.getAudioStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleUnlockAudio = async () => {
    setIsUnlocking(true);
    try {
      const success = await waktiSounds.manualUnlock();
      console.log('Manual unlock result:', success);
    } catch (error) {
      console.error('Manual unlock error:', error);
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleTestSound = async (soundType: WaktiSoundType) => {
    setTestResults(prev => ({ ...prev, [soundType]: 'pending' }));
    
    try {
      await waktiSounds.testSound(soundType);
      setTestResults(prev => ({ ...prev, [soundType]: 'success' }));
    } catch (error) {
      console.error(`Test sound ${soundType} failed:`, error);
      setTestResults(prev => ({ ...prev, [soundType]: 'error' }));
    }
  };

  const getStatusBadge = (status: boolean, trueText: string, falseText: string) => (
    <Badge variant={status ? "default" : "destructive"}>
      {status ? trueText : falseText}
    </Badge>
  );

  const getTestIcon = (status: 'success' | 'error' | 'pending' | undefined) => {
    switch (status) {
      case 'success':
        return <Volume2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <VolumeX className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />;
      default:
        return <Play className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Audio System Debug Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Audio Status */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">Sound Enabled:</span>
              {getStatusBadge(audioStatus.enabled, "Enabled", "Disabled")}
            </div>
            <div className="flex justify-between">
              <span className="text-sm">User Interaction:</span>
              {getStatusBadge(audioStatus.userInteracted, "Detected", "Required")}
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Audio Unlocked:</span>
              {getStatusBadge(audioStatus.audioUnlocked, "Unlocked", "Locked")}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">Audio Context:</span>
              <Badge variant={audioStatus.audioContextState === 'running' ? "default" : "secondary"}>
                {audioStatus.audioContextState || 'None'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Device:</span>
              <Badge variant="outline">
                {audioStatus.isMobile ? 'Mobile' : 'Desktop'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Manual Unlock Button */}
        {!audioStatus.userInteracted && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-2">
              Audio requires user interaction to work. Click the button below to enable sound notifications.
            </p>
            <Button 
              onClick={handleUnlockAudio} 
              disabled={isUnlocking}
              size="sm"
              className="w-full"
            >
              {isUnlocking ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Unlocking Audio...
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4 mr-2" />
                  Enable Audio Notifications
                </>
              )}
            </Button>
          </div>
        )}

        {/* Sound Tests */}
        <div className="space-y-2">
          <h4 className="font-medium">Test Sounds</h4>
          <div className="grid gap-2">
            {waktiSounds.getAllSounds().map((soundType) => (
              <div key={soundType} className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2">
                  {getTestIcon(testResults[soundType])}
                  <span className="capitalize">{waktiSounds.getSoundDisplayName(soundType)}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTestSound(soundType)}
                  disabled={testResults[soundType] === 'pending' || !audioStatus.userInteracted}
                >
                  Test
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Debug Info */}
        <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
          <strong>Debug Info:</strong><br />
          User Agent: {navigator.userAgent.substring(0, 60)}...<br />
          Audio Files: chime.mp3, beep.mp3, ding.mp3<br />
          Location: /lovable-uploads/
        </div>
      </CardContent>
    </Card>
  );
}
