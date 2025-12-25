import { useState, useCallback } from 'react';

interface VideoGenerationOptions {
  images: File[];
  audioFile?: File | null;
  audioUrl?: string | null;
  durationPerImage?: number;
  width?: number;
  height?: number;
}

interface UseCanvasVideoReturn {
  generateVideo: (options: VideoGenerationOptions) => Promise<Blob | null>;
  progress: number;
  status: string;
  error: string | null;
  isLoading: boolean;
  isReady: boolean;
}

export function useCanvasVideo(): UseCanvasVideoReturn {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generateVideo = useCallback(async (options: VideoGenerationOptions): Promise<Blob | null> => {
    const {
      images,
      audioUrl,
      durationPerImage = 3,
      width = 1080,
      height = 1920,
    } = options;

    if (!images || images.length === 0) {
      setError('No images provided');
      return null;
    }

    setIsLoading(true);
    setError(null);
    setProgress(0);
    setStatus('Preparing your video...');

    try {
      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Canvas not supported');
      }

      // Load all images first
      setStatus('Loading your photos...');
      setProgress(10);
      
      const loadedImages: HTMLImageElement[] = [];
      for (let i = 0; i < images.length; i++) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`Failed to load image ${i + 1}`));
          img.src = URL.createObjectURL(images[i]);
        });
        
        loadedImages.push(img);
        setProgress(10 + (i / images.length) * 20);
        setStatus(`Loading photo ${i + 1} of ${images.length}...`);
      }

      setStatus('Creating your video...');
      setProgress(35);

      // Setup MediaRecorder
      const stream = canvas.captureStream(30); // 30 FPS
      
      // Add audio if provided
      let audioElement: HTMLAudioElement | null = null;
      if (audioUrl) {
        try {
          audioElement = new Audio(audioUrl);
          audioElement.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            audioElement!.oncanplaythrough = () => resolve();
            audioElement!.onerror = () => reject();
            audioElement!.load();
          });
          
          // Create audio context and connect to stream
          const audioContext = new AudioContext();
          const source = audioContext.createMediaElementSource(audioElement);
          const destination = audioContext.createMediaStreamDestination();
          source.connect(destination);
          source.connect(audioContext.destination);
          
          // Add audio track to stream
          destination.stream.getAudioTracks().forEach(track => {
            stream.addTrack(track);
          });
        } catch (audioErr) {
          console.warn('Audio loading failed, continuing without audio:', audioErr);
        }
      }

      // Determine best supported format
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
        videoBitsPerSecond: 5000000, // 5 Mbps
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms

      // Start audio if available
      if (audioElement) {
        audioElement.currentTime = 0;
        audioElement.play().catch(() => {});
      }

      const totalDuration = images.length * durationPerImage * 1000; // in ms
      const fps = 30;
      const frameDuration = 1000 / fps;
      const framesPerImage = (durationPerImage * 1000) / frameDuration;
      
      let currentFrame = 0;
      const totalFrames = images.length * framesPerImage;

      // Animation loop
      await new Promise<void>((resolve) => {
        const renderFrame = () => {
          const imageIndex = Math.min(
            Math.floor(currentFrame / framesPerImage),
            loadedImages.length - 1
          );
          const img = loadedImages[imageIndex];

          // Clear canvas
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, width, height);

          // Draw image with cover fit
          const imgRatio = img.width / img.height;
          const canvasRatio = width / height;
          
          let drawWidth, drawHeight, drawX, drawY;
          
          if (imgRatio > canvasRatio) {
            drawHeight = height;
            drawWidth = height * imgRatio;
            drawX = (width - drawWidth) / 2;
            drawY = 0;
          } else {
            drawWidth = width;
            drawHeight = width / imgRatio;
            drawX = 0;
            drawY = (height - drawHeight) / 2;
          }

          ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

          currentFrame++;
          const progressPercent = 35 + (currentFrame / totalFrames) * 55;
          setProgress(Math.min(progressPercent, 90));
          setStatus(`Creating video... ${Math.round((currentFrame / totalFrames) * 100)}%`);

          if (currentFrame < totalFrames) {
            setTimeout(renderFrame, frameDuration);
          } else {
            resolve();
          }
        };

        renderFrame();
      });

      // Stop recording
      setStatus('Finishing up...');
      setProgress(92);

      if (audioElement) {
        audioElement.pause();
      }

      await new Promise<void>((resolve) => {
        mediaRecorder.onstop = () => resolve();
        mediaRecorder.stop();
      });

      // Create final blob
      const videoBlob = new Blob(chunks, { type: mimeType });
      
      // Cleanup
      loadedImages.forEach(img => URL.revokeObjectURL(img.src));
      stream.getTracks().forEach(track => track.stop());

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
