import { randomUUID } from 'crypto';
import * as esbuild from 'esbuild';
import { extname, posix, relative, resolve } from 'path';

const previewSessions = new Map();

const ENTRY_CANDIDATES = [
  '/App.tsx',
  '/App.jsx',
  '/App.js',
  '/src/App.tsx',
  '/src/App.jsx',
  '/src/App.js',
  '/src/main.tsx',
  '/src/main.jsx',
  '/src/main.js',
  '/src/index.tsx',
  '/src/index.jsx',
  '/src/index.js',
  '/index.tsx',
  '/index.jsx',
  '/index.js',
];

const STANDARD_PACKAGE_VERSIONS = {
  'react': '18.3.1',
  'react-dom': '18.3.1',
  'lucide-react': '0.462.0',
  'react-icons': '5.0.1',
  'framer-motion': '11.12.1',
  'i18next': '23.7.6',
  'react-i18next': '13.5.0',
  'i18next-browser-languagedetector': '7.2.0',
  'date-fns': '3.6.0',
  'dayjs': '1.11.10',
  'moment': '2.30.1',
  'react-day-picker': '8.10.1',
  'recharts': '2.12.7',
  'react-circular-progressbar': '2.2.0',
  'react-slick': '0.30.2',
  'slick-carousel': '1.8.1',
  'embla-carousel-react': '8.0.0',
  'embla-carousel-autoplay': '8.0.0',
  '@dnd-kit/core': '6.1.0',
  '@dnd-kit/sortable': '8.0.0',
  '@dnd-kit/utilities': '3.2.2',
  'react-hook-form': '7.53.0',
  '@hookform/resolvers': '3.9.0',
  'zod': '3.23.8',
  '@radix-ui/react-dialog': '1.1.2',
  '@radix-ui/react-dropdown-menu': '2.1.15',
  '@radix-ui/react-popover': '1.1.1',
  '@radix-ui/react-select': '2.1.1',
  '@radix-ui/react-tabs': '1.1.0',
  '@radix-ui/react-tooltip': '1.1.4',
  '@radix-ui/react-checkbox': '1.1.1',
  '@radix-ui/react-switch': '1.1.0',
  '@radix-ui/react-slider': '1.2.0',
  '@radix-ui/react-progress': '1.1.0',
  '@radix-ui/react-avatar': '1.1.0',
  '@radix-ui/react-accordion': '1.2.0',
  '@radix-ui/react-slot': '1.1.0',
  'sonner': '1.5.0',
  'react-toastify': '10.0.4',
  'react-hot-toast': '2.4.1',
  'clsx': '2.1.0',
  'tailwind-merge': '2.2.0',
  'canvas-confetti': '1.9.4',
  'uuid': '11.1.0',
  'lodash': '4.17.21',
  '@tanstack/react-query': '5.56.2',
  'swr': '2.2.5',
  'react-router-dom': '6.22.3',
  'axios': '1.6.8',
  'chess.js': '1.0.0-beta.6',
  'react-chessboard': '4.7.3',
  'pixi.js': '8.10.2',
  'react-player': '2.14.1',
  'react-markdown': '9.0.1',
  'remark-gfm': '4.0.0',
  'prismjs': '1.29.0',
  'react-syntax-highlighter': '15.5.0',
  '@supabase/supabase-js': '2.39.8',
  'leaflet': '1.9.4',
  'react-leaflet': '4.2.1',
  '@react-pdf/renderer': '3.4.2',
  'qrcode.react': '3.1.0',
  'react-copy-to-clipboard': '5.1.0',
  '@tanstack/react-table': '8.13.2',
  'react-window': '1.8.10',
  'react-virtualized': '9.22.5',
  'react-masonry-css': '1.0.16',
  'react-infinite-scroll-component': '6.1.0',
  'react-loading-skeleton': '3.4.0',
  'react-colorful': '5.6.1',
  'react-intersection-observer': '9.10.2'
};

const STANDARD_PACKAGES = Object.keys(STANDARD_PACKAGE_VERSIONS);

