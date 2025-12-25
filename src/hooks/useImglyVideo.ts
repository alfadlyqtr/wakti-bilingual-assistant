import { useState, useRef, useCallback } from 'react';
import CreativeEngine from '@cesdk/engine';

const IMGLY_LICENSE_KEY = import.meta.env.VITE_IMGLY_LICENSE_KEY || '';
const CESDK_BASE_URL = '/cesdk-assets';

interface VideoGenerationOptions {
  images: File[];
  audioFile?: File | null;
  audioUrl?: string | null;
  durationPerImage?: number;
  width?: number;
  height?: number;
  textOverlays?: Array<{
    text: string;
    position: 'top' | 'center' | 'bottom';
    fontSize?: number;
  }>;
}

interface UseImglyVideoReturn {
  generateVideo: (options: VideoGenerationOptions) => Promise<Blob | null>;
  progress: number;
  status: string;
  error: string | null;
  isLoading: boolean;
  isReady: boolean;
}

export function useImglyVideo(): UseImglyVideoReturn {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady] = useState(true);
  const engineRef = useRef<CreativeEngine | null>(null);

  const generateVideo = useCallback(async (options: VideoGenerationOptions): Promise<Blob | null> => {
    const {
      images,
      audioFile,
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
      setStatus('Setting up video tools...');
      setProgress(5);

      const engine = await CreativeEngine.init({
        license: IMGLY_LICENSE_KEY,
        baseURL: CESDK_BASE_URL,
      });
      engineRef.current = engine;

      setStatus('Getting things ready...');
      setProgress(10);

      const scene = engine.scene.createVideo();
      const page = engine.block.create('page');
      engine.block.appendChild(scene, page);

      engine.block.setWidth(page, width);
      engine.block.setHeight(page, height);

      const videoTrack = engine.block.create('track');
      engine.block.appendChild(page, videoTrack);
      engine.block.fillParent(videoTrack);

      setStatus('Adding your photos...');
      const totalImages = images.length;
      let currentImageIndex = 0;

      for (const imageFile of images) {
        currentImageIndex++;
        const imageProgress = 10 + (currentImageIndex / totalImages) * 40;
        setProgress(imageProgress);
        setStatus(`Adding photo ${currentImageIndex} of ${totalImages}...`);

        const imageUrl = URL.createObjectURL(imageFile);

        try {
          const graphic = engine.block.create('graphic');
          engine.block.setShape(graphic, engine.block.createShape('rect'));
          
          const fill = engine.block.createFill('image');
          engine.block.setString(fill, 'fill/image/imageFileURI', imageUrl);
          engine.block.setFill(graphic, fill);

          engine.block.setWidth(graphic, width);
          engine.block.setHeight(graphic, height);
          engine.block.setPositionX(graphic, 0);
          engine.block.setPositionY(graphic, 0);

          engine.block.setDuration(graphic, durationPerImage);

          const startTime = (currentImageIndex - 1) * durationPerImage;
          engine.block.setTimeOffset(graphic, startTime);

          engine.block.appendChild(videoTrack, graphic);
        } finally {
          URL.revokeObjectURL(imageUrl);
        }
      }

      const totalDuration = images.length * durationPerImage;
      engine.block.setDuration(page, totalDuration);

      if (audioFile || audioUrl) {
        setStatus('Adding music...');
        setProgress(55);

        try {
          const audioTrack = engine.block.create('track');
          engine.block.appendChild(page, audioTrack);

          const audio = engine.block.create('audio');
          
          let audioUri: string;
          if (audioFile) {
            audioUri = URL.createObjectURL(audioFile);
          } else {
            audioUri = audioUrl!;
          }

          await engine.block.setString(audio, 'audio/fileURI', audioUri);
          engine.block.setDuration(audio, totalDuration);
          engine.block.setTimeOffset(audio, 0);
          engine.block.appendChild(audioTrack, audio);

          if (audioFile) {
            URL.revokeObjectURL(audioUri);
          }
        } catch (audioError) {
          console.warn('Audio track failed, continuing without audio:', audioError);
        }
      }

      setStatus('Creating your video...');
      setProgress(60);

      const progressCallback = (renderedFrames: number, encodedFrames: number, totalFrames: number) => {
        const renderProgress = 60 + (encodedFrames / totalFrames) * 35;
        setProgress(Math.min(renderProgress, 95));
        setStatus(`Almost there... ${Math.round((encodedFrames / totalFrames) * 100)}%`);
      };

      const videoBlob = await engine.block.exportVideo(
        page,
        'video/mp4',
        progressCallback,
        {}
      );

      setProgress(100);
      setStatus('Your video is ready!');

      engine.dispose();
      engineRef.current = null;

      setIsLoading(false);
      return videoBlob;

    } catch (err) {
      console.error('Video generation error:', err);
      const errorMessage = 'Something went wrong. Please try again.';
      setError(errorMessage);
      setStatus('');
      setIsLoading(false);

      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }

      return null;
    }
  }, []);

  return {
    generateVideo,
    progress,
    status,
    error,
    isLoading,
    isReady,
  };
}
