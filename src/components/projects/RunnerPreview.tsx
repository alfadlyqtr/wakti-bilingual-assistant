import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSandpack } from '@codesandbox/sandpack-react';
import { Loader2 } from 'lucide-react';
import { buildProjectRuntimeHtml, getProjectEntryPoint } from '@/utils/projectRuntimeHtml';

interface RunnerPreviewProps {
  projectId?: string;
  projectName?: string;
  isActive: boolean;
  isLoading?: boolean;
  reloadKey: number;
  isRTL?: boolean;
  onPreviewReady?: () => void;
  onPreviewFailure?: (reason: string) => void;
}

type RunnerStatus = 'idle' | 'building' | 'loading-frame' | 'ready' | 'failed';

type SandpackLiveFile = {
  code?: string;
  content?: string;
};

const APP_COMPONENT_ENTRY_CANDIDATES = [
  '/App.tsx',
  '/App.jsx',
  '/App.js',
  '/src/App.tsx',
  '/src/App.jsx',
  '/src/App.js',
] as const;

const RUNTIME_BOOT_FILES = new Set([
  '/index.tsx',
  '/index.jsx',
  '/index.js',
  '/src/index.tsx',
  '/src/index.jsx',
  '/src/index.js',
  '/src/main.tsx',
  '/src/main.jsx',
  '/src/main.js',
]);

function toLiveFiles(files: Record<string, SandpackLiveFile>): Record<string, string> {
  return Object.entries(files).reduce<Record<string, string>>((acc, [path, file]) => {
    if (path.startsWith('/node_modules/')) {
      return acc;
    }

    const nextContent = file?.code ?? file?.content ?? '';
    if (typeof nextContent === 'string') {
      acc[path] = nextContent;
    }
    return acc;
  }, {});
}

function toBundlePath(path: string): string {
  return String(path || '').replace(/\\/g, '/').replace(/^\/+/, '/');
}

function stripImports(source: string): string {
  return source
    .replace(/^\s*import\s+[^;]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
    .replace(/^\s*import\s+['"][^'"]+['"]\s*;?\s*$/gm, '');
}

function sanitizeCss(source: string): string {
  return source
    .replace(/@tailwind\s+[^;]+;?/g, '')
    .replace(/@import\s+url\([^)]+\);?/g, '');
}

function transformModuleSource(source: string): { code: string; defaultExport: string | null } {
  let code = stripImports(source);
  let defaultExport: string | null = null;

  const fnDefault = code.match(/export\s+default\s+function\s+([A-Za-z_$][\w$]*)/);
  if (fnDefault?.[1]) {
    defaultExport = fnDefault[1];
  }

  const classDefault = code.match(/export\s+default\s+class\s+([A-Za-z_$][\w$]*)/);
  if (classDefault?.[1]) {
    defaultExport = classDefault[1];
  }

  const namedDefault = code.match(/export\s+default\s+([A-Za-z_$][\w$]*)\s*;?/);
  if (namedDefault?.[1]) {
    defaultExport = namedDefault[1];
  }

  code = code
    .replace(/export\s+default\s+function\s+([A-Za-z_$][\w$]*)/g, 'function $1')
    .replace(/export\s+default\s+class\s+([A-Za-z_$][\w$]*)/g, 'class $1')
    .replace(/export\s+default\s+([A-Za-z_$][\w$]*)\s*;?/g, '')
    .replace(/\bexport\s+(const|let|var|function|class)\b/g, '$1')
    .replace(/export\s*\{[^}]*\}\s*;?/g, '');

  return { code, defaultExport };
}

