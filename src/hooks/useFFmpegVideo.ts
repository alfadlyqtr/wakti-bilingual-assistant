import { useState, useCallback, useRef } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

interface Slide {
  id: string;
  imageUrl: string;
  imageFile?: File;
  text: string;
  textPosition: 'top' | 'center' | 'bottom';
  textColor: string;
  durationSec: number;
}

interface TemplateStyle {
  bgGradient: string;
  textColor: string;
  accentColor: string;
}

interface GenerateVideoOptions {
  slides: Slide[];
  audioUrl?: string;
  template: TemplateStyle;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  onProgress?: (progress: number, status: string) => void;
}

interface UseFFmpegVideoReturn {
  isLoading: boolean;
  isReady: boolean;
  progress: number;
  status: string;
  error: string | null;
  loadFFmpeg: () => Promise<boolean>;
  generateVideo: (options: GenerateVideoOptions) => Promise<Blob | null>;
}

const CORE_BASE_URL = '/ffmpeg';

async function toBlobURLWithProgress(
  url: string,
  mimeType: string,
  onProgress?: (loadedBytes: number, totalBytes: number | null) => void,
): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} (${res.status})`);
  }

  const totalHeader = res.headers.get('content-length');
  const total = totalHeader ? Number(totalHeader) : null;

  if (!res.body) {
    const blob = await res.blob();
    onProgress?.(blob.size, total);
    return URL.createObjectURL(new Blob([blob], { type: mimeType }));
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      const chunk = new Uint8Array(value);
      chunks.push(chunk);
      loaded += chunk.byteLength;
      onProgress?.(loaded, total);
    }
  }

  const blob = new Blob(chunks as unknown as BlobPart[], { type: mimeType });
  onProgress?.(loaded, total);
  return URL.createObjectURL(blob);
}

export function useFFmpegVideo(): UseFFmpegVideoReturn {
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadFFmpeg = useCallback(async (): Promise<boolean> => {
    if (ffmpegRef.current && isReady) return true;

    setIsLoading(true);
    setError(null);
    setProgress(0);
    setStatus('Loading video tools...');

    try {
      const ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;

      ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message);
      });

      ffmpeg.on('progress', ({ progress: p }) => {
        setProgress(Math.round(p * 100));
      });

      const coreJsUrl = `${CORE_BASE_URL}/ffmpeg-core.js`;
      const coreWasmUrl = `${CORE_BASE_URL}/ffmpeg-core.wasm`;

      const weights = {
        core: 1,
        wasm: 28,
      };
      const totalWeight = weights.core + weights.wasm;
      const perFile: Record<string, { loaded: number; total: number | null }> = {
        core: { loaded: 0, total: null },
        wasm: { loaded: 0, total: null },
      };

      const computePercent = () => {
        const items = Object.entries(perFile);
        let sum = 0;

        for (const [key, v] of items) {
          const w = (weights as any)[key] as number;
          const denom = v.total && v.total > 0 ? v.total : null;
          const ratio = denom ? Math.min(1, v.loaded / denom) : 0;
          sum += w * ratio;
        }

        const pct = Math.round((sum / totalWeight) * 100);
        return Math.max(0, Math.min(100, pct));
      };

      setStatus('Loading video tools... (one-time ~30MB)');

      const [coreURL, wasmURL] = await Promise.all([
        toBlobURLWithProgress(coreJsUrl, 'text/javascript', (loaded, total) => {
          perFile.core = { loaded, total };
          setProgress(computePercent());
        }),
        toBlobURLWithProgress(coreWasmUrl, 'application/wasm', (loaded, total) => {
          perFile.wasm = { loaded, total };
          setProgress(computePercent());
        }),
      ]);

      // UMD build doesn't have a separate worker file - FFmpeg handles it internally
      await ffmpeg.load({ coreURL, wasmURL });

      setIsReady(true);
      setStatus('Video engine ready');
      return true;
    } catch (e) {
      console.error('Failed to load FFmpeg:', e);
      setError(
        'Video tools failed to load. Please refresh and try again.'
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isReady]);

  const generateVideo = useCallback(async (options: GenerateVideoOptions): Promise<Blob | null> => {
    const { slides, audioUrl, template, aspectRatio = '9:16', onProgress } = options;

    if (!ffmpegRef.current || !isReady) {
      const loaded = await loadFFmpeg();
      if (!loaded) return null;
    }

    const ffmpeg = ffmpegRef.current!;
    setError(null);
    setProgress(0);

    try {
      // Determine dimensions based on aspect ratio
      const dimensions = {
        '9:16': { width: 1080, height: 1920 },
        '16:9': { width: 1920, height: 1080 },
        '1:1': { width: 1080, height: 1080 }
      }[aspectRatio];

      const { width, height } = dimensions;

      // Step 1: Write images to FFmpeg filesystem
      setStatus('Processing images...');
      onProgress?.(10, 'Processing images...');

      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        let imageData: Uint8Array;

        if (slide.imageFile) {
          imageData = await fetchFile(slide.imageFile);
        } else {
          // Fetch from URL
          const response = await fetch(slide.imageUrl);
          const blob = await response.blob();
          imageData = await fetchFile(blob);
        }

        await ffmpeg.writeFile(`input_${i}.jpg`, imageData);
        onProgress?.(10 + (i / slides.length) * 20, `Processing image ${i + 1}/${slides.length}...`);
      }

      // Step 2: Write audio if provided
      if (audioUrl) {
        setStatus('Processing audio...');
        onProgress?.(35, 'Processing audio...');
        
        const audioResponse = await fetch(audioUrl);
        const audioBlob = await audioResponse.blob();
        const audioData = await fetchFile(audioBlob);
        await ffmpeg.writeFile('audio.mp3', audioData);
      }

      // Step 3: Create concat file for images with durations
      setStatus('Creating video sequence...');
      onProgress?.(40, 'Creating video sequence...');

      // Build filter complex for crossfade transitions
      const totalDuration = slides.reduce((sum, s) => sum + s.durationSec, 0);
      const fadeDuration = 0.5; // 0.5 second fade between slides

      // Create input file list
      let concatContent = '';
      slides.forEach((slide, i) => {
        concatContent += `file 'input_${i}.jpg'\n`;
        concatContent += `duration ${slide.durationSec}\n`;
      });
      // Add last file again (required by concat demuxer)
      concatContent += `file 'input_${slides.length - 1}.jpg'\n`;

      await ffmpeg.writeFile('concat.txt', concatContent);

      // Step 4: Generate video with FFmpeg
      setStatus('Generating video...');
      onProgress?.(50, 'Generating video...');

      // Build FFmpeg command
      const ffmpegArgs: string[] = [
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat.txt',
        '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
      ];

      // Add audio if provided
      if (audioUrl) {
        ffmpegArgs.push(
          '-i', 'audio.mp3',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-shortest'
        );
      } else {
        // No audio - just video
        ffmpegArgs.push('-an');
      }

      ffmpegArgs.push(
        '-movflags', '+faststart',
        '-y',
        'output.mp4'
      );

      await ffmpeg.exec(ffmpegArgs);

      onProgress?.(90, 'Finalizing...');

      // Step 5: Read output file
      setStatus('Finalizing...');
      const outputData = await ffmpeg.readFile('output.mp4');
      
      // Clean up files
      for (let i = 0; i < slides.length; i++) {
        await ffmpeg.deleteFile(`input_${i}.jpg`).catch(() => {});
      }
      await ffmpeg.deleteFile('concat.txt').catch(() => {});
      await ffmpeg.deleteFile('output.mp4').catch(() => {});
      if (audioUrl) {
        await ffmpeg.deleteFile('audio.mp3').catch(() => {});
      }

      onProgress?.(100, 'Complete!');
      setProgress(100);
      setStatus('Complete!');

      // Return as Blob - handle FFmpeg FileData type
      let blobPart: BlobPart;
      if (outputData instanceof Uint8Array) {
        blobPart = new Uint8Array(outputData);
      } else if (typeof outputData === 'string') {
        blobPart = outputData;
      } else {
        blobPart = new Uint8Array(outputData as ArrayBuffer);
      }
      return new Blob([blobPart], { type: 'video/mp4' });

    } catch (e) {
      console.error('Video generation failed:', e);
      setError(e instanceof Error ? e.message : 'Video generation failed');
      return null;
    }
  }, [isReady, loadFFmpeg]);

  return {
    isLoading,
    isReady,
    progress,
    status,
    error,
    loadFFmpeg,
    generateVideo
  };
}
