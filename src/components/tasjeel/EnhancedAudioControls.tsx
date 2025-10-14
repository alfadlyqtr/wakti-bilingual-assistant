
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw, Square } from 'lucide-react';

interface EnhancedAudioControlsProps {
  audioUrl: string;
  labels: {
    play: string;
    pause: string;
    rewind: string;
    stop: string;
    error: string;
  };
  onPlay?: () => void;
  onPause?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onLoadedMetadata?: (duration: number) => void;
}

const EnhancedAudioControls: React.FC<EnhancedAudioControlsProps> = ({
  audioUrl,
  labels,
  onPlay,
  onPause,
  onTimeUpdate,
  onLoadedMetadata
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      onLoadedMetadata?.(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime, audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      onPause?.();
    };

    const handleError = () => {
      setError(labels.error);
      setIsPlaying(false);
    };

    const handlePlaying = () => {
      setIsPlaying(true);
    };

    const handlePaused = () => {
      setIsPlaying(false);
      onPause?.();
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePaused);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handlePaused);
    };
  }, [audioUrl, labels.error, onTimeUpdate, onLoadedMetadata, onPause]);

  const handlePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
        onPause?.();
      } else {
        await audio.play();
        setIsPlaying(true);
        onPlay?.();
      }
    } catch (err) {
      setError(labels.error);
    }
  };

  const handleRewind = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, audio.currentTime - 10);
  };

  const handleStop = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
    onPause?.();
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className="text-center text-red-500 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <audio ref={audioRef} src={audioUrl} preload="metadata" playsInline />
      
      <div className="flex items-center justify-center gap-2">
        <Button
          onClick={handleRewind}
          variant="outline"
          size="sm"
          disabled={!duration}
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
        
        <Button
          onPointerUp={handlePlay}
          variant={isPlaying ? "secondary" : "default"}
          size="sm"
          disabled={!duration}
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4 mr-1" />
              {labels.pause}
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-1" />
              {labels.play}
            </>
          )}
        </Button>
        
        <Button
          onClick={handleStop}
          variant="outline"
          size="sm"
          disabled={!duration}
        >
          <Square className="w-4 h-4" />
        </Button>
      </div>
      
      {duration > 0 && (
        <div className="text-center text-xs text-muted-foreground">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      )}
    </div>
  );
};

export default EnhancedAudioControls;