function buildLocalPreviewBundle(files: Record<string, string>, requestedEntryPoint: string): { js: string; css: string; entryPath: string } {
  const normalizedFiles = Object.entries(files).reduce<Record<string, string>>((acc, [path, content]) => {
    const normalizedPath = toBundlePath(path);
    if (typeof content === 'string') {
      acc[normalizedPath] = content;
    }
    return acc;
  }, {});

  const appEntry = APP_COMPONENT_ENTRY_CANDIDATES.find((path) => typeof normalizedFiles[path] === 'string');
  const resolvedEntry = appEntry || toBundlePath(requestedEntryPoint);

  const css = Object.entries(normalizedFiles)
    .filter(([path]) => path.endsWith('.css'))
    .map(([, content]) => sanitizeCss(content))
    .join('\n\n');

  const jsPaths = Object.keys(normalizedFiles)
    .filter((path) => /\.(jsx?|tsx?)$/i.test(path))
    .filter((path) => path === resolvedEntry || !RUNTIME_BOOT_FILES.has(path))
    .sort((a, b) => a.localeCompare(b));

  const orderedPaths = [
    ...jsPaths.filter((path) => path !== resolvedEntry),
    ...(jsPaths.includes(resolvedEntry) ? [resolvedEntry] : []),
  ];

  const transformedChunks: string[] = [];
  let entryDefaultExport = 'App';

  for (const path of orderedPaths) {
    const source = normalizedFiles[path];
    if (typeof source !== 'string') continue;

    const transformed = transformModuleSource(source);
    if (path === resolvedEntry && transformed.defaultExport) {
      entryDefaultExport = transformed.defaultExport;
    }

    transformedChunks.push(`/* FILE: ${path} */\n${transformed.code}`);
  }

  transformedChunks.push(`
if (!window.App && typeof ${entryDefaultExport} !== 'undefined') {
  window.App = ${entryDefaultExport};
}
if (!window.App && typeof App !== 'undefined') {
  window.App = App;
}
`);

  return {
    js: transformedChunks.join('\n\n'),
    css,
    entryPath: resolvedEntry,
  };
}

