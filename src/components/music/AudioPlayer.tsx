import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';

interface AudioPlayerProps {
  src: string;
  className?: string;
}

export function AudioPlayer({ src, className = '' }: AudioPlayerProps) {
  const { language } = useTheme();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Reset states when src changes
    setError(null);
    setIsLoading(true);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    // Force load the audio
    audio.load();
    
    // iOS Safari hack: Try to play/pause immediately to wake up audio system
    // This doesn't actually play audio but forces Safari to load the file
    const wakeUpAudio = async () => {
      try {
        audio.muted = true;
        const playPromise = audio.play();
        if (playPromise) {
          await playPromise;
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
        }
      } catch (e) {
        // Ignore errors from this hack
        audio.muted = false;
      }
    };
    wakeUpAudio();

    const handleLoadedMetadata = () => {
      console.log('[AudioPlayer] Loaded metadata:', { src, duration: audio.duration });
      setDuration(audio.duration);
      setIsLoading(false);
      setError(null);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleCanPlay = () => {
      console.log('[AudioPlayer] Can play:', src);
      setIsLoading(false);
      setError(null);
    };

    const handlePlaying = () => {
      console.log('[AudioPlayer] Playing event');
      setIsPlaying(true);
    };

    const handlePause = () => {
      console.log('[AudioPlayer] Pause event');
      setIsPlaying(false);
    };

    const handleStalled = () => {
      console.warn('[AudioPlayer] Stalled:', src);
    };

    const handleWaiting = () => {
      console.log('[AudioPlayer] Waiting for data...');
    };

    const handleError = (e: ErrorEvent | Event) => {
      console.error('[AudioPlayer] Load error:', { src, error: e, audioError: audio.error });
      setIsLoading(false);
      setIsPlaying(false);
      const errorMsg = language === 'ar' 
        ? 'فشل تحميل الملف الصوتي' 
        : 'Failed to load audio file';
      setError(errorMsg);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('stalled', handleStalled);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('stalled', handleStalled);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('error', handleError);
    };
  }, [src, language]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (isPlaying) {
        console.log('[AudioPlayer] Pausing audio');
        audio.pause();
        setIsPlaying(false);
      } else {
        console.log('[AudioPlayer] Attempting to play:', { 
          src, 
          readyState: audio.readyState, 
          networkState: audio.networkState,
          paused: audio.paused,
          currentSrc: audio.currentSrc
        });
        
        // If audio hasn't loaded yet, try to load it first
        if (audio.readyState < 2) {
          console.log('[AudioPlayer] Audio not ready, loading...');
          audio.load();
          // Wait a bit for load to start
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          await playPromise;
          console.log('[AudioPlayer] Play successful');
          setIsPlaying(true);
        }
      }
    } catch (error: any) {
      console.error('[AudioPlayer] Playback error:', error);
      setIsPlaying(false);
      
      // More specific error messages
      let errorMsg = language === 'ar' ? 'فشل تشغيل الصوت' : 'Failed to play audio';
      if (error.name === 'NotAllowedError') {
        errorMsg = language === 'ar' 
          ? 'يرجى التفاعل مع الصفحة أولاً' 
          : 'Please interact with the page first';
      } else if (error.name === 'NotSupportedError') {
        errorMsg = language === 'ar' 
          ? 'تنسيق الصوت غير مدعوم' 
          : 'Audio format not supported';
      }
      setError(errorMsg);
    }
  };

  const rewind = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, audio.currentTime - 10);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const bounds = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const percentage = x / bounds.width;
    audio.currentTime = percentage * duration;
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <audio ref={audioRef} src={src} preload="auto" crossOrigin="anonymous" />
      
      {error ? (
        <div className="flex-1 flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/20 px-3 py-2 rounded-md">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onPointerUp={togglePlay}
              disabled={isLoading}
              className="h-9 w-9"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onPointerUp={rewind}
              disabled={isLoading}
              className="h-9 w-9"
              title={language === 'ar' ? 'الرجوع 10 ثوان' : 'Rewind 10s'}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 flex items-center gap-2">
            <div
              className="flex-1 h-2 bg-muted rounded-full cursor-pointer overflow-hidden"
              onClick={handleProgressClick}
            >
              <div
                className="h-full bg-primary transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
            
            <div className="text-xs text-muted-foreground whitespace-nowrap min-w-[80px] text-right">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
