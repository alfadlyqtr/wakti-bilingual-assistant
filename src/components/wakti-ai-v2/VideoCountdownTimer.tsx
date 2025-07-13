
import React, { useState, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';
import { Clock, Video } from 'lucide-react';

interface VideoCountdownTimerProps {
  messageId: string;
  taskId: string;
  userId: string;
  onPollingStart: () => void;
}

export function VideoCountdownTimer({ messageId, taskId, userId, onPollingStart }: VideoCountdownTimerProps) {
  const [countdown, setCountdown] = useState(12);
  const [isActive, setIsActive] = useState(true);
  const { language } = useTheme();

  useEffect(() => {
    if (!isActive || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setIsActive(false);
          startPolling();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, countdown]);

  const startPolling = async () => {
    try {
      console.log(`🎬 COUNTDOWN: Starting polling for task ${taskId}`);
      onPollingStart();
      
      // Call the isolated video polling function
      const { data, error } = await supabase.functions.invoke('vidu-status-poller', {
        body: { taskId, userId }
      });

      if (error) {
        console.error('🎬 COUNTDOWN: Polling error:', error);
      } else {
        console.log('🎬 COUNTDOWN: Polling response:', data);
      }
    } catch (error) {
      console.error('🎬 COUNTDOWN: Failed to start polling:', error);
    }
  };

  if (!isActive && countdown <= 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2 p-2 bg-muted/30 rounded-md">
        <Video className="h-4 w-4 animate-pulse" />
        <span>
          {language === 'ar' 
            ? 'جاري التحقق من حالة الفيديو...'
            : 'Checking video status...'
          }
        </span>
      </div>
    );
  }

  if (!isActive) return null;

  return (
    <div className="flex items-center gap-2 text-sm text-blue-600 mt-2 p-2 bg-blue-50 rounded-md border border-blue-200">
      <Clock className="h-4 w-4" />
      <span>
        {language === 'ar' 
          ? `جاري إنشاء الفيديو... ${countdown}ثانية`
          : `Video generating... ${countdown}s`
        }
      </span>
      <div className="ml-2 w-16 h-1 bg-blue-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-blue-500 transition-all duration-1000 ease-linear"
          style={{ width: `${((12 - countdown) / 12) * 100}%` }}
        />
      </div>
    </div>
  );
}