export default function RunnerPreview({
  projectId,
  projectName,
  isActive,
  isLoading = false,
  reloadKey,
  isRTL = false,
  onPreviewReady,
  onPreviewFailure,
}: RunnerPreviewProps) {
  const { sandpack } = useSandpack();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const requestVersionRef = useRef(0);
  const readyTimeoutRef = useRef<number | null>(null);
  const [status, setStatus] = useState<RunnerStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [frameSrc, setFrameSrc] = useState('');
  const [frameSrcDoc, setFrameSrcDoc] = useState('');
  const [runtimeMode, setRuntimeMode] = useState<'server' | 'local'>('server');
  const preferLocalRuntimeRef = useRef(false);

  const liveFiles = useMemo(() => toLiveFiles(sandpack.files as Record<string, SandpackLiveFile>), [sandpack.files]);
  const filesFingerprint = useMemo(
    () => Object.entries(liveFiles)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, content]) => `${path}:${content.length}:${content.slice(0, 40)}`)
      .join('|'),
    [liveFiles]
  );

  useEffect(() => {
    return () => {
      if (readyTimeoutRef.current) {
        window.clearTimeout(readyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isActive || isLoading) {
      return;
    }

    const hasCode = Object.keys(liveFiles).some((path) => /\.(js|jsx|ts|tsx)$/.test(path));
    if (!hasCode) {
      return;
    }

    const currentRequestVersion = ++requestVersionRef.current;
    const debounceTimer = window.setTimeout(async () => {
      try {
        setStatus('building');
        setErrorMessage('');

        const entryPoint = getProjectEntryPoint(liveFiles);
        let loadedFromServer = false;

        if (!preferLocalRuntimeRef.current) {
          try {
            const controller = new AbortController();
            const timeoutId = window.setTimeout(() => controller.abort(), 2200);

            const sessionResponse = await fetch('/api/project-preview/build-sessions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              signal: controller.signal,
              body: JSON.stringify({
                files: liveFiles,
                entryPoint,
                projectId,
                projectName: projectName || 'Wakti Preview',
              }),
            });

            window.clearTimeout(timeoutId);

            if (currentRequestVersion !== requestVersionRef.current) {
              return;
            }

            if (sessionResponse.ok) {
              const sessionData = await sessionResponse.json();
              if (sessionData?.url) {
                setRuntimeMode('server');
                setStatus('loading-frame');
                setFrameSrcDoc('');
                setFrameSrc(`${sessionData.url}${sessionData.url.includes('?') ? '&' : '?'}t=${Date.now()}`);
                loadedFromServer = true;
              }
            }
          } catch {
            preferLocalRuntimeRef.current = true;
          }
        }

        if (!loadedFromServer) {
          const localBundle = buildLocalPreviewBundle(liveFiles, entryPoint);
          const localHtml = buildProjectRuntimeHtml({
            projectName: projectName || 'Wakti Preview',
            bundledJs: localBundle.js,
            bundledCss: localBundle.css,
            useBabelRuntime: true,
          });

          if (currentRequestVersion !== requestVersionRef.current) {
            return;
          }

          setRuntimeMode('local');
          setStatus('loading-frame');
          setFrameSrc('');
          setFrameSrcDoc(localHtml);
          loadedFromServer = true;
        }

        if (!loadedFromServer) {
          throw new Error('Preview runner could not start');
        }

        if (readyTimeoutRef.current) {
          window.clearTimeout(readyTimeoutRef.current);
        }
        readyTimeoutRef.current = window.setTimeout(() => {
          if (currentRequestVersion !== requestVersionRef.current) {
            return;
          }
          setStatus('failed');
          setErrorMessage('Preview runner timed out while starting the app.');
          onPreviewFailure?.('Preview runner timed out while starting the app.');
        }, 20000);
      } catch (error) {
        if (currentRequestVersion !== requestVersionRef.current) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Preview runner failed';
        setStatus('failed');
        setErrorMessage(message);
        onPreviewFailure?.(message);
      }
    }, 500);

    return () => {
      window.clearTimeout(debounceTimer);
    };
  }, [filesFingerprint, isActive, isLoading, liveFiles, onPreviewFailure, projectId, projectName, reloadKey]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      const iframeWindow = iframeRef.current?.contentWindow;
      if (iframeWindow && event.source !== iframeWindow) {
        return;
      }

      const data = event.data;
      if (!data || typeof data !== 'object' || data.source !== 'wakti-preview-runner') {
        return;
      }

      if (data.type === 'ready') {
        if (readyTimeoutRef.current) {
          window.clearTimeout(readyTimeoutRef.current);
        }
        setStatus('ready');
        setErrorMessage('');
        onPreviewReady?.();
        return;
      }

      if (data.type === 'error') {
        if (readyTimeoutRef.current) {
          window.clearTimeout(readyTimeoutRef.current);
        }
        const message = data.payload?.message || 'Preview runtime failed';
        setStatus('failed');
        setErrorMessage(message);
        onPreviewFailure?.(message);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isActive, onPreviewFailure, onPreviewReady]);

  if (status === 'failed') {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[#0c0f14] p-6 text-center">
        <div className="max-w-md space-y-3">
          <div className="text-sm font-semibold text-white">
            {isRTL ? 'فشل تشغيل المعاينة' : 'Preview connection failed'}
          </div>
          <div className="text-xs text-zinc-400 break-words">{errorMessage}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative bg-black">
      {(status === 'building' || status === 'loading-frame' || (!frameSrc && !frameSrcDoc)) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0c0f14]">
          <div className="flex flex-col items-center gap-3 text-center px-6">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
            <div className="text-sm font-medium text-white">
              {status === 'building'
                ? (isRTL ? 'جارِ بناء المعاينة' : 'Building preview')
                : runtimeMode === 'local'
                  ? (isRTL ? 'جارِ تشغيل المعاينة المحلية' : 'Starting local preview')
                  : (isRTL ? 'جارِ تشغيل المعاينة' : 'Starting preview')}
            </div>
          </div>
        </div>
      )}

      {frameSrc && (
        <iframe
          ref={iframeRef}
          src={frameSrc}
          title="Wakti Preview Runner"
          className="h-full w-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
        />
      )}

      {!frameSrc && frameSrcDoc && (
        <iframe
          ref={iframeRef}
          srcDoc={frameSrcDoc}
          title="Wakti Local Preview Runner"
          className="h-full w-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
        />
      )}
    </div>
  );
}
