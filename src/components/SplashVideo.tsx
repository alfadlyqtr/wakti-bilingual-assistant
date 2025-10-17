import React, { useEffect, useMemo, useRef, useState } from 'react';

interface SplashVideoProps {
  onDone: () => void;
  preload: () => Promise<void>;
  src?: string;
}

export const SplashVideo: React.FC<SplashVideoProps> = ({ onDone, preload, src = '/lovable-uploads/wakti%20loading%20vid.mp4' }) => {
  const [timeGateDone, setTimeGateDone] = useState(false);
  const [preloadDone, setPreloadDone] = useState(false);
  const [canPlay, setCanPlay] = useState(false);
  const doneRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Start preload once mounted
  useEffect(() => {
    let mounted = true;
    preload().finally(() => {
      if (!mounted) return;
      setPreloadDone(true);
    });
    return () => { mounted = false; };
  }, [preload]);

  // 3s gate: cap the splash duration to ~3s (still waits for preload)
  useEffect(() => {
    const t = setTimeout(() => {
      setTimeGateDone(true);
      try { videoRef.current?.pause(); } catch {}
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  // Finish only when both are done
  useEffect(() => {
    if (doneRef.current) return;
    if (timeGateDone && preloadDone) {
      doneRef.current = true;
      // allow a tiny fade-out delay
      const t = setTimeout(onDone, 150);
      return () => clearTimeout(t);
    }
  }, [timeGateDone, preloadDone, onDone]);

  return (
    <div className="fixed inset-0 z-[2000] bg-black flex items-center justify-center">
      <div className="w-full h-full flex items-center justify-center">
        <video
          ref={videoRef}
          src={src}
          autoPlay
          muted
          playsInline
          onCanPlayThrough={() => setCanPlay(true)}
          className="max-w-[70vw] max-h-[70vh] rounded-xl shadow-2xl"
          style={{ objectFit: 'contain' }}
        />
      </div>
      {!canPlay && (
        <div className="absolute bottom-8 text-white/80 text-sm">
          Loading video...
        </div>
      )}
    </div>
  );
};
