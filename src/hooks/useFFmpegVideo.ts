import { useState, useCallback, useRef } from 'react';

// ── Wakti Cinema – Browser-side FFmpeg Stitcher ──────────────────────────────
// Bypasses @ffmpeg/ffmpeg entirely to avoid its Worker URL resolution bug in
// Vite production builds (import.meta.url resolves wrong → Worker 404 → 60s
// timeout). Instead we drive a plain classic Worker at /ffmpeg/wakti-ffmpeg-worker.js
// which uses importScripts() to load the UMD ffmpeg-core.js – works reliably
// on every browser / WebView without COOP/COEP headers.

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

// ─── Constants ───────────────────────────────────────────────────────────────
const WORKER_URL       = '/ffmpeg/wakti-ffmpeg-worker.js';
const CORE_JS_URL      = '/ffmpeg/ffmpeg-core.js';
const CORE_WASM_URL    = '/ffmpeg/ffmpeg-core.wasm';
const LOAD_TIMEOUT_MS  = 180_000;   // 3 min – 32 MB WASM + instantiation
const DL_TIMEOUT_MS    = 120_000;
const EXEC_TIMEOUT_MS  = 180_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([
    p,
    new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error(msg)), ms); }),
  ]).finally(() => clearTimeout(t));
}

async function fetchAsBytes(
  url: string,
  onProgress?: (pct: number) => void,
): Promise<Uint8Array> {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), DL_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
    const total = Number(res.headers.get('content-length') ?? 0);
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
      if (value) { chunks.push(value); loaded += value.byteLength; onProgress?.(Math.round((loaded / total) * 100)); }
    }
    const merged = new Uint8Array(loaded);
    let off = 0;
    for (const c of chunks) { merged.set(c, off); off += c.byteLength; }
    return merged;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error('A video clip took too long to download');
    throw err;
  } finally {
    clearTimeout(tid);
  }
}

// ─── WorkerProxy – thin wrapper around the classic Web Worker ────────────────
class WorkerProxy {
  private w: Worker;
  private resolves: Record<number, (v: unknown) => void> = {};
  private rejects:  Record<number, (e: Error) => void>   = {};
  private nextId = 0;
  onLog?:      (msg: string) => void;
  onProgress?: (pct: number) => void;

  constructor() {
    this.w = new Worker(WORKER_URL); // classic worker – no { type:"module" }
    this.w.onmessage = ({ data: { id, type, data } }) => {
      if (type === 'LOG')      { this.onLog?.(data?.message ?? String(data)); return; }
      if (type === 'PROGRESS') { this.onProgress?.(Math.round((data?.ratio ?? 0) * 100)); return; }
      if (type === 'ERROR')    { this.rejects[id]?.(new Error(String(data))); }
      else                     { this.resolves[id]?.(data); }
      delete this.resolves[id]; delete this.rejects[id];
    };
    this.w.onerror = (e) => {
      const err = new Error(e.message || 'Worker error');
      Object.values(this.rejects).forEach(r => r(err));
      this.resolves = {}; this.rejects = {};
    };
  }

