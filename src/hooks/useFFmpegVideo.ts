import { useState, useCallback, useRef } from 'react';

// ── FFmpeg.wasm Cinema Stitcher ──────────────────────────────────────────────
// Uses @ffmpeg/ffmpeg v0.12 in single-thread mode (no SharedArrayBuffer needed,
// so it works even when COOP/COEP headers are absent).
// Concatenates remote video clip URLs into one MP4 blob in the browser.

export interface StitchOptions {
  clipUrls: string[];                          // ordered remote MP4 URLs
  onProgress?: (pct: number, msg: string) => void;
}

export interface UseFFmpegStitchReturn {
  isLoading: boolean;
  isReady: boolean;
  progress: number;
  status: string;
  error: string | null;
  loadFFmpeg: () => Promise<boolean>;
  stitchClips: (opts: StitchOptions) => Promise<Blob | null>;
}

const CORE_BASE_URL = '/ffmpeg';

// Fetch a remote URL (possibly cross-origin) and return as a Uint8Array
async function fetchAsBytes(url: string, onProgress?: (pct: number) => void): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);

  const contentLength = res.headers.get('content-length');
  const total = contentLength ? Number(contentLength) : null;

  if (!res.body || !total) {
    const buf = await res.arrayBuffer();
    onProgress?.(100);
    return new Uint8Array(buf);
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.byteLength;
      onProgress?.(Math.round((loaded / total) * 100));
    }
  }

  const merged = new Uint8Array(loaded);
  let offset = 0;
  for (const c of chunks) { merged.set(c, offset); offset += c.byteLength; }
  return merged;
}

export function useFFmpegVideo(): UseFFmpegStitchReturn {
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
    setStatus('Loading video engine...');

    try {
      // Dynamic import so FFmpeg only loads when actually needed
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { toBlobURL } = await import('@ffmpeg/util');

      const ffmpeg = new FFmpeg();

      // Log FFmpeg output for debugging
      ffmpeg.on('log', ({ message }: { message: string }) => {
        console.log('[ffmpeg]', message);
      });

      ffmpeg.on('progress', ({ progress: p }: { progress: number }) => {
        const pct = Math.round(p * 100);
        setProgress(20 + Math.round(pct * 0.7)); // 20-90 range during encode
      });

      setStatus('Loading FFmpeg core (30MB)...');
      setProgress(5);

      // Load single-thread core from /public/ffmpeg (no SharedArrayBuffer needed)
      const coreJsUrl = await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript');
      setProgress(15);
      const coreWasmUrl = await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm');
      setProgress(20);

      await ffmpeg.load({
        coreURL: coreJsUrl,
        wasmURL: coreWasmUrl,
      });

      ffmpegRef.current = ffmpeg;
      setIsReady(true);
      setProgress(0);
      setStatus('');
      return true;
    } catch (err: any) {
      console.error('[useFFmpegVideo] load error:', err);
      setError('Failed to load video engine: ' + (err?.message || 'unknown'));
      setIsReady(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isReady]);

  const stitchClips = useCallback(async (opts: StitchOptions): Promise<Blob | null> => {
    const { clipUrls, onProgress } = opts;

    if (!clipUrls.length) {
      setError('No clips to stitch');
      return null;
    }

    setIsLoading(true);
    setError(null);
    setProgress(0);
    setStatus('Preparing to stitch...');

    try {
      // Load FFmpeg if not already loaded
      const ready = await loadFFmpeg();
      if (!ready || !ffmpegRef.current) throw new Error('FFmpeg failed to load');

      const ffmpeg = ffmpegRef.current;

      // ── Step 1: Fetch each clip and write to FFmpeg virtual FS ──
      const inputFiles: string[] = [];
      for (let i = 0; i < clipUrls.length; i++) {
        const pct = Math.round((i / clipUrls.length) * 40);
        setProgress(pct);
        const msg = `Downloading clip ${i + 1}/${clipUrls.length}...`;
        setStatus(msg);
        onProgress?.(pct, msg);

        const bytes = await fetchAsBytes(clipUrls[i], (dlPct) => {
          const overall = Math.round(((i + dlPct / 100) / clipUrls.length) * 40);
          setProgress(overall);
          onProgress?.(overall, msg);
        });

        const fname = `clip${i}.mp4`;
        await ffmpeg.writeFile(fname, bytes);
        inputFiles.push(fname);
      }

      // ── Step 2: Build concat list file ──
      const concatList = inputFiles.map(f => `file '${f}'`).join('\n');
      const concatBytes = new TextEncoder().encode(concatList);
      await ffmpeg.writeFile('concat.txt', concatBytes);

      // ── Step 3: Run FFmpeg concat demuxer (fast, no re-encode) ──
      setStatus('Stitching clips...');
      setProgress(45);
      onProgress?.(45, 'Stitching clips...');

      await ffmpeg.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat.txt',
        '-c', 'copy',          // stream copy — no re-encode, very fast
        '-movflags', '+faststart',
        'output.mp4',
      ]);

      // ── Step 4: Read output ──
      setStatus('Finalizing...');
      setProgress(92);
      onProgress?.(92, 'Finalizing...');

      const data = await ffmpeg.readFile('output.mp4');
      const blob = new Blob([data], { type: 'video/mp4' });

      // Cleanup virtual FS
      for (const f of inputFiles) {
        try { await ffmpeg.deleteFile(f); } catch (_) {}
      }
      try { await ffmpeg.deleteFile('concat.txt'); } catch (_) {}
      try { await ffmpeg.deleteFile('output.mp4'); } catch (_) {}

      setProgress(100);
      setStatus('');
      onProgress?.(100, 'Done!');
      return blob;

    } catch (err: any) {
      console.error('[useFFmpegVideo] stitch error:', err);
      const msg = err?.message || 'Stitch failed';
      setError(msg);
      onProgress?.(0, 'Error: ' + msg);
      return null;
    } finally {
      setIsLoading(false);
      setProgress(0);
      setStatus('');
    }
  }, [loadFFmpeg]);

  return {
    isLoading,
    isReady,
    progress,
    status,
    error,
    loadFFmpeg,
    stitchClips,
  };
}
