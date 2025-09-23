import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Repeat, Maximize2, Minimize2, X } from 'lucide-react';
import { useAudioSession } from '@/hooks/useAudioSession';
import { useIsMobile } from '@/hooks/use-mobile';

interface YouTubePreviewProps {
  videoId: string;
  title?: string;
  description?: string;
  thumbnail?: string;
}

// Use YouTube Iframe Player API for full control and reliable syncing
export const YouTubePreview: React.FC<YouTubePreviewProps> = ({ videoId, title, description, thumbnail }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [playerReady, setPlayerReady] = useState<boolean>(false);
  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [loop, setLoop] = useState<boolean>(false);
  const fullscreenWrapperRef = useRef<HTMLDivElement | null>(null);
  // Refs to avoid stale values inside YouTube API callbacks
  const loopRef = useRef<boolean>(false);
  const isFullscreenRef = useRef<boolean>(false);
  // Force: use full session manager on all devices (mobile behaves like desktop/tablet)
  const { isMobile: _isMobile } = useIsMobile();
  const isMobile = false;
  const [useNativeControls, setUseNativeControls] = useState<boolean>(false);
  
  // Audio session management
  const { register, unregister, requestPlayback, stopSession, isPlaying: isSessionPlaying } = useAudioSession();
  const sessionId = `youtube-${videoId}`;

  useEffect(() => { loopRef.current = loop; }, [loop]);
  useEffect(() => { isFullscreenRef.current = isFullscreen; }, [isFullscreen]);

  // Compute whether we should use native controls (mobile portrait)
  useEffect(() => {
    const calc = () => {
      // Force: always use custom controls so session manager can arbitrate audio
      setUseNativeControls(false);
    };
    calc();
    window.addEventListener('resize', calc);
    window.addEventListener('orientationchange', calc as any);
    return () => {
      window.removeEventListener('resize', calc);
      window.removeEventListener('orientationchange', calc as any);
    };
  }, []);

  // Load YT Iframe API and create player
  useEffect(() => {
    let cancelled = false;

    const ensureApi = () => new Promise<void>((resolve) => {
      const w = window as any;
      if (w.YT && w.YT.Player) return resolve();
      const prev = document.getElementById('yt-iframe-api');
      if (!prev) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        tag.id = 'yt-iframe-api';
        document.head.appendChild(tag);
      }
      const onReady = () => resolve();
      if (!w.onYouTubeIframeAPIReady) {
        w.onYouTubeIframeAPIReady = onReady;
      } else {
        // API might already be loading; poll until available
        const iv = window.setInterval(() => {
          if (w.YT && w.YT.Player) {
            window.clearInterval(iv);
            resolve();
          }
        }, 50);
      }
    });

    const create = async () => {
      await ensureApi();
      if (cancelled) return;
      const w = window as any;
      if (!playerContainerRef.current) return;
      playerRef.current = new w.YT.Player(playerContainerRef.current, {
        videoId,
        height: '100%',
        width: '100%',
        playerVars: {
          controls: useNativeControls ? 1 : 0,
          fs: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          disablekb: 1,
          // Do not auto-loop by default. We'll handle looping manually when enabled.
          loop: 0,
        },
        events: {
          onReady: (ev: any) => {
            if (cancelled) return;
            setPlayerReady(true);
            try {
              // Initial mute to satisfy autoplay policies; user can unmute anytime
              ev.target.mute();
              setMuted(true);
              const d = ev.target.getDuration?.() || 0;
              if (d) setDuration(d);
              // Allow PiP and fullscreen on the iframe element
              try {
                const iframe = ev.target?.getIframe?.();
                iframe?.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
                iframe?.setAttribute('allowfullscreen', '');
              } catch {}
            } catch {}
          },
          onStateChange: (ev: any) => {
            if (cancelled) return;
            const state = ev.data; // YT.PlayerState
            if (state === 1) {
              setIsPlaying(true);
              setHasStarted(true);
              // Simple mode on all devices: play/unmute without session logic
              try { playerRef.current?.unMute?.(); setMuted(false); } catch {}
              // Start progress polling every 1s while playing
              if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current);
              progressIntervalRef.current = window.setInterval(() => {
                try {
                  if (playerRef.current && !isScrubbing) {
                    const t = playerRef.current.getCurrentTime?.() || 0;
                    const d = playerRef.current.getDuration?.() || duration;
                    setCurrentTime(t);
                    if (d && d !== duration) setDuration(d);
                  }
                } catch {}
              }, 1000) as unknown as number;
            } else if (state === 2 || state === 0) {
              setIsPlaying(false);
              // Optional: keep event if other parts listen; harmless if unused
              try { window.dispatchEvent(new CustomEvent('wakti-youtube-paused', { detail: { videoId, ended: state === 0 } })); } catch {}
              if (progressIntervalRef.current) {
                window.clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
              }
              // No session manager: nothing else to do here
              // Manual loop: if ended and loop is enabled, restart from 0
              try {
                if (state === 0 && loopRef.current) {
                  playerRef.current?.seekTo?.(0, true);
                  playerRef.current?.playVideo?.();
                  return; // exit handler so play branch will take over next tick
                }
              } catch {}
            }
          }
        }
      });
    };

    create();
    return () => {
      cancelled = true;
      if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
      try { playerRef.current?.destroy?.(); } catch {}
      playerRef.current = null;
      // Unregister only if we registered (i.e., when not using native controls)
      if (!isMobile) {
        unregister(sessionId);
      }
    };
  }, [videoId, useNativeControls, unregister]);

  // No session manager: keep effect for compatibility but do nothing
  useEffect(() => { return () => {}; }, [playerReady, sessionId]);

  // On non-mobile, still respect the session manager changes (back-compat)
  useEffect(() => {
    if (useNativeControls) return; // skip in Simple Mode
    const onSessionChange = (e: CustomEvent) => {
      const { activeSource, sessionId: activeId } = e.detail;
      if (activeSource !== 'youtube' && activeId !== sessionId && isPlaying) {
        try { playerRef.current?.pauseVideo?.(); } catch {}
      }
    };
    window.addEventListener('wakti-audio-session-changed', onSessionChange as EventListener);
    return () => window.removeEventListener('wakti-audio-session-changed', onSessionChange as EventListener);
  }, [sessionId, isPlaying, useNativeControls]);

  // Control handlers with audio session management
  const handlePlay = async () => {
    if (!playerReady || !playerRef.current) return;
    const player = playerRef.current;
    try { player.playVideo(); player.unMute(); setMuted(false); } catch {}
  };
  const handlePause = async () => {
    if (!playerReady || !playerRef.current) return;
    try { playerRef.current.pauseVideo(); } catch {}
  };
  const handlePlayPause = () => {
    if (isPlaying) handlePause(); else handlePlay();
  };
  const handleRewind = (sec = 10) => {
    if (!playerReady || !playerRef.current) return;
    try {
      const t = (playerRef.current.getCurrentTime?.() || 0) - sec;
      playerRef.current.seekTo(Math.max(0, t), true);
    } catch {}
  };
  const handleForward = (sec = 10) => {
    if (!playerReady || !playerRef.current) return;
    try {
      const t = (playerRef.current.getCurrentTime?.() || 0) + sec;
      const d = playerRef.current.getDuration?.() || duration || 0;
      playerRef.current.seekTo(Math.min(d, t), true);
    } catch {}
  };
  const handleMuteToggle = () => {
    if (!playerReady || !playerRef.current) return;
    try {
      if (muted) { playerRef.current.unMute(); setMuted(false); }
      else { playerRef.current.mute(); setMuted(true); }
    } catch {}
  };

  // Fullscreen controls (in-app)
  const supportsFullscreenApi = () => {
    const el: any = document.documentElement as any;
    return !!(el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen);
  };
  const enterNativeFullscreen = async (el: any) => {
    if (el.requestFullscreen) return el.requestFullscreen();
    // @ts-ignore
    if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
    // @ts-ignore
    if (el.msRequestFullscreen) return el.msRequestFullscreen();
  };
  const exitNativeFullscreen = async () => {
    if (document.exitFullscreen) return document.exitFullscreen();
    // @ts-ignore
    if ((document as any).webkitExitFullscreen) return (document as any).webkitExitFullscreen();
    // @ts-ignore
    if ((document as any).msExitFullscreen) return (document as any).msExitFullscreen();
  };

  useEffect(() => {
    const onFsChange = () => {
      const fsElement: any = (document as any).fullscreenElement || (document as any).webkitFullscreenElement || (document as any).msFullscreenElement;
      setIsFullscreen(!!fsElement);
      // adjust player size when entering native fullscreen
      try {
        if (playerRef.current) {
          if (fsElement) playerRef.current.setSize?.(window.innerWidth, window.innerHeight);
          else playerRef.current.setSize?.('100%', '100%');
        }
      } catch {}
    };
    document.addEventListener('fullscreenchange', onFsChange);
    // @ts-ignore
    document.addEventListener('webkitfullscreenchange', onFsChange);
    // @ts-ignore
    document.addEventListener('MSFullscreenChange', onFsChange as any);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      // @ts-ignore
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      // @ts-ignore
      document.removeEventListener('MSFullscreenChange', onFsChange as any);
    };
  }, []);

  const enterFullscreen = async () => {
    const wrapper = fullscreenWrapperRef.current;
    if (!wrapper) return;
    if (supportsFullscreenApi()) {
      try { await enterNativeFullscreen(wrapper); } catch {}
    } else {
      // Fallback: simulate fullscreen by applying fixed overlay class
      setIsFullscreen(true);
    }
  };
  const exitFullscreen = async () => {
    if (supportsFullscreenApi()) {
      try { await exitNativeFullscreen(); } catch {}
    } else {
      setIsFullscreen(false);
    }
  };

  // Progress bar handlers (range input)
  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const onProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!playerRef.current || !playerReady) return;
    const newPct = Number(e.target.value);
    const newTime = (duration || 0) * (newPct / 100);
    try { playerRef.current.seekTo(newTime, true); } catch {}
    setCurrentTime(newTime);
  };
  const onScrubStart = () => setIsScrubbing(true);
  const onScrubEnd = () => setIsScrubbing(false);

  const fmt = (s: number) => {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  // (Reverted) No Media Session integration; retain prior stable behavior.

  return (
    <div className="space-y-2">
      <div className="font-medium" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {title}
      </div>

      <div
        ref={fullscreenWrapperRef}
        className={`${isFullscreen ? 'fixed inset-0 z-[100000] bg-black' : 'relative'} transition-all duration-300`}
        style={isFullscreen ? { borderRadius: 0 } : { paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '0.5rem' }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          ref={playerContainerRef}
          style={{ position: isFullscreen ? 'fixed' : 'absolute', top: 0, left: 0, width: '100%', height: isFullscreen ? '100%' : '100%' }}
        />
        {/* Non-interactive overlay: single pointer handler to avoid double events */}
        {hasStarted && !useNativeControls && (
          <div
            className="absolute inset-0"
            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
            onPointerUp={(e) => { e.stopPropagation(); e.preventDefault(); handlePlayPause(); }}
            aria-label={isPlaying ? 'Pause video' : 'Play video'}
            title={isPlaying ? 'Pause' : 'Play'}
          />
        )}
        {/* YouTube pill badge top-left */}
        <div className="absolute top-2 left-2 z-10 select-none">
          <span className="px-2 py-0.5 text-xs rounded-full bg-red-600 text-white shadow">YouTube</span>
        </div>
        {/* Expand/Collapse button top-right */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
          {!isFullscreen ? (
            <button
              aria-label="Enter fullscreen"
              onClick={(e) => { e.stopPropagation(); enterFullscreen(); }}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-black/50 text-white hover:bg-black/70"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          ) : (
            <>
              <button
                aria-label="Exit fullscreen"
                onClick={(e) => { e.stopPropagation(); exitFullscreen(); }}
                className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-black/50 text-white hover:bg-black/70"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
              <button
                aria-label="Close"
                onClick={(e) => { e.stopPropagation(); exitFullscreen(); }}
                className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-black/50 text-white hover:bg-black/70"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
        {/* On mobile with native controls, rely on the iframe's native play button; on desktop show thumbnail play */}
        {!hasStarted && !useNativeControls && (
          <button
            type="button"
            className="absolute inset-0 w-full h-full"
            onTouchStart={(e) => { e.stopPropagation(); handlePlay(); }}
            onClick={(e) => { e.stopPropagation(); handlePlay(); }}
            style={{ touchAction: 'manipulation' }}
            aria-label="Play YouTube preview"
          >
            <img
              src={thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
              alt={title || 'YouTube thumbnail'}
              className="w-full h-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="h-16 w-16 rounded-full bg-red-600/90 hover:bg-red-600 shadow-xl flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="h-8 w-8 text-white" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              </span>
            </span>
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="space-y-2" dir="ltr">
        {/* Progress bar (range input) */}
        <div className="w-full">
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={pct}
            onChange={onProgressChange}
            onMouseDown={onScrubStart}
            onMouseUp={onScrubEnd}
            onTouchStart={onScrubStart}
            onTouchEnd={onScrubEnd}
            aria-label="Seek"
            className="w-full h-2 bg-transparent appearance-none"
            dir="ltr"
            style={{
              background: `linear-gradient(to right, #ef4444 ${pct}%, rgba(239,68,68,0.25) ${pct}%)`,
              borderRadius: '9999px'
            }}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>{fmt(currentTime)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>

        {/* Icon Buttons */}
        <div className="flex items-center gap-1.5 text-xs" dir="ltr">
          <button
            className="h-8 w-8 inline-flex items-center justify-center rounded-md border bg-white/70 dark:bg-white/10 border-border hover:bg-white"
            onClick={() => handleRewind(10)}
            title="Rewind 10s"
            aria-label="Rewind 10 seconds"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            className={`${isPlaying
              ? 'h-8 w-8 inline-flex items-center justify-center rounded-md border bg-green-50 text-green-700 border-green-300 shadow-[0_0_8px_rgba(34,197,94,0.7)] dark:bg-green-900/30 dark:text-green-300 dark:border-green-700/50'
              : 'h-8 w-8 inline-flex items-center justify-center rounded-md border bg-white/70 dark:bg-white/10 border-border hover:bg-white'}`}
            onTouchStart={handlePlayPause}
            onClick={handlePlayPause}
            style={{ touchAction: 'manipulation' }}
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            className="h-8 w-8 inline-flex items-center justify-center rounded-md border bg-white/70 dark:bg-white/10 border-border hover:bg-white"
            onClick={() => handleForward(10)}
            title="Forward 10s"
            aria-label="Forward 10 seconds"
          >
            <RotateCw className="h-4 w-4" />
          </button>
          <button
            className="h-8 w-8 inline-flex items-center justify-center rounded-md border bg-white/70 dark:bg-white/10 border-border hover:bg-white"
            onClick={handleMuteToggle}
            title={muted ? 'Unmute' : 'Mute'}
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            className={`h-8 w-8 inline-flex items-center justify-center rounded-md border ${loop
              ? 'bg-green-50 text-green-700 border-green-300 shadow-[0_0_8px_rgba(34,197,94,0.7)] dark:bg-green-900/30 dark:text-green-300 dark:border-green-700/50'
              : 'bg-white/70 dark:bg-white/10 border-border hover:bg-white'}`}
            onClick={() => setLoop((v) => !v)}
            title={loop ? 'Loop On' : 'Loop Off'}
            aria-label={loop ? 'Loop On' : 'Loop Off'}
          >
            <Repeat className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default YouTubePreview;
