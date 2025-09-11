import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface NativeAudioPlayerProps {
  src: string;
  title?: string;
  className?: string;
  autoplay?: boolean;
  compact?: boolean;
  rtl?: boolean; // Arabic layout: seek bar from right-to-left
}

function formatTime(sec: number) {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOS = /(iPad|iPhone|iPod)/i.test(ua);
  const iPadOS = (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
  return iOS || iPadOS;
}

const NativeAudioPlayer: React.FC<NativeAudioPlayerProps> = ({ src, title, className, autoplay, compact = false, rtl = false }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [ready, setReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1); // 0..1 for HTMLAudioElement
  const [autoBlocked, setAutoBlocked] = useState(false);

  const onTimeUpdate = () => {
    const el = audioRef.current;
    if (!el) return;
    setCurrent(el.currentTime || 0);
    setDuration(el.duration || 0);
  };

  const onLoadedMetadata = () => {
    const el = audioRef.current;
    if (!el) return;
    setDuration(el.duration || 0);
    setReady(true);
  };

  const onPlay = () => setIsPlaying(true);
  const onPause = () => setIsPlaying(false);

  // Attempt unmuted autoplay if requested
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!autoplay) return;

    // Try to play unmuted
    const tryPlay = async () => {
      try {
        el.muted = false;
        await el.play();
        setAutoBlocked(false);
      } catch {
        // blocked by browser: require user gesture
        setAutoBlocked(true);
      }
    };
    // Schedule to avoid StrictMode race
    const t = setTimeout(tryPlay, 0);
    return () => clearTimeout(t);
  }, [autoplay, src]);

  // Keep audio element state in sync (muted/volume)
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = muted;
  }, [muted]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    // iOS ignores volume programmatically; we'll still set it for other platforms
    try { el.volume = volume; } catch {}
  }, [volume]);

  // Attach media listeners
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('loadedmetadata', onLoadedMetadata);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);

    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('loadedmetadata', onLoadedMetadata);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
    };
  }, [src]);

  // Reset on src change
  useEffect(() => {
    setReady(false);
    setIsPlaying(false);
    setCurrent(0);
    setDuration(0);
    setAutoBlocked(false);
  }, [src]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el || !ready) return;
    if (el.paused) {
      el.play().catch(() => setAutoBlocked(true));
    } else {
      el.pause();
    }
  };

  // Seek handling with RTL support: when RTL, slider visually goes R->L by inverting value
  const displayedValue = useMemo(() => {
    if (!rtl) return Math.min(current, duration || 1);
    const d = Math.max(1, duration);
    const v = Math.min(current, duration || 1);
    return Math.max(0, d - v);
  }, [rtl, current, duration]);

  const maxValue = Math.max(1, duration || 1);

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    if (!el) return;
    const raw = Number(e.target.value);
    const target = rtl ? Math.max(0, maxValue - raw) : raw;
    el.currentTime = target;
    setCurrent(target);
  };

  const onVolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value); // 0..100
    setVolume(Math.min(1, Math.max(0, v / 100)));
    if (v > 0 && muted) setMuted(false);
  };

  const toggleMute = () => {
    setMuted(m => !m);
  };

  const showVolumeSlider = !isIOS();

  return (
    <div className={`rounded-lg border border-border/30 bg-gradient-card ${compact ? 'p-1.5' : 'p-3'} ${className || ''}`}
         dir={rtl ? 'rtl' : 'ltr'}>
      {title && (
        <div className={`truncate ${compact ? 'text-xs mb-0.5' : 'text-sm mb-1'} font-semibold`}>{title}</div>
      )}

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={toggle}
          className={`inline-flex items-center justify-center ${compact ? 'w-8 h-8' : 'w-10 h-10'} rounded-full bg-primary text-primary-foreground hover:opacity-90 transition shadow-sm`}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          disabled={!ready}
        >
          {isPlaying ? <Pause className={`${compact ? 'w-4 h-4' : 'w-5 h-5'}`} /> : <Play className={`${compact ? 'w-4 h-4' : 'w-5 h-5'}`} />}
        </button>

        <div className="flex-1 min-w-0">
          <input
            type="range"
            min={0}
            max={maxValue}
            value={displayedValue}
            onChange={onSeek}
            className={`w-full accent-primary ${compact ? 'h-1' : ''}`}
            disabled={!ready}
          />
          <div className={`flex justify-between text-muted-foreground ${compact ? 'text-[10px]' : 'text-xs'}`}>
            <span>{formatTime(current)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleMute}
          className={`inline-flex items-center justify-center ${compact ? 'w-7 h-7' : 'w-8 h-8'} rounded-md border border-border/40 hover:bg-accent/20 shadow-sm`}
          aria-label={muted ? 'Unmute' : 'Mute'}
          disabled={!ready}
        >
          {muted ? <VolumeX className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} /> : <Volume2 className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />}
        </button>

        {showVolumeSlider && (
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={muted ? 0 : Math.round(volume * 100)}
            onChange={onVolChange}
            className={`${compact ? 'w-24' : 'w-28'} accent-primary`}
            disabled={!ready}
          />
        )}
      </div>

      {isIOS() && (
        <div className={`${compact ? 'text-[10px]' : 'text-xs'} text-muted-foreground mt-1`}>
          Use your device volume to adjust loudness on iPhone/iPad. The mute button works here.
        </div>
      )}

      {/* Hidden real audio element */}
      <audio ref={audioRef} preload="metadata">
        <source src={src} />
      </audio>

      {autoplay && autoBlocked && (
        <div className={`${compact ? 'text-[10px]' : 'text-xs'} mt-1`}>
          <button
            type="button"
            className="underline text-primary"
            onClick={() => {
              const el = audioRef.current;
              if (!el) return;
              el.muted = false;
              el.play().catch(() => {});
              setAutoBlocked(false);
            }}
          >
            Tap to play
          </button>
        </div>
      )}
    </div>
  );
};

export default NativeAudioPlayer;
