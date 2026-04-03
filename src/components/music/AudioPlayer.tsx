import React, { useRef, useState, useEffect, useMemo, useCallback, useId } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';

interface AudioPlayerProps {
  src: string;
  className?: string;
}

export function AudioPlayer({ src, className = '' }: AudioPlayerProps) {
  const { language } = useTheme();
  const playerId = useId();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const initializedSrcRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanSrc = useMemo(() => {
    let cleanUrl = (src || '').trim();
    try {
      cleanUrl = decodeURIComponent(cleanUrl).trim();
    } catch {
    }
    if (cleanUrl.startsWith(' ')) {
      cleanUrl = cleanUrl.trimStart();
    }
    if (cleanUrl.startsWith('%20')) {
      cleanUrl = cleanUrl.slice(3).trimStart();
    }
    return cleanUrl;
  }, [src]);

  const attachAudio = useCallback((audio: HTMLAudioElement) => {
    const handlePlay = () => {
      setIsPlaying(true);
      setIsLoading(false);
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

    const handleCanPlay = () => {
      setIsLoading(false);
      setError(null);
    };

    const handleError = () => {
      const audioError = audio.error;
      console.error('[AudioPlayer] Error loading audio:', {
        src,
        cleanUrl: audio.src,
        errorCode: audioError?.code,
        errorMessage: audioError?.message
      });
      setIsLoading(false);
      setIsPlaying(false);
      setError(language === 'ar' ? 'فشل تحميل الملف الصوتي' : 'Failed to load audio');
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);

    return () => {
      audio.pause();
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
    };
  }, [language, src]);

  const cleanupRef = useRef<(() => void) | null>(null);

  const ensureAudio = useCallback(() => {
    if (!cleanSrc) {
      setError(language === 'ar' ? 'لا يوجد ملف صوتي' : 'No audio URL');
      return null;
    }

    if (audioRef.current && initializedSrcRef.current === cleanSrc) {
      return audioRef.current;
    }

    cleanupRef.current?.();

    const audio = new Audio(cleanSrc);
    audioRef.current = audio;
    initializedSrcRef.current = cleanSrc;
    cleanupRef.current = attachAudio(audio);
    setCurrentTime(0);
    setDuration(0);
    setError(null);
    setIsLoading(true);
    audio.load();
    return audio;
  }, [attachAudio, cleanSrc, language]);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsLoading(false);
    setError(cleanSrc ? null : (language === 'ar' ? 'لا يوجد ملف صوتي' : 'No audio URL'));
    cleanupRef.current?.();
    cleanupRef.current = null;
    audioRef.current = null;
    initializedSrcRef.current = null;

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      audioRef.current = null;
      initializedSrcRef.current = null;
    };
  }, [cleanSrc, language]);

  // Listen for other players starting — pause this one if it's playing
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ playerId: string }>).detail;
      if (detail.playerId !== playerId && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
    };
    window.addEventListener('wakti-audio-play', handler);
    return () => window.removeEventListener('wakti-audio-play', handler);
  }, [playerId]);

  const togglePlay = () => {
    const audio = ensureAudio();
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      // Stop all other players before starting this one
      window.dispatchEvent(new CustomEvent('wakti-audio-play', { detail: { playerId } }));
      setIsLoading(true);
      audio.play().catch(err => {
        console.error('[AudioPlayer] Play error:', err);
        setIsLoading(false);
        setError(language === 'ar' ? 'فشل تشغيل الصوت' : 'Failed to play audio');
      });
    }
  };

  const rewind = () => {
    const audio = ensureAudio() || audioRef.current;
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
              onClick={togglePlay}
              disabled={isLoading}
              className="h-9 w-9"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={rewind}
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