function normalizeProjectPath(filePath) {
  if (typeof filePath !== 'string') return '';
  const normalized = filePath.replace(/\\/g, '/').trim();
  if (!normalized) return '';
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function normalizeAssetPath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/^\/+/, '');
}

function detectEntryPoint(files, requestedEntryPoint) {
  const normalizedRequested = normalizeProjectPath(requestedEntryPoint || '');
  if (normalizedRequested && typeof files[normalizedRequested] === 'string') {
    return normalizedRequested;
  }

  for (const candidate of ENTRY_CANDIDATES) {
    if (typeof files[candidate] === 'string') {
      return candidate;
    }
  }

  const firstCodeFile = Object.keys(files).find((path) => /\.(js|jsx|ts|tsx)$/.test(path));
  return firstCodeFile || '/App.js';
}

function resolveProjectImportPath(importPath, currentFile, files) {
  let cleanPath = String(importPath || '').trim();
  if (!cleanPath) return null;

  if (cleanPath.startsWith('@/')) {
    cleanPath = `/src/${cleanPath.slice(2)}`;
  }

  if (cleanPath.startsWith('./') || cleanPath.startsWith('../')) {
    const importerDir = posix.dirname(normalizeProjectPath(currentFile));
    cleanPath = posix.normalize(posix.join(importerDir, cleanPath));
  }

  if (!cleanPath.startsWith('/')) {
    return null;
  }

  cleanPath = normalizeProjectPath(cleanPath);

  const candidates = [
    cleanPath,
    `${cleanPath}.tsx`,
    `${cleanPath}.ts`,
    `${cleanPath}.jsx`,
    `${cleanPath}.js`,
    `${cleanPath}.json`,
    `${cleanPath}.css`,
    `${cleanPath}.svg`,
    `${cleanPath}.png`,
    `${cleanPath}.jpg`,
    `${cleanPath}.jpeg`,
    `${cleanPath}.webp`,
    `${cleanPath}.gif`,
    `${cleanPath}.ico`,
    `${cleanPath}/index.tsx`,
    `${cleanPath}/index.ts`,
    `${cleanPath}/index.jsx`,
    `${cleanPath}/index.js`,
  ];

  for (const candidate of candidates) {
    if (typeof files[candidate] === 'string') {
      return candidate;
    }
  }

  return null;
}

function getLoader(filePath) {
  const extension = extname(filePath).toLowerCase();
  if (extension === '.js' || extension === '.jsx') return 'jsx';
  if (extension === '.ts' || extension === '.tsx') return 'tsx';
  if (extension === '.json') return 'json';
  if (extension === '.css') return 'css';
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.avif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot'].includes(extension)) return 'file';
  return 'text';
}

function getContentType(filePath) {
  const extension = extname(filePath).toLowerCase();
  if (extension === '.js' || extension === '.mjs') return 'text/javascript; charset=utf-8';
  if (extension === '.css') return 'text/css; charset=utf-8';
  if (extension === '.json') return 'application/json; charset=utf-8';
  if (extension === '.svg') return 'image/svg+xml';
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.gif') return 'image/gif';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.ico') return 'image/x-icon';
  if (extension === '.woff') return 'font/woff';
  if (extension === '.woff2') return 'font/woff2';
  if (extension === '.ttf') return 'font/ttf';
  return 'application/octet-stream';
}

