import React, { useRef, useState, useEffect, useMemo, useCallback, useId } from 'react';
import { emitEvent, onEvent } from '@/utils/eventBus';
import { Play, Pause, RotateCcw, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';

interface AudioPlayerProps {
  src: string;
  className?: string;
  showLoopToggle?: boolean;
  onPlaybackChange?: (isPlaying: boolean) => void;
  onProgressChange?: (progress: { currentTime: number; duration: number; isPlaying: boolean }) => void;
}

export function AudioPlayer({ src, className = '', showLoopToggle = false, onPlaybackChange, onProgressChange }: AudioPlayerProps) {
  const { language } = useTheme();
  const playerId = useId();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const initializedSrcRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLooping, setIsLooping] = useState(false);

  // Stable ref so inline arrow functions from parents never cause effect re-runs
  const onPlaybackChangeRef = useRef(onPlaybackChange);
  useEffect(() => { onPlaybackChangeRef.current = onPlaybackChange; });
  const onProgressChangeRef = useRef(onProgressChange);
  useEffect(() => { onProgressChangeRef.current = onProgressChange; });

  const languageRef = useRef(language);
  useEffect(() => { languageRef.current = language; });

  const emitProgress = useCallback((nextCurrentTime: number, nextDuration: number, nextIsPlaying: boolean) => {
    onProgressChangeRef.current?.({
      currentTime: nextCurrentTime,
      duration: Number.isFinite(nextDuration) ? nextDuration : 0,
      isPlaying: nextIsPlaying,
    });
  }, []);

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
      onPlaybackChangeRef.current?.(true);
      emitProgress(audio.currentTime, audio.duration, true);
    };

    const handlePause = () => {
      setIsPlaying(false);
      onPlaybackChangeRef.current?.(false);
      emitProgress(audio.currentTime, audio.duration, false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      onPlaybackChangeRef.current?.(false);
      emitProgress(0, audio.duration, false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      emitProgress(audio.currentTime, audio.duration, !audio.paused && !audio.ended);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
      setError(null);
      emitProgress(audio.currentTime, audio.duration, !audio.paused && !audio.ended);
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
      onPlaybackChangeRef.current?.(false);
      emitProgress(audio.currentTime, audio.duration, false);
      setError(languageRef.current === 'ar' ? 'فشل تحميل الملف الصوتي' : 'Failed to load audio');
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
      onPlaybackChangeRef.current?.(false);
      emitProgress(audio.currentTime, audio.duration, false);
    };
  // attachAudio only re-creates when src changes (cleanSrc drives audio teardown anyway)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emitProgress, src]);

  const cleanupRef = useRef<(() => void) | null>(null);

  const ensureAudio = useCallback(() => {
    if (!cleanSrc) {
      setError(languageRef.current === 'ar' ? 'لا يوجد ملف صوتي' : 'No audio URL');
      return null;
    }

    if (audioRef.current && initializedSrcRef.current === cleanSrc) {
      return audioRef.current;
    }

    cleanupRef.current?.();

    const audio = new Audio(cleanSrc);
    audio.loop = isLooping;
    audioRef.current = audio;
    initializedSrcRef.current = cleanSrc;
    cleanupRef.current = attachAudio(audio);
    setCurrentTime(0);
    setDuration(0);
    setError(null);
    setIsLoading(true);
    audio.load();
    return audio;
  }, [attachAudio, cleanSrc, isLooping]);

  // Only tear down and reset when the SOURCE itself changes — not on every parent re-render
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsLoading(false);
    onPlaybackChangeRef.current?.(false);
    emitProgress(0, 0, false);
    setError(cleanSrc ? null : (languageRef.current === 'ar' ? 'لا يوجد ملف صوتي' : 'No audio URL'));
    cleanupRef.current?.();
    cleanupRef.current = null;
    audioRef.current = null;
    initializedSrcRef.current = null;

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      audioRef.current = null;
      initializedSrcRef.current = null;
      onPlaybackChangeRef.current?.(false);
      emitProgress(0, 0, false);
    };
  }, [cleanSrc]); // ← only cleanSrc, never onPlaybackChange or language

  // Listen for other players starting — pause this one if it's playing
  useEffect(() => {
    return onEvent('wakti-audio-play', (detail) => {
      if (detail.playerId !== playerId && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
    });
  }, [playerId]);

  const togglePlay = () => {
    const audio = ensureAudio();
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      // Stop all other players before starting this one
      emitEvent('wakti-audio-play', { playerId });
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

  const toggleLoop = () => {
    const nextLoop = !isLooping;
    setIsLooping(nextLoop);
    if (audioRef.current) {
      audioRef.current.loop = nextLoop;
    }
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
          <div className="flex flex-col gap-2 w-full">
            {/* Top row: buttons left, time right */}
            <div className="flex items-center justify-between">
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

                {showLoopToggle && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleLoop}
                    disabled={isLoading}
                    className={`h-9 w-9 ${isLooping ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15' : ''}`}
                    title={language === 'ar' ? 'تكرار' : 'Loop'}
                    aria-pressed={isLooping}
                  >
                    <Repeat className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="text-xs text-muted-foreground whitespace-nowrap">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            {/* Bottom row: progress bar spanning full width */}
            <div
              className="w-full h-1.5 bg-muted rounded-full cursor-pointer overflow-hidden"
              onClick={handleProgressClick}
            >
              <div
                className="h-full bg-primary transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
