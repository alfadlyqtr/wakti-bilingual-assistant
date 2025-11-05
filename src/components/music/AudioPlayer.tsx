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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setError(language === 'ar' ? 'لا يوجد ملف صوتي' : 'No audio URL');
      return;
    }

    // Create audio element directly (same as Tasjeel)
    const audio = new Audio(src);
    audioRef.current = audio;

    // Set up event listeners
    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
      setError(null);
    };

    const handleError = () => {
      console.error('[AudioPlayer] Error loading audio:', src);
      setIsLoading(false);
      setIsPlaying(false);
      setError(language === 'ar' ? 'فشل تحميل الملف الصوتي' : 'Failed to load audio');
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('error', handleError);

    // Load the audio
    audio.load();

    // Cleanup
    return () => {
      audio.pause();
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('error', handleError);
    };
  }, [src, language]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
        console.error('[AudioPlayer] Play error:', err);
        setError(language === 'ar' ? 'فشل تشغيل الصوت' : 'Failed to play audio');
      });
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
