
import React, { useState, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';
import { Clock, Video, AlertCircle, Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VideoCountdownTimerProps {
  messageId: string;
  taskId: string;
  userId: string;
  onPollingStart: () => void;
}

export function VideoCountdownTimer({ messageId, taskId, userId, onPollingStart }: VideoCountdownTimerProps) {
  const [countdown, setCountdown] = useState(20);
  const [isActive, setIsActive] = useState(true);
  const [status, setStatus] = useState<'counting' | 'ready' | 'checking' | 'success' | 'processing' | 'error'>('counting');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [checkingMessage, setCheckingMessage] = useState<string>('');
  const { language } = useTheme();

  useEffect(() => {
    if (!isActive || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setIsActive(false);
          setStatus('ready');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, countdown]);

  const handleManualCheck = async () => {
    setStatus('checking');
    setErrorMessage('');
    setCheckingMessage('');
    
    try {
      console.log('🎬 MANUAL CHECK: Starting manual check for task:', taskId);
      
      const { data, error } = await supabase.functions.invoke('vidu-manual-check', {
        body: { taskId, userId }
      });

      console.log('🎬 MANUAL CHECK: Response:', data, error);

      if (error) {
        console.error('🎬 MANUAL CHECK: Edge function error:', error);
        setStatus('error');
        setErrorMessage(language === 'ar' ? 'حدث خطأ في التحقق من الفيديو' : 'Error checking video status');
        return;
      }

      if (data.success && data.videoUrl) {
        console.log('🎬 MANUAL CHECK: Video ready! URL:', data.videoUrl);
        setVideoUrl(data.videoUrl);
        setStatus('success');
        
        // Trigger the real-time update
        window.dispatchEvent(new CustomEvent('updateVideoMessage', {
          detail: {
            taskId: taskId,
            videoUrl: data.videoUrl,
            status: 'completed',
            content: `🎬 **Video generation completed!**\n\nYour video is ready:\n\n<video controls width="400" class="video-player">\n<source src="${data.videoUrl}" type="video/mp4">\nYour browser does not support the video tag.\n</video>\n\n✨ Video generated successfully!`
          }
        }));
        
      } else if (data.stillProcessing) {
        console.log('🎬 MANUAL CHECK: Video still processing');
        setStatus('processing');
        setCheckingMessage(data.message || (language === 'ar' ? 'الفيديو لا يزال قيد المعالجة...' : 'Video is still processing...'));
      } else {
        console.log('🎬 MANUAL CHECK: Error:', data.error);
        setStatus('error');
        setErrorMessage(data.error || (language === 'ar' ? 'فشل في التحقق من حالة الفيديو' : 'Failed to check video status'));
      }
    } catch (error) {
      console.error('🎬 MANUAL CHECK: Exception:', error);
      setStatus('error');
      setErrorMessage(language === 'ar' ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred');
    }
  };

  if (status === 'success' && videoUrl) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 mt-2 p-2 bg-green-50 rounded-md border border-green-200">
        <Video className="h-4 w-4" />
        <span>
          {language === 'ar' 
            ? '✅ تم إنشاء الفيديو بنجاح!'
            : '✅ Video generated successfully!'
          }
        </span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="space-y-2 mt-2">
        <div className="flex items-center gap-2 text-sm text-red-600 p-2 bg-red-50 rounded-md border border-red-200">
          <AlertCircle className="h-4 w-4" />
          <span>{errorMessage}</span>
        </div>
        <Button
          onClick={handleManualCheck}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <Video className="h-4 w-4 mr-2" />
          {language === 'ar' ? 'المحاولة مرة أخرى' : 'Try Again'}
        </Button>
      </div>
    );
  }

  if (status === 'processing') {
    return (
      <div className="space-y-2 mt-2">
        <div className="flex items-center gap-2 text-sm text-orange-600 p-2 bg-orange-50 rounded-md border border-orange-200">
          <Clock className="h-4 w-4" />
          <span>{checkingMessage}</span>
        </div>
        <Button
          onClick={handleManualCheck}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <Video className="h-4 w-4 mr-2" />
          {language === 'ar' ? 'التحقق مرة أخرى' : 'Check Again'}
        </Button>
      </div>
    );
  }

  if (status === 'checking') {
    return (
      <div className="flex items-center gap-2 text-sm text-blue-600 mt-2 p-2 bg-blue-50 rounded-md border border-blue-200">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>
          {language === 'ar' 
            ? 'جاري التحقق من حالة الفيديو...'
            : 'Checking video status...'
          }
        </span>
      </div>
    );
  }

  if (status === 'ready') {
    return (
      <div className="mt-2">
        <Button
          onClick={handleManualCheck}
          variant="default"
          size="sm"
          className="w-full"
        >
          <Play className="h-4 w-4 mr-2" />
          {language === 'ar' ? 'التحقق من الفيديو المُنشأ' : 'Check Generated Video'}
        </Button>
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
          style={{ width: `${((20 - countdown) / 20) * 100}%` }}
        />
      </div>
    </div>
  );
}
