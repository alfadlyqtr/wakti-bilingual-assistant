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

function buildLocalPreviewBundle(files: Record<string, string>) {
  const allCss: string[] = [];
  const allJs: string[] = [];
  const processedFiles = new Set<string>();
  const jsonVars: string[] = [];
  const entryPoint = getProjectEntryPoint(files);
  const entryBaseName = entryPoint.split('/').pop()?.replace(/\.(js|jsx|ts|tsx)$/, '') || 'App';

  for (const [filePath, content] of Object.entries(files)) {
    if (filePath.endsWith('.css')) {
      let css = content;
      css = css.replace(/@tailwind\s+[^;]+;/g, '');
      css = css.replace(/@import\s+url\([^)]+\);?/g, '');
      allCss.push(css);
      processedFiles.add(filePath);
    }
  }

  for (const [filePath, content] of Object.entries(files)) {
    if (filePath.endsWith('.json')) {
      const varName = filePath
        .replace(/^\//, '')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/_+/g, '_');
      jsonVars.push(`const ${varName} = ${content};`);
      processedFiles.add(filePath);
    }
  }

  const resolveImportPath = (importPath: string, currentFile: string): string | null => {
    let cleanPath = importPath.replace(/['"`;]/g, '').trim();

    if (cleanPath.startsWith('./') || cleanPath.startsWith('../')) {
      const currentDir = currentFile.substring(0, currentFile.lastIndexOf('/')) || '';
      const parts = cleanPath.split('/');
      const resolvedParts = currentDir.split('/').filter(Boolean);

      for (const part of parts) {
        if (part === '.') continue;
        if (part === '..') resolvedParts.pop();
        else resolvedParts.push(part);
      }

      cleanPath = '/' + resolvedParts.join('/');
    }

    if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
    if (files[cleanPath]) return cleanPath;

    for (const ext of ['', '.js', '.jsx', '.ts', '.tsx', '.json']) {
      if (files[cleanPath + ext]) return cleanPath + ext;
    }

    for (const idx of ['/index.js', '/index.jsx', '/index.ts', '/index.tsx']) {
      if (files[cleanPath + idx]) return cleanPath + idx;
    }

    return null;
  };

  const stripImportsExports = (content: string, filePath: string): string => {
    let result = content;
    const fileName = filePath.split('/').pop()?.replace(/\.(js|jsx|ts|tsx)$/, '') || 'Component';

    const convertNamedImports = (value: string) => value
      .trim()
      .replace(/^\{/, '')
      .replace(/\}$/, '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.replace(/\s+as\s+/g, ': '))
      .join(', ');

    const buildGlobalImport = (specifiers: string, source: string) => {
      const trimmed = specifiers.trim();
      const makeDeclarations = (globalExpr: string) => {
        const declarations: string[] = [];

        if (trimmed.startsWith('{')) {
          declarations.push(`var { ${convertNamedImports(trimmed)} } = ${globalExpr};`);
          return declarations.join('\n');
        }

        if (trimmed.startsWith('* as ')) {
          declarations.push(`var ${trimmed.replace('* as ', '').trim()} = ${globalExpr};`);
          return declarations.join('\n');
        }

        if (trimmed.includes(',')) {
          const commaIndex = trimmed.indexOf(',');
          const defaultImport = trimmed.slice(0, commaIndex).trim();
          const rest = trimmed.slice(commaIndex + 1).trim();
          if (defaultImport) {
            declarations.push(`var ${defaultImport} = ${globalExpr};`);
          }
          if (rest.startsWith('{')) {
            declarations.push(`var { ${convertNamedImports(rest)} } = ${globalExpr};`);
          } else if (rest.startsWith('* as ')) {
            declarations.push(`var ${rest.replace('* as ', '').trim()} = ${globalExpr};`);
          }
          return declarations.join('\n');
        }

        declarations.push(`var ${trimmed} = ${globalExpr};`);
        return declarations.join('\n');
      };

      if (source === 'react') return makeDeclarations('window.React');
      if (source === 'react-dom') return makeDeclarations('window.ReactDOM');
      if (source === 'framer-motion') return makeDeclarations('(window.FramerMotion || window.Motion || {})');
      if (source === 'lucide-react') return makeDeclarations('(window.__lucideIcons || window.lucide || {})');
      if (source === 'recharts') return makeDeclarations('(window.Recharts || {})');

      return '';
    };

    result = result.replace(/^import\s+(.+?)\s+from\s+['"]([^'"]+)['"];?\s*$/gm, (_match, specifiers, source) => {
      if (source.startsWith('.') || source.startsWith('/')) {
        return '';
      }

      return buildGlobalImport(specifiers, source);
    });
    result = result.replace(/^import\s+['"][^'"]*['"];?\s*$/gm, '');
    result = result.replace(/export\s+default\s+function\s+(\w+)/g, 'function $1');
    result = result.replace(/export\s+default\s+function\s*\(/g, `function ${fileName}(`);
    result = result.replace(/export\s+default\s+\(\s*\)\s*=>/g, `const ${fileName} = () =>`);
    result = result.replace(/export\s+default\s+\(([^)]*)\)\s*=>/g, `const ${fileName} = ($1) =>`);
    result = result.replace(/export\s+default\s+(\w+)\s*;?/g, '');
    result = result.replace(/export\s+function\s+/g, 'function ');
    result = result.replace(/export\s+const\s+/g, 'const ');
    result = result.replace(/export\s+(let|var)\s+/g, '$1 ');
    result = result.replace(/export\s+\{[^}]*\}\s*;?/g, '');
    result = result.replace(/\n{3,}/g, '\n\n');

    if (filePath === entryPoint) {
      result += `\n\nwindow.App = typeof App !== 'undefined' ? App : (typeof ${entryBaseName} !== 'undefined' ? ${entryBaseName} : window.App);`;
    }

    return result.trim();
  };

  const jsOrder: string[] = [];

  const processJsFile = (filePath: string) => {
    if (processedFiles.has(filePath)) return;
    if (!files[filePath]) return;
    if (!filePath.match(/\.(js|jsx|ts|tsx)$/)) return;

    processedFiles.add(filePath);
    const content = files[filePath];
    const fromImports = content.matchAll(/import\s+(?:[\s\S]*?)\s*from\s+['"]([^'"]+)['"]/g);
    const sideEffectImports = content.matchAll(/import\s+['"]([^'"]+)['"]\s*;?/g);
    const allImportPaths = new Set<string>();

    for (const match of fromImports) {
      const importPath = match[1];
      if (importPath.startsWith('.') || importPath.startsWith('/')) {
        allImportPaths.add(importPath);
      }
    }

    for (const match of sideEffectImports) {
      const importPath = match[1];
      if (importPath.startsWith('.') || importPath.startsWith('/')) {
        allImportPaths.add(importPath);
      }
    }

    for (const importPath of allImportPaths) {
      const resolved = resolveImportPath(importPath, filePath);
      if (resolved && !processedFiles.has(resolved)) {
        processJsFile(resolved);
      }
    }

    jsOrder.push(filePath);
  };

  processJsFile(entryPoint);

  for (const filePath of Object.keys(files)) {
    if (filePath.match(/\.(js|jsx|ts|tsx)$/) && !processedFiles.has(filePath)) {
      processJsFile(filePath);
    }
  }

  if (jsonVars.length > 0) {
    allJs.push(...jsonVars);
  }

  for (const filePath of jsOrder) {
    const content = files[filePath];
    if (content) {
      allJs.push(stripImportsExports(content, filePath));
    }
  }

  const bundledCss = allCss.join('\n\n');
  const cssInjectionScript = bundledCss.length > 0
    ? `(function(){const style=document.createElement('style');style.textContent=${JSON.stringify(bundledCss)};document.head.appendChild(style);}());`
    : '';

  return {
    js: `${cssInjectionScript}\n\n${allJs.join('\n\n')}`,
    css: '',
  };
}

function toLiveFiles(files: Record<string, any>): Record<string, string> {
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
  const [frameHtml, setFrameHtml] = useState('');

  const liveFiles = useMemo(() => toLiveFiles(sandpack.files as Record<string, any>), [sandpack.files]);
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
        setFrameHtml('');

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
          srcDoc={frameHtml || undefined}
          title="Wakti Preview Runner"
          className="h-full w-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
        />
      )}

      {!frameSrc && frameHtml && (
        <iframe
          ref={iframeRef}
          srcDoc={frameHtml}
          title="Wakti Preview Runner"
          className="h-full w-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
        />
      )}
    </div>
  );
}