function buildSessionHtml({ sessionId, projectName, entryScriptPath, cssPaths }) {
  const safeTitle = String(projectName || 'Wakti Preview')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const stylesheetTags = cssPaths
    .map((assetPath) => `<link rel="stylesheet" href="/api/project-preview/sessions/${sessionId}/assets/${assetPath}">`)
    .join('');

  const importMap = {
    imports: {
      "react": "https://esm.sh/react@18.3.1",
      "react/": "https://esm.sh/react@18.3.1/",
      "react-dom": "https://esm.sh/react-dom@18.3.1",
      "react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
      "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime",
    }
  };

  for (const pkg of STANDARD_PACKAGES) {
    const ver = STANDARD_PACKAGE_VERSIONS[pkg];
    const pkgWithVer = ver ? `${pkg}@${ver}` : pkg;
    if (!importMap.imports[pkg]) {
      importMap.imports[pkg] = `https://esm.sh/${pkgWithVer}?external=react,react-dom`;
      importMap.imports[`${pkg}/`] = `https://esm.sh/${pkgWithVer}/`;
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <style>
    html, body, #root { margin: 0; padding: 0; min-height: 100%; }
    body { background: #0c0f14; }
  </style>
  ${stylesheetTags}
  <script type="importmap">
    ${JSON.stringify(importMap, null, 2)}
  </script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    function waktiRunnerNotify(type, payload) {
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ source: 'wakti-preview-runner', type, payload }, '*');
        }
      } catch {}
    }
    window.addEventListener('error', function(event) {
      waktiRunnerNotify('error', {
        message: event?.message || 'Preview runtime failed',
        stack: event?.error?.stack || ''
      });
    });
    window.addEventListener('unhandledrejection', function(event) {
      waktiRunnerNotify('error', {
        message: event?.reason?.message || String(event?.reason || 'Preview promise failed')
      });
    });
    window.__waktiPreviewLoaded = false;
    window.__waktiPreviewLoadedOk = function() {
      if (window.__waktiPreviewLoaded) return;
      window.__waktiPreviewLoaded = true;
      window.setTimeout(function() {
        waktiRunnerNotify('ready', { ok: true });
      }, 120);
    };
  </script>
</head>
<body>
  <div id="root"></div>
  <script type="module">
    import React from 'react';
    import { createRoot } from 'react-dom/client';

    (async () => {
      try {
        const appModule = await import('/api/project-preview/sessions/${sessionId}/assets/${entryScriptPath}');
        const App = appModule?.default;
        if (!App) {
          throw new Error('Preview entry module does not export a default component');
        }

        const rootElement = document.getElementById('root');
        if (!rootElement) {
          throw new Error('Preview root element was not found');
        }

        const root = createRoot(rootElement);
        root.render(React.createElement(App));
        window.__waktiPreviewLoadedOk();
      } catch (err) {
        console.error('[Wakti Boot Error]', err);
        waktiRunnerNotify('error', {
          message: err?.message || String(err),
          stack: err?.stack || ''
        });
      }
    })();
  </script>
