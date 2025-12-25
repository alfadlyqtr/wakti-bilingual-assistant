import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Pause, Play, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { SUPABASE_URL } from '@/integrations/supabase/client';
import type { ShareManifestV1, ShareManifestV2 } from '@/utils/presentationShare';
import { getPublicStorageUrl } from '@/utils/presentationShare';
import PresentationSlideReadOnly from '@/components/wakti-ai-v2/PresentationSlideReadOnly';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; manifest: ShareManifestV1 | ShareManifestV2 };

function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function PresentationSharePlayer(): React.ReactElement {
  const { token } = useParams();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const manualSeekRef = useRef(false);

  const bucket = 'ai-temp-images';

  const manifestUrl = useMemo(() => {
    if (!token) return null;
    return getPublicStorageUrl({
      supabaseUrl: SUPABASE_URL,
      bucket,
      path: `presentation-share/${token}/manifest.json`,
    });
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!manifestUrl) {
        setState({ status: 'error', message: 'Missing link token' });
        return;
      }

      try {
        const res = await fetch(manifestUrl, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`Failed to load presentation (${res.status})`);
        }
        const json = (await res.json()) as ShareManifestV1 | ShareManifestV2;
        if (!json || (json.version !== 1 && json.version !== 2)) {
          throw new Error('Invalid presentation data');
        }
        if (!cancelled) {
          setState({ status: 'ready', manifest: json });
          setActiveSlideIndex(0);
          setCurrentTime(0);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load presentation';
        if (!cancelled) setState({ status: 'error', message: msg });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [manifestUrl]);

  const manifest = state.status === 'ready' ? state.manifest : null;

  const isV2 = !!manifest && manifest.version === 2;

  const audioUrl = useMemo(() => {
    if (!manifest) return null;
    return getPublicStorageUrl({
      supabaseUrl: SUPABASE_URL,
      bucket,
      path: manifest.audioPath,
    });
  }, [manifest]);

  const activeSlide = useMemo(() => {
    if (!manifest) return null;
    return manifest.slides[Math.min(activeSlideIndex, manifest.slides.length - 1)] || null;
  }, [manifest, activeSlideIndex]);

  const activeSlideImageUrl = useMemo(() => {
    if (!manifest) return null;
    if (manifest.version !== 1) return null;
    const s = manifest.slides[Math.min(activeSlideIndex, manifest.slides.length - 1)];
    if (!s) return null;
    return getPublicStorageUrl({
      supabaseUrl: SUPABASE_URL,
      bucket,
      path: s.imagePath,
    });
  }, [manifest, activeSlideIndex]);

  const activeSlideDataV2 = useMemo(() => {
    if (!manifest || manifest.version !== 2) return null;
    const s = manifest.slides[Math.min(activeSlideIndex, manifest.slides.length - 1)];
    return s?.data || null;
  }, [manifest, activeSlideIndex]);

  // Keep slide index synced to audio time (skip if manual seek just happened)
  useEffect(() => {
    if (!manifest) return;
    if (manualSeekRef.current) {
      manualSeekRef.current = false;
      return;
    }

    const tMs = currentTime * 1000;
    let idx = 0;
    for (let i = 0; i < manifest.slides.length; i++) {
      if (tMs >= manifest.slides[i].startMs) idx = i;
    }
    if (idx !== activeSlideIndex) setActiveSlideIndex(idx);
  }, [currentTime, manifest, activeSlideIndex]);

  const totalDurationSeconds = useMemo(() => {
    if (!manifest) return 0;
    return manifest.totalDurationMs / 1000;
  }, [manifest]);

  const onTogglePlay = async () => {
    const el = audioRef.current;
    if (!el) return;

    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await el.play();
      setIsPlaying(true);
    } catch {
      // autoplay restrictions; user can hit play again
      setIsPlaying(false);
    }
  };

  const seekTo = (seconds: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(seconds, totalDurationSeconds));
    setCurrentTime(el.currentTime);
  };

  // Jump to slide and seek audio (must be before early returns to follow React hooks rules)
  const handleSlideClick = useCallback((idx: number) => {
    if (!manifest) return;
    const clampedIdx = Math.max(0, Math.min(idx, manifest.slides.length - 1));
    manualSeekRef.current = true; // Prevent useEffect from overriding
    setActiveSlideIndex(clampedIdx);
    const target = manifest.slides[clampedIdx];
    if (target && audioRef.current) {
      audioRef.current.currentTime = target.startMs / 1000;
      setCurrentTime(target.startMs / 1000);
    }
  }, [manifest]);

  const goToSlide = (idx: number) => {
    if (!manifest) return;
    const target = manifest.slides[Math.max(0, Math.min(idx, manifest.slides.length - 1))];
    seekTo(target.startMs / 1000);
  };

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0c0f14] via-[#0c0f14] to-[#060541] text-[#f2f2f2] flex items-center justify-center">
        <div className="text-sm opacity-80">Loading presentation...</div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0c0f14] via-[#0c0f14] to-[#060541] text-[#f2f2f2] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <div className="text-lg font-semibold">Unable to load</div>
          <div className="mt-2 text-sm opacity-80">{state.message}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0c0f14] via-[#0c0f14] to-[#060541] text-[#f2f2f2] flex flex-col">
      {/* Compact header */}
      <header className="flex-shrink-0 border-b border-white/10 bg-black/20 backdrop-blur px-4 py-2">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <img
            src="/lovable-uploads/33ebdcdd-300d-42cf-be5e-f6a82ca9ef4d.png"
            alt="Wakti"
            className="w-7 h-7 flex-shrink-0 rounded"
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{state.manifest.title}</div>
            <div className="text-xs opacity-60 truncate">Wakti AI Presentation</div>
          </div>
        </div>
      </header>

      {/* Main content - horizontal layout */}
      <main className="flex-1 flex flex-col gap-3 p-3 max-w-4xl mx-auto w-full">
        {/* Slide preview + controls */}
        <section className="flex-1 min-h-0 flex flex-col rounded-2xl border border-white/10 bg-black/30 backdrop-blur overflow-hidden">
          {/* Slide area */}
          <div className="flex-shrink-0 p-3">
            {isV2 && activeSlideDataV2 ? (
              <PresentationSlideReadOnly
                slide={activeSlideDataV2}
                theme={state.manifest.theme}
                language={state.manifest.language}
                slideIndex={activeSlideIndex}
                totalSlides={state.manifest.slides.length}
              />
            ) : (
              <div className="aspect-video rounded-2xl overflow-hidden relative bg-black flex items-center justify-center">
                {activeSlideImageUrl ? (
                  <img
                    src={activeSlideImageUrl}
                    alt={activeSlide?.title || `Slide ${activeSlideIndex + 1}`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-sm opacity-70">No slide image</div>
                )}
                <div className="absolute top-3 left-3 rounded-full bg-black/70 px-2.5 py-1 text-xs border border-white/20">
                  {activeSlideIndex + 1}/{state.manifest.slides.length}
                </div>
              </div>
            )}
          </div>

          {/* Slide navigation - more prominent indicator */}
          <div className="flex items-center justify-center gap-4 px-3 pb-2">
            <button
              type="button"
              onPointerUp={() => handleSlideClick(activeSlideIndex - 1)}
              onClick={() => handleSlideClick(activeSlideIndex - 1)}
              disabled={activeSlideIndex === 0}
              className="p-2 rounded-full bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label={state.manifest.language === 'ar' ? 'الشريحة السابقة' : 'Previous slide'}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-primary">
                {activeSlideIndex + 1}/{state.manifest.slides.length}
              </span>
              <span className="text-xs text-slate-500">
                {state.manifest.language === 'ar' ? 'الشريحة' : 'Slide'}
              </span>
            </div>
            <button
              type="button"
              onPointerUp={() => handleSlideClick(activeSlideIndex + 1)}
              onClick={() => handleSlideClick(activeSlideIndex + 1)}
              disabled={activeSlideIndex >= state.manifest.slides.length - 1}
              className="p-2 rounded-full bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label={state.manifest.language === 'ar' ? 'الشريحة التالية' : 'Next slide'}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Thumbnail strip - Dokie style */}
          <div className="px-3 pb-3 relative z-10 pointer-events-auto">
            <div className="flex gap-2 overflow-x-auto py-3 px-2 bg-slate-100 dark:bg-slate-800 rounded-xl w-full touch-manipulation">
              {(state.manifest.version === 1
                ? state.manifest.slides.map((s, i) => {
                    const thumbUrl = getPublicStorageUrl({
                      supabaseUrl: SUPABASE_URL,
                      bucket,
                      path: s.imagePath,
                    });

                    return (
                      <button
                        key={s.index}
                        type="button"
                        onPointerUp={() => handleSlideClick(i)}
                        onClick={() => handleSlideClick(i)}
                        className={`relative w-24 h-16 rounded-lg border-2 flex-shrink-0 overflow-hidden transition-all ${
                          activeSlideIndex === i
                            ? 'border-emerald-400 shadow-lg scale-105'
                            : 'border-slate-600 hover:border-blue-400'
                        }`}
                        aria-label={`${state.manifest.language === 'ar' ? 'الشريحة' : 'Slide'} ${i + 1}`}
                      >
                        <div className="w-full h-full p-1 flex flex-col bg-gradient-to-br from-slate-900 to-slate-800">
                          <div className="flex items-center gap-0.5 mb-1">
                            <div className="w-1 h-1 rounded-full bg-blue-500" />
                            <div className="w-1 h-1 rounded-full bg-blue-500" />
                          </div>
                          <div className="flex-1 flex items-center justify-center">
                            <img
                              src={thumbUrl}
                              alt={s.title}
                              className="w-full h-full rounded opacity-60 object-cover"
                            />
                          </div>
                          <div className="text-[8px] text-slate-500 text-right">{String(i + 1).padStart(2, '0')}</div>
                        </div>
                      </button>
                    );
                  })
                : state.manifest.slides.map((s, i) => {
                    const thumbUrl = s.data?.imageUrl || null;

                    return (
                      <button
                        key={s.index}
                        type="button"
                        onPointerUp={() => handleSlideClick(i)}
                        onClick={() => handleSlideClick(i)}
                        className={`relative w-24 h-16 rounded-lg border-2 flex-shrink-0 overflow-hidden transition-all ${
                          activeSlideIndex === i
                            ? 'border-emerald-400 shadow-lg scale-105'
                            : 'border-slate-600 hover:border-blue-400'
                        }`}
                        aria-label={`${state.manifest.language === 'ar' ? 'الشريحة' : 'Slide'} ${i + 1}`}
                      >
                        <div className="w-full h-full p-1 flex flex-col bg-gradient-to-br from-slate-900 to-slate-800">
                          <div className="flex items-center gap-0.5 mb-1">
                            <div className="w-1 h-1 rounded-full bg-blue-500" />
                            <div className="w-1 h-1 rounded-full bg-blue-500" />
                          </div>
                          <div className="flex-1 flex items-center justify-center">
                            {thumbUrl ? (
                              <img
                                src={thumbUrl}
                                alt={s.title}
                                className="w-full h-full rounded opacity-60 object-cover"
                              />
                            ) : (
                              <div className="space-y-0.5">
                                <div className="w-8 h-0.5 bg-slate-600 rounded" />
                                <div className="w-6 h-0.5 bg-slate-700 rounded" />
                              </div>
                            )}
                          </div>
                          <div className="text-[8px] text-slate-500 text-right">{String(i + 1).padStart(2, '0')}</div>
                        </div>
                      </button>
                    );
                  }))}
            </div>
          </div>

          {/* Controls bar */}
          <div className="flex-shrink-0 px-4 py-3 border-t border-white/10 bg-black/40">
            {/* Title */}
            <div className="text-sm font-medium truncate mb-2">{activeSlide?.title || ''}</div>
            
            {/* Progress bar */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs opacity-70 w-10 text-right font-mono">{formatTime(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={Math.max(0.001, totalDurationSeconds)}
                step={0.01}
                value={currentTime}
                aria-label="Playback position"
                title="Playback position"
                onChange={(e) => seekTo(Number(e.target.value))}
                className="flex-1 h-2 accent-[hsl(210_100%_65%)] cursor-pointer"
              />
              <span className="text-xs opacity-70 w-10 font-mono">{formatTime(totalDurationSeconds)}</span>
            </div>

            {/* Playback buttons */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => handleSlideClick(activeSlideIndex - 1)}
                disabled={activeSlideIndex === 0}
                className="h-10 w-10 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                title="Previous slide"
              >
                <SkipBack className="w-5 h-5" />
              </button>

              <button
                onClick={onTogglePlay}
                className="h-12 px-6 rounded-xl bg-gradient-to-r from-[#f2f2f2] to-[hsl(210_30%_80%)] text-black font-semibold hover:opacity-95 transition-opacity flex items-center justify-center gap-2"
                title="Play/Pause"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                {isPlaying ? 'Pause' : 'Play'}
              </button>

              <button
                onClick={() => handleSlideClick(activeSlideIndex + 1)}
                disabled={activeSlideIndex >= state.manifest.slides.length - 1}
                className="h-10 w-10 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                title="Next slide"
              >
                <SkipForward className="w-5 h-5" />
              </button>

              <div className="hidden md:flex items-center gap-2 ml-4">
                <Volume2 className="w-4 h-4 opacity-70" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  aria-label="Volume"
                  title="Volume"
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setVolume(v);
                    if (audioRef.current) audioRef.current.volume = v;
                  }}
                  className="w-20 h-1.5 accent-white/60 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      <audio
        ref={audioRef}
        src={audioUrl || undefined}
        onTimeUpdate={(e) => setCurrentTime((e.target as HTMLAudioElement).currentTime)}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        preload="auto"
      />
    </div>
  );
}
