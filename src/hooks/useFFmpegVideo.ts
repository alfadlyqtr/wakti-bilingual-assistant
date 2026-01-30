import { useState, useCallback, useRef } from 'react';

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
  const ffmpegRef = useRef<any>(null);
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
      const coreJsUrl = `${CORE_BASE_URL}/ffmpeg-core.js`;
      const coreWasmUrl = `${CORE_BASE_URL}/ffmpeg-core.wasm`;
      void coreJsUrl;
      void coreWasmUrl;

      setIsReady(false);
      setStatus('Video engine unavailable');
      setError('Video tools are disabled for now.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isReady]);

  const generateVideo = useCallback(async (options: GenerateVideoOptions): Promise<Blob | null> => {
    const { onProgress } = options;

    setError('Video tools are disabled for now.');
    setProgress(0);
    setStatus('Video engine unavailable');
    onProgress?.(0, 'Video engine unavailable');
    return null;
  }, []);

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
