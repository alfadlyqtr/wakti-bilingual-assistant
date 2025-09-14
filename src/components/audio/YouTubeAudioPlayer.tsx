import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

// Loads YouTube IFrame API once per app
let ytApiPromise: Promise<void> | null = null;
const autoplayedOnce = new Set<string>(); // ensure autoplay runs once per videoId per session
function loadYouTubeAPI(): Promise<void> {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    if ((window as any).YT && (window as any).YT.Player) {
      resolve();
      return;
    }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(tag);
    (window as any).onYouTubeIframeAPIReady = () => resolve();
  });
  return ytApiPromise;
}

interface YouTubeAudioPlayerProps {
  videoId: string;
  title?: string;
  className?: string;
  autoplay?: boolean;
  compact?: boolean; // smaller controls
  showTitle?: boolean; // render title above controls
}

function formatTime(sec: number) {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const YouTubeAudioPlayer: React.FC<YouTubeAudioPlayerProps> = ({ videoId, title, className, autoplay, compact = false, showTitle = true }) => {
  const mountNodeRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const autoplayRef = useRef(!!autoplay);
  const attemptedAutoplayRef = useRef(false);
  const [autoBlocked, setAutoBlocked] = useState(false);

  // keep autoplay ref in sync without re-creating player
  useEffect(() => {
    autoplayRef.current = !!autoplay;
  }, [autoplay]);

  // init API + player
  useEffect(() => {
    let interval: any;
    let cancelled = false;
    (async () => {
      await loadYouTubeAPI();
      if (cancelled) return;
      const YT = (window as any).YT;
      if (playerRef.current) {
        playerRef.current.destroy?.();
        playerRef.current = null;
      }
      // Create a detached node under document.body so React never touches it
      const mountEl = document.createElement('div');
      // Make the iframe minimally visible so iOS treats it as a real media element
      mountEl.style.position = 'fixed';
      mountEl.style.bottom = '0px';
      mountEl.style.left = '0px';
      mountEl.style.width = '1px';
      mountEl.style.height = '1px';
      mountEl.style.opacity = '0.001';
      mountEl.style.overflow = 'hidden';
      mountEl.style.pointerEvents = 'none';
      document.body.appendChild(mountEl);
      mountNodeRef.current = mountEl;
      playerRef.current = new YT.Player(mountEl, {
        height: 1,
        width: 1,
        videoId,
        playerVars: {
          controls: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          loop: 0,
          fs: 0,
          disablekb: 1,
          autoplay: 0,
          enablejsapi: 1,
          origin: (typeof window !== 'undefined' && window.location ? window.location.origin : undefined) as any,
          host: 'https://www.youtube.com',
        },
        events: {
          onReady: () => {
            setReady(true);
            setDuration(playerRef.current?.getDuration?.() || 0);
            if (autoplayRef.current && !attemptedAutoplayRef.current && !autoplayedOnce.has(videoId)) {
              attemptedAutoplayRef.current = true;
              autoplayedOnce.add(videoId);
              try {
                // Try UNMUTED autoplay only. If blocked, do nothing (user must tap play).
                const tryAutoplay = () => {
                  // attempt unmuted
                  try { playerRef.current?.unMute?.(); } catch {}
                  setMuted(false);
                  try { playerRef.current?.playVideo?.(); } catch {}

                  // check after 400ms
                  setTimeout(() => {
                    const state = playerRef.current?.getPlayerState?.();
                    if (state !== 1) {
                      setAutoBlocked(true);
                    }
                  }, 400);
                };

                // schedule to avoid dev StrictMode race
                requestAnimationFrame(() => setTimeout(tryAutoplay, 0));
              } catch {}
            }
          },
          onStateChange: (e: any) => {
            // 1 = playing, 2 = paused, 0 = ended
            if (e.data === 1) {
              setIsPlaying(true);
              try { window.dispatchEvent(new Event('wakti-youtube-playing')); } catch {}
            }
            else if (e.data === 2) {
              setIsPlaying(false);
              try { window.dispatchEvent(new Event('wakti-youtube-paused')); } catch {}
            }
            else if (e.data === 0) {
              // ended: stop and reset without replaying
              try {
                playerRef.current?.stopVideo?.();
                playerRef.current?.seekTo?.(0, true);
                playerRef.current?.pauseVideo?.();
              } catch {}
              setIsPlaying(false);
              try { window.dispatchEvent(new Event('wakti-youtube-paused')); } catch {}
            }
          }
        }
      });

      // poll current time and duration
      interval = setInterval(() => {
        if (!playerRef.current) return;
        setCurrent(playerRef.current.getCurrentTime?.() || 0);
        setDuration(playerRef.current.getDuration?.() || duration);
      }, 500);
    })();

    return () => {
      cancelled = true;
      clearInterval(interval);
      try { playerRef.current?.destroy?.(); } catch {}
      playerRef.current = null;
      // Remove the mount node we added to document.body
      try {
        if (mountNodeRef.current && mountNodeRef.current.parentNode) {
          mountNodeRef.current.parentNode.removeChild(mountNodeRef.current);
        }
      } catch {}
      mountNodeRef.current = null;
    };
  }, [videoId]);

  // If browser blocked unmuted autoplay, try play on first user interaction (unmuted)
  useEffect(() => {
    if (!autoplayRef.current) return;
    if (!autoBlocked) return;
    const unlock = () => {
      try {
        playerRef.current?.unMute?.();
        setMuted(false);
        setAutoBlocked(false);
        playerRef.current?.playVideo?.();
      } catch {}
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true } as any);
    window.addEventListener('keydown', unlock, { once: true } as any);
    window.addEventListener('touchstart', unlock, { once: true } as any);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, [autoBlocked]);

  const toggle = () => {
    if (!ready || !playerRef.current) return;
    const state = playerRef.current.getPlayerState?.();
    if (state === 1) {
      playerRef.current.pauseVideo?.();
      setIsPlaying(false);
    } else {
      playerRef.current.playVideo?.();
      setIsPlaying(true);
    }
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setCurrent(v);
    playerRef.current?.seekTo?.(v, true);
  };

  const volChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setVolume(v);
    playerRef.current?.setVolume?.(v);
    setMuted(v === 0);
  };

  const toggleMute = () => {
    if (!playerRef.current) return;
    if (muted) {
      playerRef.current.unMute?.();
      setMuted(false);
      playerRef.current.setVolume?.(volume || 100);
    } else {
      playerRef.current.mute?.();
      setMuted(true);
    }
  };

  return (
    <div className={`rounded-lg border border-border/30 bg-gradient-card ${compact ? 'p-1.5' : 'p-3'} ${className || ''}`}>
      {showTitle && title && (
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
            max={Math.max(1, duration)}
            value={Math.min(current, duration || 1)}
            onChange={seek}
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
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={muted ? 0 : volume}
          onChange={volChange}
          className={`${compact ? 'w-24' : 'w-28'} accent-primary`}
          disabled={!ready}
        />
      </div>
      {/* No iframe in React tree; it's mounted under document.body to avoid reconciliation issues */}
    </div>
  );
};

export default YouTubeAudioPlayer;
