import { useState, useCallback, useRef } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

type TransitionType = 'fade' | 'slide-left' | 'slide-right' | 'zoom-in' | 'zoom-out' | 'wipe-left' | 'wipe-right' | 'dissolve' | 'none';
type TextAnimation = 'none' | 'fade-in' | 'slide-up' | 'slide-down' | 'zoom-in' | 'typewriter' | 'bounce';
type TextFont = 'system' | 'serif' | 'mono' | 'handwritten' | 'bold';
type FilterPreset = 'none' | 'vivid' | 'warm' | 'cool' | 'vintage' | 'bw' | 'dramatic' | 'soft';

interface SlideFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  blur?: number;
  preset?: FilterPreset;
}

interface SlideConfig {
  mediaType?: 'image' | 'video';
  imageFile?: File;
  videoFile?: File;
  clipMuted?: boolean;
  clipVolume?: number; // 0..1
  text?: string;
  textPosition?: 'top' | 'center' | 'bottom';
  textColor?: string;
  textSize?: 'small' | 'medium' | 'large';
  textAnimation?: TextAnimation;
  textFont?: TextFont;
  textShadow?: boolean;
  durationSec: number;
  transition?: TransitionType;
  transitionDuration?: number;
  filters?: SlideFilters;
  kenBurns?: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'pan-up' | 'pan-down' | 'random';
  kenBurnsSpeed?: number;
}

interface VideoGenerationOptions {
  slides: SlideConfig[];
  audioUrl?: string | null;
  audioTrimStart?: number;
  audioTrimEnd?: number;
  width?: number;
  height?: number;
  transitionDuration?: number;
}

interface UseCanvasVideoReturn {
  generateVideo: (options: VideoGenerationOptions) => Promise<Blob | null>;
  progress: number;
  status: string;
  error: string | null;
  isLoading: boolean;
  isReady: boolean;
}

type KenBurnsDirection = 'zoomIn' | 'zoomOut' | 'panLeft' | 'panRight' | 'panUp' | 'panDown';

const KEN_BURNS_DIRECTIONS: KenBurnsDirection[] = ['zoomIn', 'zoomOut', 'panLeft', 'panRight', 'panUp', 'panDown'];

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

const FFMPEG_CORE_URL = '/ffmpeg';