  send(type: string, data: unknown, transfer: Transferable[] = []): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((res, rej) => {
      this.resolves[id] = res;
      this.rejects[id]  = rej;
      this.w.postMessage({ id, type, data }, transfer);
    });
  }

  terminate() { this.w.terminate(); }
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useFFmpegVideo(): UseFFmpegStitchReturn {
  const proxyRef        = useRef<WorkerProxy | null>(null);
  const loadPromiseRef  = useRef<Promise<boolean> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady,   setIsReady]   = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [status,    setStatus]    = useState('');
  const [error,     setError]     = useState<string | null>(null);

  const loadFFmpeg = useCallback(async (): Promise<boolean> => {
    if (proxyRef.current) return true;
    if (loadPromiseRef.current) return loadPromiseRef.current;

    const p = (async () => {
      setIsLoading(true); setError(null); setProgress(2);
      setStatus('Starting final film engine...');
      try {
        const proxy = new WorkerProxy();
        proxy.onLog      = (msg) => console.log('[ffmpeg]', msg);
        proxy.onProgress = (pct) => setProgress(20 + Math.round(pct * 0.7));

        setProgress(5); setStatus('Loading final film engine (one-time ~30 s)...');

        await withTimeout(
          proxy.send('LOAD', { coreURL: CORE_JS_URL, wasmURL: CORE_WASM_URL }),
          LOAD_TIMEOUT_MS,
          'Final film engine took too long to start',
        );

        proxyRef.current = proxy;
        setIsReady(true); setProgress(0); setStatus('');
        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'unknown';
        console.error('[useFFmpegVideo] load error:', err);
        setError('Failed to start the final film engine: ' + msg);
        setIsReady(false);
        return false;
      } finally {
        setIsLoading(false);
      }
    })();

    loadPromiseRef.current = p;
    try   { return await p; }
    finally { if (loadPromiseRef.current === p) loadPromiseRef.current = null; }
  }, []);

  const stitchClips = useCallback(async (opts: StitchOptions): Promise<Blob | null> => {
    const { clipUrls, onProgress } = opts;
    if (!clipUrls.length) { setError('No clips to assemble'); return null; }

    setIsLoading(true); setError(null); setProgress(0);
    setStatus('Preparing your final film...');
    onProgress?.(0, 'Preparing your final film...');

    try {
      const ready = await loadFFmpeg();
      if (!ready || !proxyRef.current) throw new Error('Final film engine failed to load');

      const proxy = proxyRef.current;
      const inputFiles  = clipUrls.map((_, i) => `clip${i}.mp4`);
      const dlPct       = new Array(clipUrls.length).fill(0);
      let   nextIdx     = 0;
      let   writeQueue: Promise<unknown> = Promise.resolve();

      const dlWorker = async () => {
        while (true) {
          const idx = nextIdx++;
          if (idx >= clipUrls.length) return;
          const bytes = await fetchAsBytes(clipUrls[idx], (pct) => {
            dlPct[idx] = pct;
            const avg     = dlPct.reduce((s, v) => s + v, 0) / clipUrls.length;
            const overall = Math.round(avg * 0.4);
            setProgress(overall);
            onProgress?.(overall, 'Downloading clips...');
          });
          // Queue writes so file ordering in FS is always correct
          const write = writeQueue.then(() =>
            proxy.send('WRITE_FILE', { path: inputFiles[idx], data: bytes }, [bytes.buffer])
          );
          writeQueue = write;
          await write;
        }
      };

      setStatus('Downloading clips...');
      await Promise.all(Array.from({ length: Math.min(3, clipUrls.length) }, () => dlWorker()));

      const concatTxt = new TextEncoder().encode(inputFiles.map(f => `file '${f}'`).join('\n'));
      await proxy.send('WRITE_FILE', { path: 'concat.txt', data: concatTxt }, [concatTxt.buffer]);

      setStatus('Assembling your final film...'); setProgress(45);
      onProgress?.(45, 'Assembling your final film...');

      await withTimeout(
        proxy.send('EXEC', {
          args: ['-f', 'concat', '-safe', '0', '-i', 'concat.txt',
                 '-c', 'copy', '-movflags', '+faststart', 'output.mp4'],
        }),
        EXEC_TIMEOUT_MS,
        'Final film assembly took too long',
      );

      setStatus('Finishing your film...'); setProgress(92);
      onProgress?.(92, 'Finishing your film...');

      const raw  = await proxy.send('READ_FILE', { path: 'output.mp4' }) as Uint8Array;
      const blob = new Blob([raw.buffer as ArrayBuffer], { type: 'video/mp4' });

      for (const f of [...inputFiles, 'concat.txt', 'output.mp4']) {
        try { await proxy.send('DELETE_FILE', { path: f }); } catch (_) {}
      }

      setProgress(100); setStatus('');
      onProgress?.(100, 'Your final film is ready!');
      return blob;

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Final film assembly failed';
      console.error('[useFFmpegVideo] error:', err);
      setError(msg);
      onProgress?.(0, 'Error: ' + msg);
      return null;
    } finally {
      setIsLoading(false); setProgress(0); setStatus('');
    }
  }, [loadFFmpeg]);

  return { isLoading, isReady, progress, status, error, loadFFmpeg, stitchClips };
}