</body>
</html>`;
}

function normalizePreviewFiles(files, projectId) {
  return Object.entries(files || {}).reduce((acc, [path, content]) => {
    const normalizedPath = normalizeProjectPath(path);
    if (!normalizedPath || typeof content !== 'string') {
      return acc;
    }
    acc[normalizedPath] = content.replace(/\{\{PROJECT_ID\}\}/g, projectId || '');
    return acc;
  }, {});
}

function createSessionRecord({ sessionId, html, projectId, projectName, ttlSeconds, assets = new Map() }) {
  cleanupExpiredPreviewSessions();
  const ttl = Number.isFinite(ttlSeconds) ? Math.max(60, Math.min(Number(ttlSeconds), 60 * 60)) : 15 * 60;
  const expiresAt = Date.now() + ttl * 1000;
  const session = {
    id: sessionId,
    html,
    assets,
    projectId: typeof projectId === 'string' ? projectId : null,
    projectName: typeof projectName === 'string' ? projectName : 'Wakti Preview',
    expiresAt,
  };
  previewSessions.set(sessionId, session);
  return session;
}

export function cleanupExpiredPreviewSessions() {
  const now = Date.now();
  for (const [id, session] of previewSessions.entries()) {
    if (!session || session.expiresAt <= now) {
      previewSessions.delete(id);
    }
  }
}

export function createHtmlPreviewSession({ html, ttlSeconds, projectId, projectName }) {
  const sessionId = randomUUID();
  const session = createSessionRecord({ sessionId, html, ttlSeconds, projectId, projectName });
  return {
    id: session.id,
    url: `/api/project-preview/sessions/${session.id}`,
    expiresAt: session.expiresAt,
  };
}

export async function buildProjectPreviewSession({ files, entryPoint, ttlSeconds, projectId, projectName, workspaceRoot }) {
  const normalizedFiles = normalizePreviewFiles(files, typeof projectId === 'string' ? projectId : '');
  const normalizedEntryPoint = detectEntryPoint(normalizedFiles, entryPoint);

  if (!Object.keys(normalizedFiles).length) {
    throw new Error('No preview files were provided');
  }

  if (!normalizedFiles[normalizedEntryPoint]) {
    throw new Error(`Preview entry point not found: ${normalizedEntryPoint}`);
  }

  const sessionId = randomUUID();
  const outputRoot = resolve(workspaceRoot, '.wakti-preview-cache', sessionId);
  const publicPath = `/api/project-preview/sessions/${sessionId}/assets`;

  const projectFilesPlugin = {
    name: 'wakti-project-files',
    setup(build) {
      build.onResolve({ filter: /^[^./]/ }, (args) => {
        return { path: args.path, external: true };
      });

      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.kind === 'entry-point') {
          return { path: normalizedEntryPoint, namespace: 'wakti-project' };
        }

        const resolved = resolveProjectImportPath(args.path, args.importer, normalizedFiles);
        if (resolved) {
          return { path: resolved, namespace: 'wakti-project' };
        }

        return null;
      });

      build.onLoad({ filter: /.*/, namespace: 'wakti-project' }, (args) => {
        const normalizedPath = normalizeProjectPath(args.path);
        const contents = normalizedFiles[normalizedPath];
        if (typeof contents !== 'string') {
          return null;
        }

        return {
          contents,
          loader: getLoader(normalizedPath),
          resolveDir: posix.dirname(normalizedPath),
        };
      });
    },
  };

  let buildResult;

  try {
    buildResult = await esbuild.build({
      absWorkingDir: workspaceRoot,
      entryPoints: [normalizedEntryPoint],
      bundle: true,
      write: false,
      outdir: outputRoot,
      format: 'esm',
      splitting: false,
      platform: 'browser',
      target: ['es2020'],
      jsx: 'automatic',
      sourcemap: 'inline',
      publicPath,
      plugins: [projectFilesPlugin],
      logLevel: 'silent',
    });
  } catch (error) {
    const messages = Array.isArray(error?.errors)
      ? error.errors.map((item) => item.text).filter(Boolean).join('\n')
      : '';
    throw new Error(messages || error?.message || 'Preview build failed');
  }

  const assets = new Map();
  const cssPaths = [];
  let entryScriptPath = '';

  for (const outputFile of buildResult.outputFiles || []) {
    const relativePath = normalizeAssetPath(relative(outputRoot, outputFile.path));
    if (!relativePath || relativePath.startsWith('..')) {
      continue;
    }

    assets.set(relativePath, {
      contents: Buffer.from(outputFile.contents),
      contentType: getContentType(relativePath),
    });

    if (relativePath.endsWith('.css')) {
      cssPaths.push(relativePath);
    }

    if (!entryScriptPath && relativePath === 'app.js') {
      entryScriptPath = relativePath;
    }
  }

  if (!entryScriptPath) {
    entryScriptPath = Array.from(assets.keys()).find((assetPath) => assetPath.endsWith('.js')) || '';
  }

  if (!entryScriptPath) {
    throw new Error('Preview bundle output not found');
  }

  const html = buildSessionHtml({
    sessionId,
    projectName: projectName || 'Wakti Preview',
    entryScriptPath,
    cssPaths,
  });

  const session = createSessionRecord({
    sessionId,
    html,
    assets,
    ttlSeconds,
    projectId,
    projectName,
  });

  return {
    id: session.id,
    url: `/api/project-preview/sessions/${session.id}`,
    expiresAt: session.expiresAt,
    entryPoint: normalizedEntryPoint,
  };
}

export function getPreviewSession(sessionId) {
  cleanupExpiredPreviewSessions();
  return previewSessions.get(sessionId) || null;
}

export function getPreviewSessionAsset(sessionId, assetPath) {
  const session = getPreviewSession(sessionId);
  if (!session) return null;
  const normalizedAssetPath = normalizeAssetPath(assetPath || '');
  if (!normalizedAssetPath) return null;
  return session.assets?.get(normalizedAssetPath) || null;
}