export function useCanvasVideo(): UseCanvasVideoReturn {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const ffmpegLoadedRef = useRef(false);

  // Check if FFmpeg/SharedArrayBuffer is available on this device
  const canUseFFmpeg = useCallback((): boolean => {
    try {
      // SharedArrayBuffer is required for FFmpeg.wasm
      if (typeof SharedArrayBuffer === 'undefined') {
        console.log('[useCanvasVideo] SharedArrayBuffer not available');
        return false;
      }
      // iOS Safari has issues with FFmpeg even with SAB
      const ua = navigator.userAgent || '';
      const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
      if (isIOS) {
        console.log('[useCanvasVideo] Skipping FFmpeg on iOS - not reliable');
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  // Check if we're on iOS
  const isIOSDevice = useCallback((): boolean => {
    const ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  }, []);

  const convertWebmToMp4 = useCallback(async (webmBlob: Blob): Promise<Blob> => {
    // On iOS, skip conversion entirely - we'll handle playback differently
    if (isIOSDevice()) {
      console.log('[useCanvasVideo] iOS device - skipping conversion, WebM will be handled by UI');
      return webmBlob;
    }

    // Skip conversion if FFmpeg won't work reliably
    if (!canUseFFmpeg()) {
      console.log('[useCanvasVideo] FFmpeg not available, returning WebM');
      return webmBlob;
    }

    try {
      if (!ffmpegRef.current) {
        ffmpegRef.current = new FFmpeg();
      }
      const ffmpeg = ffmpegRef.current;

      if (!ffmpegLoadedRef.current) {
        setStatus('Loading video converter...');
        const coreURL = `${FFMPEG_CORE_URL}/ffmpeg-core.js`;
        const wasmURL = `${FFMPEG_CORE_URL}/ffmpeg-core.wasm`;
        
        const [coreBlob, wasmBlob] = await Promise.all([
          fetch(coreURL).then(r => r.blob()),
          fetch(wasmURL).then(r => r.blob()),
        ]);
        
        await ffmpeg.load({
          coreURL: URL.createObjectURL(coreBlob),
          wasmURL: URL.createObjectURL(wasmBlob),
        });
        ffmpegLoadedRef.current = true;
      }

      setStatus('Converting to MP4...');
      
      const inputData = await fetchFile(webmBlob);
      await ffmpeg.writeFile('input.webm', inputData);
      
      await ffmpeg.exec([
        '-i', 'input.webm',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-pix_fmt', 'yuv420p',
        '-y',
        'output.mp4'
      ]);
      
      const outputData = await ffmpeg.readFile('output.mp4');
      await ffmpeg.deleteFile('input.webm').catch(() => {});
      await ffmpeg.deleteFile('output.mp4').catch(() => {});
      
      let blobPart: BlobPart;
      if (outputData instanceof Uint8Array) {
        blobPart = new Uint8Array(outputData);
      } else {
        blobPart = new Uint8Array(outputData as unknown as ArrayBuffer);
      }
      
      return new Blob([blobPart], { type: 'video/mp4' });
    } catch (e) {
      console.error('[useCanvasVideo] FFmpeg conversion failed:', e);
      return webmBlob;
    }
  }, [canUseFFmpeg, isIOSDevice]);

  const generateVideo = useCallback(async (options: VideoGenerationOptions): Promise<Blob | null> => {
    const {
      slides,
      audioUrl,
      audioTrimStart = 0,
      audioTrimEnd,
      width = 1080,
      height = 1920,
      transitionDuration = 0.5,
    } = options;

    if (!slides || slides.length === 0) {
      setError('No slides provided');
      return null;
    }

    // Validate slide media
    for (const s of slides) {
      const type = s.mediaType || (s.videoFile ? 'video' : 'image');
      if (type === 'image' && !s.imageFile) {
        setError('One of your image slides is missing its file');
        return null;
      }
      if (type === 'video' && !s.videoFile) {
        setError('One of your video slides is missing its file');
        return null;
      }
    }

    setIsLoading(true);
    setError(null);
    setProgress(0);
    setStatus('Preparing your video...');

    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Canvas not supported');
      }

      setStatus('Loading your media...');
      setProgress(5);

      const mediaObjectUrls: string[] = [];
      const loadedImages: Array<HTMLImageElement | null> = [];
      const loadedVideos: Array<HTMLVideoElement | null> = [];

      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        const mediaType = slide.mediaType || (slide.videoFile ? 'video' : 'image');

        if (mediaType === 'video') {
          const url = URL.createObjectURL(slide.videoFile as File);
          mediaObjectUrls.push(url);
          loadedImages.push(null);

          const video = document.createElement('video');
          video.src = url;
          video.crossOrigin = 'anonymous';
          video.muted = true; // we mix audio ourselves
          video.playsInline = true;
          video.preload = 'auto';

          await new Promise<void>((resolve, reject) => {
            const timeout = window.setTimeout(() => reject(new Error(`Video load timeout ${i + 1}`)), 15000);
            const cleanup = () => {
              window.clearTimeout(timeout);
              video.onloadedmetadata = null;
              video.oncanplay = null;
              video.onerror = null;
            };
            video.onloadedmetadata = () => {
              cleanup();
              resolve();
            };
            video.oncanplay = () => {
              cleanup();
              resolve();
            };
            video.onerror = () => {
              cleanup();
              reject(new Error(`Failed to load video ${i + 1}`));
            };
            video.load();
          });

          loadedVideos.push(video);
        } else {
          const url = URL.createObjectURL(slide.imageFile as File);
          mediaObjectUrls.push(url);
          loadedVideos.push(null);

          const img = new Image();
          img.crossOrigin = 'anonymous';

          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error(`Failed to load image ${i + 1}`));
            img.src = url;
          });

          loadedImages.push(img);
        }

        setProgress(5 + (i / slides.length) * 15);
        setStatus(`Loading media ${i + 1} of ${slides.length}...`);
      }

      setStatus('Creating your video...');
      setProgress(25);

      const stream = canvas.captureStream(30);

      // Audio mixing (background audio + clip audio)
      let audioElement: HTMLAudioElement | null = null;
      let audioContext: AudioContext | null = null;
      let mixedDestination: MediaStreamAudioDestinationNode | null = null;
      let bgGain: GainNode | null = null;
      const clipGainNodes: Array<GainNode | null> = [];
      const clipSourceNodes: Array<MediaElementAudioSourceNode | null> = [];

      try {
        audioContext = new AudioContext();
        if (audioContext.state !== 'running') {
          await audioContext.resume();
        }
        mixedDestination = audioContext.createMediaStreamDestination();

        // Background audio (optional)
        if (audioUrl) {
          console.log('[useCanvasVideo] Loading background audio from:', audioUrl.substring(0, 100) + '...');
          setStatus('Loading audio...');

          const audioResponse = await fetch(audioUrl);
          if (!audioResponse.ok) {
            throw new Error(`Audio fetch failed: ${audioResponse.status}`);
          }
          const audioBlob = await audioResponse.blob();
          const audioBlobUrl = URL.createObjectURL(audioBlob);
          mediaObjectUrls.push(audioBlobUrl);

          audioElement = new Audio(audioBlobUrl);
          audioElement.crossOrigin = 'anonymous';
          audioElement.preload = 'auto';
          audioElement.volume = 1;

          if (typeof audioTrimEnd === 'number' && Number.isFinite(audioTrimEnd)) {
            audioElement.addEventListener('timeupdate', () => {
              if (!audioElement) return;
              if (audioElement.currentTime >= audioTrimEnd) {
                audioElement.pause();
              }
            });
          }

          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Audio load timeout')), 10000);
            audioElement!.oncanplaythrough = () => {
              clearTimeout(timeout);
              resolve();
            };
            audioElement!.onerror = () => {
              clearTimeout(timeout);
              reject(new Error('Audio element error'));
            };
            audioElement!.load();
          });

          const bgSource = audioContext.createMediaElementSource(audioElement);
          bgGain = audioContext.createGain();
          bgGain.gain.value = 1;
          bgSource.connect(bgGain);
          bgGain.connect(mixedDestination);
        }

        // Clip audio (only for video slides)
        for (let i = 0; i < slides.length; i++) {
          const slide = slides[i];
          const mediaType = slide.mediaType || (slide.videoFile ? 'video' : 'image');
          if (mediaType !== 'video' || !loadedVideos[i] || !audioContext) {
            clipGainNodes.push(null);
            clipSourceNodes.push(null);
            continue;
          }

          const v = loadedVideos[i] as HTMLVideoElement;

          const gain = audioContext.createGain();
          gain.gain.value = 0; // off by default; enabled when slide is active

          const source = audioContext.createMediaElementSource(v);
          source.connect(gain);
          gain.connect(mixedDestination);

          clipGainNodes.push(gain);
          clipSourceNodes.push(source);
        }

        mixedDestination.stream.getAudioTracks().forEach((track) => {
          stream.addTrack(track);
        });

        console.log('[useCanvasVideo] Audio mixing ready');
      } catch (audioErr) {
        console.error('[useCanvasVideo] Audio setup failed:', audioErr);
        try {
          audioContext?.close();
        } catch (_) {}
        audioContext = null;
        mixedDestination = null;
        audioElement = null;
        bgGain = null;
        clipGainNodes.length = 0;
        clipSourceNodes.length = 0;

        // If the user selected audio, do NOT silently generate a muted video.
        if (audioUrl) {
          throw new Error('AUDIO_MIX_FAILED');
        }
      }

      // Prefer MP4 on iOS/Safari when supported. Otherwise fall back to WebM.
      const ua = navigator.userAgent || '';
      const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
      const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
      const preferMp4 = isIOS || isSafari;

      const preferredMimeTypes = preferMp4
        ? [
            'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
            'video/mp4',
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm',
          ]
        : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];

      let mimeType = preferredMimeTypes.find((t) => MediaRecorder.isTypeSupported(t)) || 'video/webm';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 6000000,
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      if (audioElement) {
        audioElement.currentTime = audioTrimStart;
        audioElement.play().catch(() => {});
      }

      mediaRecorder.start(100);

      const fps = 30;
      const frameDurationMs = 1000 / fps;
      
      const totalDurationSec = slides.reduce((sum, s) => sum + s.durationSec, 0);
      const totalFrames = Math.ceil(totalDurationSec * fps);
      
      const kenBurnsPerSlide: KenBurnsDirection[] = slides.map((s, i) => {
        // Preserve previous behavior for images unless slide.kenBurns is set.
        if (s.kenBurns === 'pan-left') return 'panLeft';
        if (s.kenBurns === 'pan-right') return 'panRight';
        if (s.kenBurns === 'pan-up') return 'panUp';
        if (s.kenBurns === 'pan-down') return 'panDown';
        if (s.kenBurns === 'zoom-in') return 'zoomIn';
        if (s.kenBurns === 'zoom-out') return 'zoomOut';
        if (s.kenBurns === 'random') return KEN_BURNS_DIRECTIONS[i % KEN_BURNS_DIRECTIONS.length];
        return KEN_BURNS_DIRECTIONS[i % KEN_BURNS_DIRECTIONS.length];
      });

      const drawImageWithKenBurns = (
        img: HTMLImageElement,
        progressInSlide: number,
        direction: KenBurnsDirection
      ) => {
        const imgRatio = img.width / img.height;
        const canvasRatio = width / height;
        
        let baseWidth: number, baseHeight: number;
        if (imgRatio > canvasRatio) {
          baseHeight = height;
          baseWidth = height * imgRatio;
        } else {
          baseWidth = width;
          baseHeight = width / imgRatio;
        }

        const maxZoom = 1.15;
        const minZoom = 1.0;
        const maxPan = 0.08;
        
        let scale = 1.0;
        let offsetX = 0;
        let offsetY = 0;
        
        const t = easeInOutCubic(progressInSlide);
        
        switch (direction) {
          case 'zoomIn':
            scale = minZoom + (maxZoom - minZoom) * t;
            break;
          case 'zoomOut':
            scale = maxZoom - (maxZoom - minZoom) * t;
            break;
          case 'panLeft':
            scale = 1.08;
            offsetX = maxPan * baseWidth * (1 - t);
            break;
          case 'panRight':
            scale = 1.08;
            offsetX = -maxPan * baseWidth * (1 - t);
            break;
          case 'panUp':
            scale = 1.08;
            offsetY = maxPan * baseHeight * (1 - t);
            break;
          case 'panDown':
            scale = 1.08;
            offsetY = -maxPan * baseHeight * (1 - t);
            break;
        }

        const drawWidth = baseWidth * scale;
        const drawHeight = baseHeight * scale;
        const drawX = (width - drawWidth) / 2 + offsetX;
        const drawY = (height - drawHeight) / 2 + offsetY;

        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      };

      const applyFilters = (filters?: SlideFilters) => {
        if (!filters) return;
        const b = filters.brightness / 100;
        const c = filters.contrast / 100;
        const s = filters.saturation / 100;
        const blurPx = Math.max(0, filters.blur || 0);
        ctx.filter = `brightness(${b}) contrast(${c}) saturate(${s}) blur(${blurPx}px)`;
      };

      const resetFilters = () => {
        ctx.filter = 'none';
      };

      const drawText = (
        text: string, 
        position: 'top' | 'center' | 'bottom', 
        textOpacity: number,
        textColor?: string,
        textSize?: 'small' | 'medium' | 'large',
        animation?: TextAnimation,
        animationProgress?: number,
        textFont?: TextFont,
        textShadow?: boolean
      ) => {
        if (!text || text.trim() === '') return;
        
        ctx.save();
        
        const sizeMultiplier = textSize === 'small' ? 0.04 : textSize === 'large' ? 0.07 : 0.055;
        const fontSize = Math.floor(width * sizeMultiplier);
        const family =
          textFont === 'serif'
            ? 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif'
            : textFont === 'mono'
            ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
            : 'system-ui, -apple-system, sans-serif';
        const weight = textFont === 'bold' ? '900' : '700';
        ctx.font = `${weight} ${fontSize}px ${family}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const maxWidth = width * 0.85;
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';
        
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) lines.push(currentLine);
        
        const lineHeight = fontSize * 1.3;
        const totalTextHeight = lines.length * lineHeight;
        
        let startY: number;
        switch (position) {
          case 'top':
            startY = height * 0.12;
            break;
          case 'center':
            startY = (height - totalTextHeight) / 2 + lineHeight / 2;
            break;
          case 'bottom':
            startY = height * 0.85 - totalTextHeight + lineHeight;
            break;
        }

        let yOffset = 0;
        let finalOpacity = textOpacity;
        
        if (animation === 'slide-up' && animationProgress !== undefined) {
          yOffset = (1 - animationProgress) * 50;
          finalOpacity = textOpacity * animationProgress;
        } else if (animation === 'fade-in' && animationProgress !== undefined) {
          finalOpacity = textOpacity * animationProgress;
        }
        
        ctx.globalAlpha = finalOpacity;

        const padding = fontSize * 0.6;
        const bgHeight = totalTextHeight + padding * 2;
        const bgY = startY - lineHeight / 2 - padding + yOffset;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.beginPath();
        const radius = fontSize * 0.4;
        const bgX = width * 0.05;
        const bgWidth = width * 0.9;
        ctx.roundRect(bgX, bgY, bgWidth, bgHeight, radius);
        ctx.fill();
        
        ctx.fillStyle = textColor || '#ffffff';
        if (textShadow !== false) {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
        } else {
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }
        
        lines.forEach((line, i) => {
          ctx.fillText(line, width / 2, startY + i * lineHeight);
        });
        
        ctx.restore();
      };

      let currentFrame = 0;

      // Playback state for video clips
      let activeVideoIndex: number | null = null;
      
      await new Promise<void>((resolve) => {
        const renderFrame = () => {
          const currentTimeSec = currentFrame / fps;
          
          let accumulatedTime = 0;
          let currentSlideIndex = 0;
          for (let i = 0; i < slides.length; i++) {
            if (currentTimeSec < accumulatedTime + slides[i].durationSec) {
              currentSlideIndex = i;
              break;
            }
            accumulatedTime += slides[i].durationSec;
            if (i === slides.length - 1) {
              currentSlideIndex = i;
            }
          }
          
          const slideStartTime = accumulatedTime;
          const slide = slides[currentSlideIndex];
          const timeInSlide = currentTimeSec - slideStartTime;
          const slideProgress = Math.min(timeInSlide / slide.durationSec, 1);

          // Clip audio/playing management
          const currentMediaType = slide.mediaType || (slide.videoFile ? 'video' : 'image');
          if (currentMediaType === 'video' && loadedVideos[currentSlideIndex]) {
            if (activeVideoIndex !== currentSlideIndex) {
              // Disable previous clip audio + pause
              if (activeVideoIndex !== null) {
                const prevV = loadedVideos[activeVideoIndex];
                const prevGain = clipGainNodes[activeVideoIndex];
                if (prevGain) prevGain.gain.value = 0;
                if (prevV) {
                  try { prevV.pause(); } catch (_) {}
                }
              }

              // Activate new clip
              activeVideoIndex = currentSlideIndex;
              const v = loadedVideos[currentSlideIndex] as HTMLVideoElement;
              const gain = clipGainNodes[currentSlideIndex];
              if (gain) {
                const vol = slide.clipMuted ? 0 : (typeof slide.clipVolume === 'number' ? slide.clipVolume : 1);
                gain.gain.value = Math.max(0, Math.min(1, vol));
              }
              try {
                v.currentTime = 0;
              } catch (_) {}
              v.play().catch(() => {});
            } else {
              // Keep volume updated
              const gain = clipGainNodes[currentSlideIndex];
              if (gain) {
                const vol = slide.clipMuted ? 0 : (typeof slide.clipVolume === 'number' ? slide.clipVolume : 1);
                gain.gain.value = Math.max(0, Math.min(1, vol));
              }
            }
          } else {
            // Not a video slide: stop any playing clip and silence all clip audio
            if (activeVideoIndex !== null) {
              const prevV = loadedVideos[activeVideoIndex];
              const prevGain = clipGainNodes[activeVideoIndex];
              if (prevGain) prevGain.gain.value = 0;
              if (prevV) {
                try { prevV.pause(); } catch (_) {}
              }
              activeVideoIndex = null;
            }
          }
          
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, width, height);
          
          const transitionDurationSec = transitionDuration;
          const isInTransitionOut = timeInSlide > (slide.durationSec - transitionDurationSec) && currentSlideIndex < slides.length - 1;
          const isInTransitionIn = timeInSlide < transitionDurationSec && currentSlideIndex > 0;
          
          const textAnimProgress = Math.min(timeInSlide / 0.5, 1);
          
          if (isInTransitionOut) {
            const transitionProgress = (timeInSlide - (slide.durationSec - transitionDurationSec)) / transitionDurationSec;
            const easedProgress = easeOutQuad(transitionProgress);
            
            applyFilters(slide.filters);
            ctx.globalAlpha = 1 - easedProgress;
            if (currentMediaType === 'video' && loadedVideos[currentSlideIndex]) {
              ctx.drawImage(loadedVideos[currentSlideIndex] as HTMLVideoElement, 0, 0, width, height);
            } else {
              drawImageWithKenBurns(loadedImages[currentSlideIndex] as HTMLImageElement, slideProgress, kenBurnsPerSlide[currentSlideIndex]);
            }
            resetFilters();
            
            if (currentSlideIndex + 1 < slides.length) {
              const nextSlide = slides[currentSlideIndex + 1];
              const nextType = nextSlide.mediaType || (nextSlide.videoFile ? 'video' : 'image');
              applyFilters(nextSlide.filters);
              ctx.globalAlpha = easedProgress;
              if (nextType === 'video' && loadedVideos[currentSlideIndex + 1]) {
                ctx.drawImage(loadedVideos[currentSlideIndex + 1] as HTMLVideoElement, 0, 0, width, height);
              } else {
                drawImageWithKenBurns(loadedImages[currentSlideIndex + 1] as HTMLImageElement, 0, kenBurnsPerSlide[currentSlideIndex + 1]);
              }
              resetFilters();
            }
            
            ctx.globalAlpha = 1;
            
            if (slide.text) {
              const textOpacity = 1 - easedProgress;
              drawText(slide.text, slide.textPosition || 'bottom', textOpacity, slide.textColor, slide.textSize, slide.textAnimation, 1, slide.textFont, slide.textShadow);
            }
          } else if (isInTransitionIn) {
            applyFilters(slide.filters);
            ctx.globalAlpha = 1;
            if (currentMediaType === 'video' && loadedVideos[currentSlideIndex]) {
              ctx.drawImage(loadedVideos[currentSlideIndex] as HTMLVideoElement, 0, 0, width, height);
            } else {
              drawImageWithKenBurns(loadedImages[currentSlideIndex] as HTMLImageElement, slideProgress, kenBurnsPerSlide[currentSlideIndex]);
            }
            resetFilters();
            
            const transitionProgress = timeInSlide / transitionDurationSec;
            const textOpacity = easeOutQuad(transitionProgress);
            
            if (slide.text) {
              drawText(slide.text, slide.textPosition || 'bottom', textOpacity, slide.textColor, slide.textSize, slide.textAnimation, textAnimProgress, slide.textFont, slide.textShadow);
            }
          } else {
            applyFilters(slide.filters);
            ctx.globalAlpha = 1;
            if (currentMediaType === 'video' && loadedVideos[currentSlideIndex]) {
              ctx.drawImage(loadedVideos[currentSlideIndex] as HTMLVideoElement, 0, 0, width, height);
            } else {
              drawImageWithKenBurns(loadedImages[currentSlideIndex] as HTMLImageElement, slideProgress, kenBurnsPerSlide[currentSlideIndex]);
            }
            resetFilters();
            
            if (slide.text) {
              drawText(slide.text, slide.textPosition || 'bottom', 1, slide.textColor, slide.textSize, slide.textAnimation, textAnimProgress, slide.textFont, slide.textShadow);
            }
          }

          currentFrame++;
          const progressPercent = 25 + (currentFrame / totalFrames) * 65;
          setProgress(Math.min(progressPercent, 92));
          
          if (currentFrame % 15 === 0) {
            setStatus(`Creating video... ${Math.round((currentFrame / totalFrames) * 100)}%`);
          }

          if (currentFrame < totalFrames) {
            setTimeout(renderFrame, frameDurationMs);
          } else {
            resolve();
          }
        };

        renderFrame();
      });

      setStatus('Finishing up...');
      setProgress(94);

      if (audioElement) {
        audioElement.pause();
      }

      // Stop any playing clip
      if (activeVideoIndex !== null) {
        const v = loadedVideos[activeVideoIndex];
        if (v) {
          try { v.pause(); } catch (_) {}
        }
      }

      await new Promise<void>((resolve) => {
        let settled = false;
        const timeout = window.setTimeout(() => {
          if (!settled) {
            settled = true;
            resolve();
          }
        }, 10000);

        mediaRecorder.onstop = () => {
          if (!settled) {
            settled = true;
            window.clearTimeout(timeout);
            resolve();
          }
        };

        try {
          mediaRecorder.requestData();
        } catch (_) {
          // ignore
        }

        mediaRecorder.stop();
      });

      let videoBlob = new Blob(chunks, { type: mimeType });
      
      mediaObjectUrls.forEach((u) => {
        try { URL.revokeObjectURL(u); } catch (_) {}
      });
      stream.getTracks().forEach(track => track.stop());
      if (audioContext) {
        try { audioContext.close(); } catch (_) {}
      }

      // Convert WebM to MP4 for Safari compatibility (desktop Safari only - iOS FFmpeg doesn't work)
      const userAgent = navigator.userAgent || '';
      const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
      const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(userAgent);
      const isWebM = mimeType.includes('webm');
      
      // Only attempt conversion on desktop Safari, not iOS
      if (isSafariBrowser && !isIOSDevice && isWebM) {
        setProgress(85);
        setStatus('Converting to MP4...');
        videoBlob = await convertWebmToMp4(videoBlob);
      }

      setProgress(100);
      setStatus('Your video is ready!');
      setIsLoading(false);

      return videoBlob;

    } catch (e: any) {
      console.error('[useCanvasVideo] Generation failed:', e);
      const msg = String(e?.message || 'Video generation failed');
      if (msg === 'AUDIO_MIX_FAILED') {
        setError('Audio could not be added to the video. Please try again or choose a different audio file.');
      } else {
        setError(msg);
      }
      return null;
    } finally {
      setIsLoading(false);
      setStatus('');
    }
  }, [convertWebmToMp4]);

  return {
    generateVideo,
    progress,
    status,
    error,
    isLoading,
    isReady: true,
  };
}
