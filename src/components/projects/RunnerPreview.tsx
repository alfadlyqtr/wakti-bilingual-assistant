import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSandpack } from '@codesandbox/sandpack-react';
import { Loader2 } from 'lucide-react';
import { getProjectEntryPoint } from '@/utils/projectRuntimeHtml';

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
        const sessionResponse = await fetch('/api/project-preview/build-sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            files: liveFiles,
            entryPoint,
            projectId,
            projectName: projectName || 'Wakti Preview',
          }),
        });

        if (currentRequestVersion !== requestVersionRef.current) {
          return;
        }

        if (!sessionResponse.ok) {
          let message = 'Preview build failed';
          try {
            const errorData = await sessionResponse.json();
            if (errorData?.error) {
              message = errorData.error;
            }
          } catch {
          }
          throw new Error(message);
        }

        const sessionData = await sessionResponse.json();
        if (!sessionData?.url) {
          throw new Error('Preview session did not return a URL');
        }

        if (currentRequestVersion !== requestVersionRef.current) {
          return;
        }

        setStatus('loading-frame');
        setFrameSrc(`${sessionData.url}${sessionData.url.includes('?') ? '&' : '?'}t=${Date.now()}`);

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
      {(status === 'building' || status === 'loading-frame' || !frameSrc) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0c0f14]">
          <div className="flex flex-col items-center gap-3 text-center px-6">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
            <div className="text-sm font-medium text-white">
              {status === 'building'
                ? (isRTL ? 'جارِ بناء المعاينة' : 'Building preview')
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
    </div>
  );
}
