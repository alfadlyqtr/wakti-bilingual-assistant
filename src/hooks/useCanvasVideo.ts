import { useState, useCallback } from 'react';

type TransitionType = 'fade' | 'slide-left' | 'slide-right' | 'zoom-in' | 'zoom-out' | 'none';
type TextAnimation = 'none' | 'fade-in' | 'slide-up' | 'typewriter';

interface SlideFilters {
  brightness: number;
  contrast: number;
  saturation: number;
}

interface SlideConfig {
  imageFile: File;
  text?: string;
  textPosition?: 'top' | 'center' | 'bottom';
  textColor?: string;
  textSize?: 'small' | 'medium' | 'large';
  textAnimation?: TextAnimation;
  durationSec: number;
  transition?: TransitionType;
  filters?: SlideFilters;
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

export function useCanvasVideo(): UseCanvasVideoReturn {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

      setStatus('Loading your photos...');
      setProgress(5);
      
      const loadedImages: HTMLImageElement[] = [];
      for (let i = 0; i < slides.length; i++) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`Failed to load image ${i + 1}`));
          img.src = URL.createObjectURL(slides[i].imageFile);
        });
        
        loadedImages.push(img);
        setProgress(5 + (i / slides.length) * 15);
        setStatus(`Loading photo ${i + 1} of ${slides.length}...`);
      }

      setStatus('Creating your video...');
      setProgress(25);

      const stream = canvas.captureStream(30);
      
      let audioElement: HTMLAudioElement | null = null;
      let audioContext: AudioContext | null = null;
      if (audioUrl) {
        try {
          audioElement = new Audio(audioUrl);
          audioElement.crossOrigin = 'anonymous';
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
            audioElement!.oncanplaythrough = () => resolve();
            audioElement!.onerror = () => reject();
            audioElement!.load();
          });
          
          audioContext = new AudioContext();
          if (audioContext.state !== 'running') {
            await audioContext.resume();
          }
          const source = audioContext.createMediaElementSource(audioElement);
          const destination = audioContext.createMediaStreamDestination();
          source.connect(destination);
          source.connect(audioContext.destination);
          
          destination.stream.getAudioTracks().forEach(track => {
            stream.addTrack(track);
          });
        } catch (audioErr) {
          console.warn('Audio loading failed, continuing without audio:', audioErr);
        }
      }

      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/mp4';
      }

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
      
      const kenBurnsPerSlide: KenBurnsDirection[] = slides.map((_, i) => 
        KEN_BURNS_DIRECTIONS[i % KEN_BURNS_DIRECTIONS.length]
      );

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
        ctx.filter = `brightness(${b}) contrast(${c}) saturate(${s})`;
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
        animationProgress?: number
      ) => {
        if (!text || text.trim() === '') return;
        
        ctx.save();
        
        const sizeMultiplier = textSize === 'small' ? 0.04 : textSize === 'large' ? 0.07 : 0.055;
        const fontSize = Math.floor(width * sizeMultiplier);
        ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
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
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        lines.forEach((line, i) => {
          ctx.fillText(line, width / 2, startY + i * lineHeight);
        });
        
        ctx.restore();
      };

      let currentFrame = 0;
      
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
            drawImageWithKenBurns(loadedImages[currentSlideIndex], slideProgress, kenBurnsPerSlide[currentSlideIndex]);
            resetFilters();
            
            if (currentSlideIndex + 1 < loadedImages.length) {
              const nextSlide = slides[currentSlideIndex + 1];
              applyFilters(nextSlide.filters);
              ctx.globalAlpha = easedProgress;
              drawImageWithKenBurns(loadedImages[currentSlideIndex + 1], 0, kenBurnsPerSlide[currentSlideIndex + 1]);
              resetFilters();
            }
            
            ctx.globalAlpha = 1;
            
            if (slide.text) {
              const textOpacity = 1 - easedProgress;
              drawText(slide.text, slide.textPosition || 'bottom', textOpacity, slide.textColor, slide.textSize, slide.textAnimation, 1);
            }
          } else if (isInTransitionIn) {
            applyFilters(slide.filters);
            ctx.globalAlpha = 1;
            drawImageWithKenBurns(loadedImages[currentSlideIndex], slideProgress, kenBurnsPerSlide[currentSlideIndex]);
            resetFilters();
            
            const transitionProgress = timeInSlide / transitionDurationSec;
            const textOpacity = easeOutQuad(transitionProgress);
            
            if (slide.text) {
              drawText(slide.text, slide.textPosition || 'bottom', textOpacity, slide.textColor, slide.textSize, slide.textAnimation, textAnimProgress);
            }
          } else {
            applyFilters(slide.filters);
            ctx.globalAlpha = 1;
            drawImageWithKenBurns(loadedImages[currentSlideIndex], slideProgress, kenBurnsPerSlide[currentSlideIndex]);
            resetFilters();
            
            if (slide.text) {
              drawText(slide.text, slide.textPosition || 'bottom', 1, slide.textColor, slide.textSize, slide.textAnimation, textAnimProgress);
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

      await new Promise<void>((resolve) => {
        mediaRecorder.onstop = () => resolve();
        mediaRecorder.stop();
      });

      const videoBlob = new Blob(chunks, { type: mimeType });
      
      loadedImages.forEach(img => URL.revokeObjectURL(img.src));
      stream.getTracks().forEach(track => track.stop());
      if (audioContext) {
        try { audioContext.close(); } catch (_) {}
      }

      setProgress(100);
      setStatus('Your video is ready!');
      setIsLoading(false);

      return videoBlob;

    } catch (err) {
      console.error('Video generation error:', err);
      setError('Something went wrong. Please try again.');
      setStatus('');
      setIsLoading(false);
      return null;
    }
  }, []);

  return {
    generateVideo,
    progress,
    status,
    error,
    isLoading,
    isReady: true,
  };
}
