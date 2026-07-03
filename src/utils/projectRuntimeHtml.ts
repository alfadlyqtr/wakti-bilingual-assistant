export const PROJECT_ENTRY_CANDIDATES = [
  '/App.tsx',
  '/App.jsx',
  '/App.js',
  '/src/App.tsx',
  '/src/App.jsx',
  '/src/App.js',
  '/index.tsx',
  '/index.jsx',
  '/index.js',
  '/src/index.tsx',
  '/src/index.jsx',
  '/src/index.js',
  '/src/main.tsx',
  '/src/main.jsx',
  '/src/main.js',
] as const;

export function getProjectEntryPoint(files: Record<string, string>): string {
  for (const candidate of PROJECT_ENTRY_CANDIDATES) {
    if (typeof files[candidate] === 'string') {
      return candidate;
    }
  }

  const firstCodeFile = Object.keys(files).find((path) => /\.(js|jsx|ts|tsx)$/.test(path));
  return firstCodeFile || '/App.js';
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeInlineScript(source: string): string {
  return source.replace(/<\/script/gi, '<\\/script');
}

function escapeInlineStyle(source: string): string {
  return source.replace(/<\/style/gi, '<\\/style');
}

export interface RuntimeNeeds {
  needsRecharts: boolean;
  needsFramerMotion: boolean;
  needsLucide: boolean;
  needsReactIs: boolean;
}

// Detects which optional runtime libraries a bundle actually references, based
// on the marker strings project-build's shims leave behind when a package is
// imported. Shared by both the publish path and the fetch step below so the
// two never drift out of sync.
export function detectRuntimeNeeds(bundledJs: string): RuntimeNeeds {
  const js = bundledJs || '';
  const needsRecharts = js.includes('window.Recharts');
  const needsFramerMotion = js.includes('[framer-motion shim]');
  const needsLucide = js.includes('__lucideIcons');
  return {
    needsRecharts,
    needsFramerMotion,
    needsLucide,
    needsReactIs: needsFramerMotion || needsRecharts,
  };
}

const STATIC_REACT_URLS = [
  'https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js',
  'https://unpkg.com/react@18/umd/react.production.min.js',
];
const STATIC_REACT_DOM_URLS = [
  'https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
];
const STATIC_REACT_IS_URLS = [
  'https://cdn.jsdelivr.net/npm/react-is@18/umd/react-is.production.min.js',
  'https://unpkg.com/react-is/umd/react-is.production.min.js',
];
const STATIC_FRAMER_MOTION_URLS = [
  'https://cdn.jsdelivr.net/npm/framer-motion@6.5.1/dist/framer-motion.js',
  'https://unpkg.com/framer-motion@6.5.1/dist/framer-motion.js',
];
const STATIC_LUCIDE_URLS = [
  'https://cdn.jsdelivr.net/npm/lucide@0.460.0/dist/umd/lucide.min.js',
  'https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js',
];
const STATIC_RECHARTS_URLS = [
  'https://cdn.jsdelivr.net/npm/recharts@2.12.7/umd/Recharts.min.js',
  'https://unpkg.com/recharts/umd/Recharts.min.js',
];
const STATIC_TAILWIND_RUNTIME_URLS = ['https://cdn.tailwindcss.com'];

export interface VendorSources {
  react: string | null;
  reactDom: string | null;
  reactIs: string | null;
  framerMotion: string | null;
  lucide: string | null;
  recharts: string | null;
  tailwind: string | null;
}

async function fetchFirstAvailable(urls: string[]): Promise<string | null> {
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const text = await res.text();
      if (text && text.trim().length > 0) return text;
    } catch {
      // Try the next mirror.
    }
  }
  return null;
}

// Downloads the actual runtime library source ONCE, at publish time, so the
// published site can embed everything it needs and run with zero runtime CDN
// calls - no "loading app" wait for visitors, just a normal static site.
export async function fetchVendorSources(needs: RuntimeNeeds): Promise<VendorSources> {
  const [react, reactDom, reactIs, framerMotion, lucide, recharts, tailwind] = await Promise.all([
    fetchFirstAvailable(STATIC_REACT_URLS),
    fetchFirstAvailable(STATIC_REACT_DOM_URLS),
    needs.needsReactIs ? fetchFirstAvailable(STATIC_REACT_IS_URLS) : Promise.resolve(null),
    needs.needsFramerMotion ? fetchFirstAvailable(STATIC_FRAMER_MOTION_URLS) : Promise.resolve(null),
    needs.needsLucide ? fetchFirstAvailable(STATIC_LUCIDE_URLS) : Promise.resolve(null),
    needs.needsRecharts ? fetchFirstAvailable(STATIC_RECHARTS_URLS) : Promise.resolve(null),
    fetchFirstAvailable(STATIC_TAILWIND_RUNTIME_URLS),
  ]);
  return { react, reactDom, reactIs, framerMotion, lucide, recharts, tailwind };
}

export function buildProjectStaticPublishFiles({
  projectName,
  projectSlug,
  bundledJs,
  bundledCss,
  safelist = [],
  vendor,
}: {
  projectName: string;
  projectSlug: string;
  bundledJs: string;
  bundledCss: string;
  safelist?: string[];
  vendor: VendorSources;
}): {
  indexHtml: string;
  vercelJson: string;
} {
  // React/ReactDOM are non-negotiable - if we couldn't fetch them, refuse to
  // publish a broken site instead of shipping one that will never render.
  const reactSrc = vendor.react;
  const reactDomSrc = vendor.reactDom;
  if (!reactSrc || !reactDomSrc) {
    throw new Error('Could not download the app runtime needed to publish this site. Please try publishing again.');
  }

  const needs = detectRuntimeNeeds(bundledJs);
  const safeTitle = escapeHtml(projectName || 'Wakti Preview');
  const safeAppJs = escapeInlineScript(bundledJs || '');
  const safeAppCss = escapeInlineStyle(bundledCss || '');
  const safelistJson = JSON.stringify(safelist);

  const vendorScripts: string[] = [
    `<script>${escapeInlineScript(reactSrc)}</script>`,
    `<script>${escapeInlineScript(reactDomSrc)}</script>`,
  ];
  if (needs.needsReactIs && vendor.reactIs) {
    vendorScripts.push(`<script>${escapeInlineScript(vendor.reactIs)}</script>`);
  }
  if (needs.needsFramerMotion && vendor.framerMotion) {
    vendorScripts.push(`<script>${escapeInlineScript(vendor.framerMotion)}</script>`);
  }
  if (needs.needsLucide && vendor.lucide) {
    vendorScripts.push(`<script>${escapeInlineScript(vendor.lucide)}</script>`);
  }
  if (needs.needsRecharts && vendor.recharts) {
    vendorScripts.push(`<script>${escapeInlineScript(vendor.recharts)}</script>`);
  }
  const vendorScriptsHtml = vendorScripts.join('\n  ');
  // cdn.tailwindcss.com does not send CORS headers, so it can never be fetched
  // and embedded inline like the other vendor scripts. Fall back to a normal
  // `async` <script src> tag instead - it does not block the app from
  // rendering (Tailwind scans the DOM whenever it finishes loading, and the
  // app already forces a re-scan after render further below).
  const tailwindScriptHtml = vendor.tailwind
    ? `<script>${escapeInlineScript(vendor.tailwind)}</script>`
    : '<script async src="https://cdn.tailwindcss.com"></script>';

  const indexHtml = `<!DOCTYPE html>
<!-- wakti-static-v1 -->
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Tajawal:wght@300;400;500;700&family=Oswald:wght@400;500;600;700&family=Cairo:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Roboto:wght@300;400;500;700&family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <script>
    window.tailwind = window.tailwind || {};
    window.tailwind.config = {
      safelist: ${safelistJson},
      theme: {
        extend: {
          fontFamily: {
            inter: ['Inter', 'sans-serif'],
            tajawal: ['Tajawal', 'sans-serif'],
            oswald: ['Oswald', 'sans-serif'],
            cairo: ['Cairo', 'sans-serif'],
            playfair: ['Playfair Display', 'serif'],
            roboto: ['Roboto', 'sans-serif'],
            poppins: ['Poppins', 'sans-serif'],
          },
          colors: {
            gray: {
              50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db', 400: '#9ca3af',
              500: '#6b7280', 600: '#4b5563', 700: '#374151', 800: '#1f2937', 900: '#111827', 950: '#030712',
            },
            zinc: {
              50: '#fafafa', 100: '#f4f4f5', 200: '#e4e4e7', 300: '#d4d4d8', 400: '#a1a1aa',
              500: '#71717a', 600: '#52525b', 700: '#3f3f46', 800: '#27272a', 900: '#18181b', 950: '#09090b',
            },
            slate: {
              50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8',
              500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a', 950: '#020617',
            },
            purple: {
              50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe', 400: '#c084fc',
              500: '#a855f7', 600: '#9333ea', 700: '#7e22ce', 800: '#6b21a8', 900: '#581c87', 950: '#3b0764',
            },
            pink: {
              50: '#fdf2f8', 100: '#fce7f3', 200: '#fbcfe8', 300: '#f9a8d4', 400: '#f472b6',
              500: '#ec4899', 600: '#db2777', 700: '#be185d', 800: '#9d174d', 900: '#831843', 950: '#500724',
            },
            rose: {
              50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185',
              500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337', 950: '#4c0519',
            },
            amber: {
              50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24',
              500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f', 950: '#451a03',
            },
          },
        },
      },
    };
  </script>
  <style>${safeAppCss}</style>
</head>
<body>
  <div id="root"></div>
  ${vendorScriptsHtml}
  <script>
    window.FramerMotion = window.FramerMotion || window.Motion || null;
    if (typeof window.lucide !== 'undefined' && window.lucide) {
      window.__lucideIcons = window.lucide;
    }
  </script>
  ${tailwindScriptHtml}
  <script>${safeAppJs}</script>
  <script>
    (function() {
      var rootElement = document.getElementById('root');
      if (!rootElement) {
        throw new Error('Root element not found');
      }
      if (!window.React || !window.ReactDOM || typeof window.ReactDOM.createRoot !== 'function') {
        rootElement.innerHTML = '<div style="padding:24px;font-family:Inter,system-ui,sans-serif;color:#dc2626;">Failed to load React runtime.</div>';
        throw new Error('React runtime not available');
      }
      if (typeof window.App === 'undefined' || window.App === null) {
        rootElement.innerHTML = '<div style="padding:24px;font-family:Inter,system-ui,sans-serif;color:#dc2626;">Failed to load app bundle.</div>';
        throw new Error('App component not found after loading app bundle');
      }
      var root = window.ReactDOM.createRoot(rootElement);
      root.render(window.React.createElement(window.App));
      // Force Tailwind re-scan after React renders to pick up all dynamic classes
      var reScan = function() {
        if (window.tailwind && typeof window.tailwind.scan === 'function') {
          window.tailwind.scan();
        }
      };
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(function() { requestAnimationFrame(reScan); });
      } else {
        setTimeout(reScan, 50);
      }
    })();
  </script>
</body>
</html>`;

  const cacheTag = `site-${projectSlug}`;
  const vercelJson = JSON.stringify({
    rewrites: [{ source: '/(.*)', destination: '/index.html' }],
    headers: [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'Surrogate-Control', value: 'no-store' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Cache-Tag', value: cacheTag },
        ],
      },
    ],
  }, null, 2);

  return {
    indexHtml,
    vercelJson,
  };
}

export function buildProjectRuntimeHtml({
  projectName,
  bundledJs,
  bundledCss,
  useBabelRuntime = false,
  safelist = [],
}: {
  projectName: string;
  bundledJs: string;
  bundledCss: string;
  useBabelRuntime?: boolean;
  safelist?: string[];
}): string {
  const safeTitle = escapeHtml(projectName || 'Wakti Preview');
  const safeJs = escapeInlineScript(bundledJs || '');
  const safeCss = escapeInlineStyle(bundledCss || '');
  const encodedBundledJs = JSON.stringify(safeJs);
  const safelistJson = JSON.stringify(safelist);
  const reactUrls = JSON.stringify([
    'https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js',
    'https://unpkg.com/react@18/umd/react.production.min.js',
  ]);
  const reactDomUrls = JSON.stringify([
    'https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js',
    'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  ]);
  const reactIsUrls = JSON.stringify([
    'https://cdn.jsdelivr.net/npm/react-is@18/umd/react-is.production.min.js',
    'https://unpkg.com/react-is/umd/react-is.production.min.js',
  ]);
  const framerMotionUrls = JSON.stringify([
    'https://cdn.jsdelivr.net/npm/framer-motion@6.5.1/dist/framer-motion.js',
    'https://unpkg.com/framer-motion@6.5.1/dist/framer-motion.js',
  ]);
  const lucideUrls = JSON.stringify([
    'https://cdn.jsdelivr.net/npm/lucide@0.460.0/dist/umd/lucide.min.js',
    'https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js',
  ]);
  const rechartsUrls = JSON.stringify([
    'https://cdn.jsdelivr.net/npm/recharts@2.12.7/umd/Recharts.min.js',
    'https://unpkg.com/recharts/umd/Recharts.min.js',
  ]);
  const tailwindUrls = JSON.stringify([
    'https://cdn.tailwindcss.com',
  ]);
  const babelUrls = JSON.stringify([
    'https://cdn.jsdelivr.net/npm/@babel/standalone/babel.min.js',
    'https://unpkg.com/@babel/standalone/babel.min.js',
  ]);

  // Only load optional CDN libraries the bundle actually references (shim markers are only
  // present in the bundled JS when the corresponding package was imported by the project).
  const needsRecharts = (bundledJs || '').includes('window.Recharts');
  const needsFramerMotion = (bundledJs || '').includes('[framer-motion shim]');
  const needsLucide = (bundledJs || '').includes('__lucideIcons');
  const needsReactIs = needsFramerMotion || needsRecharts;

  const optionalLoaders: string[] = [];
  if (needsReactIs) optionalLoaders.push(`loadFirstAvailable('ReactIs', ${reactIsUrls}, false)`);
  if (needsFramerMotion) optionalLoaders.push(`loadFirstAvailable('Framer Motion', ${framerMotionUrls}, false)`);
  if (needsLucide) optionalLoaders.push(`loadFirstAvailable('Lucide', ${lucideUrls}, false)`);
  if (needsRecharts) optionalLoaders.push(`loadFirstAvailable('Recharts', ${rechartsUrls}, false)`);
  optionalLoaders.push(`loadFirstAvailable('Tailwind Browser Runtime', ${tailwindUrls}, false)`);
  const optionalLoadersJs = optionalLoaders.join(',\n    ');

  return `<!DOCTYPE html>
<!-- wakti-runtime-v2 -->
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Tajawal:wght@300;400;500;700&family=Oswald:wght@400;500;600;700&family=Cairo:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Roboto:wght@300;400;500;700&family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <script>
    window.tailwind = window.tailwind || {};
    window.tailwind.config = {
      safelist: ${safelistJson},
      theme: {
        extend: {
          fontFamily: {
            inter: ['Inter', 'sans-serif'],
            tajawal: ['Tajawal', 'sans-serif'],
            oswald: ['Oswald', 'sans-serif'],
            cairo: ['Cairo', 'sans-serif'],
            playfair: ['Playfair Display', 'serif'],
            roboto: ['Roboto', 'sans-serif'],
            poppins: ['Poppins', 'sans-serif'],
          },
          colors: {
            gray: {
              50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db', 400: '#9ca3af',
              500: '#6b7280', 600: '#4b5563', 700: '#374151', 800: '#1f2937', 900: '#111827', 950: '#030712',
            },
            zinc: {
              50: '#fafafa', 100: '#f4f4f5', 200: '#e4e4e7', 300: '#d4d4d8', 400: '#a1a1aa',
              500: '#71717a', 600: '#52525b', 700: '#3f3f46', 800: '#27272a', 900: '#18181b', 950: '#09090b',
            },
            slate: {
              50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8',
              500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a', 950: '#020617',
            },
            purple: {
              50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe', 400: '#c084fc',
              500: '#a855f7', 600: '#9333ea', 700: '#7e22ce', 800: '#6b21a8', 900: '#581c87', 950: '#3b0764',
            },
            pink: {
              50: '#fdf2f8', 100: '#fce7f3', 200: '#fbcfe8', 300: '#f9a8d4', 400: '#f472b6',
              500: '#ec4899', 600: '#db2777', 700: '#be185d', 800: '#9d174d', 900: '#831843', 950: '#500724',
            },
            rose: {
              50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185',
              500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337', 950: '#4c0519',
            },
            amber: {
              50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24',
              500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f', 950: '#451a03',
            },
          },
        },
      },
    };
  </script>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; min-height: 100vh; font-family: 'Inter', 'Tajawal', system-ui, sans-serif; }
    #root { min-height: 100vh; }
    .bg-clip-text { -webkit-background-clip: text; background-clip: text; }
    .text-transparent { color: transparent; }
    ${safeCss}
  </style>
</head>
<body>
  <div id="root">
    <div id="wakti-boot-status" style="padding:40px;text-align:center;font-family:Inter,system-ui,sans-serif;">
      <div style="font-size:24px;margin-bottom:16px;">⏳</div>
      <div style="color:#666;">Loading app...</div>
    </div>
  </div>
  <script>
    window.__waktiBootLog = [];
    window.__waktiDepsLoading = true;
    function waktiRunnerNotify(type, payload) {
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ source: 'wakti-preview-runner', type, payload }, '*');
        }
      } catch {}
    }
    function waktiLog(msg) {
      window.__waktiBootLog.push('[' + new Date().toISOString() + '] ' + msg);
      console.log('[Wakti Boot]', msg);
    }
    window.onerror = function(msg, url, line, col, error) {
      waktiLog('UNCAUGHT ERROR: ' + msg + ' at ' + url + ':' + line);
      waktiRunnerNotify('error', { message: String(msg || 'Unknown runtime error'), stack: error && error.stack ? error.stack : '' });
      if (window.__waktiDepsLoading) {
        // Errors during best-effort CDN dependency loading (e.g. a third-party library's
        // own internal bug) are non-fatal by design - don't hijack the boot screen for these.
        waktiLog('Ignoring error during dependency loading phase (non-fatal)');
        return false;
      }
      var bootDiv = document.getElementById('wakti-boot-status');
      if (bootDiv) {
        bootDiv.innerHTML = '<div style="color:#f87171;font-size:18px;margin-bottom:16px;">❌ Error</div>' +
          '<pre style="background:#1e1e1e;padding:16px;border-radius:8px;text-align:left;overflow:auto;max-width:100%;font-size:12px;color:#f87171;">' + 
          msg + '\\n' + ((error && error.stack) || '') + '</pre>' +
          '<div style="color:#9ca3af;margin-top:16px;font-size:12px;">Check console for details</div>';
      }
      return false;
    };
    window.onunhandledrejection = function(e) {
      var message = e && e.reason && e.reason.message ? e.reason.message : (e && e.reason ? String(e.reason) : 'Unknown promise error');
      waktiLog('UNHANDLED PROMISE: ' + message);
      waktiRunnerNotify('error', { message: message });
    };
    waktiLog('Script block starting');
    waktiLog('React available: ' + (typeof React !== 'undefined'));
    waktiLog('ReactDOM available: ' + (typeof ReactDOM !== 'undefined'));
    function syncRuntimeGlobals(motionLabel) {
      var runtimeMotion = window.FramerMotion || window.Motion;
      waktiLog(motionLabel + ': ' + (!!runtimeMotion));
      if (runtimeMotion) {
        window.FramerMotion = runtimeMotion;
        window.motion = runtimeMotion.motion;
        window.AnimatePresence = runtimeMotion.AnimatePresence;
        window.useAnimation = runtimeMotion.useAnimation;
        window.useInView = runtimeMotion.useInView;
        window.useScroll = runtimeMotion.useScroll;
        window.useTransform = runtimeMotion.useTransform;
        window.useMotionValue = runtimeMotion.useMotionValue;
      }
      if (typeof window.lucide !== 'undefined' && window.lucide) {
        window.__lucideIcons = window.lucide;
      }
      return runtimeMotion;
    }
    syncRuntimeGlobals('Framer Motion available');
    if (typeof window.Recharts !== 'undefined' && window.Recharts) {
      waktiLog('Recharts available: true');
    } else {
      waktiLog('Recharts available: false');
    }

    function setBootError(message, details) {
      var bootDiv = document.getElementById('wakti-boot-status');
      if (!bootDiv) {
        return;
      }
      bootDiv.innerHTML = '<div style="color:#f87171;font-size:18px;margin-bottom:16px;">❌ Error</div>' +
        '<pre style="background:#1e1e1e;padding:16px;border-radius:8px;text-align:left;overflow:auto;max-width:100%;font-size:12px;color:#f87171;white-space:pre-wrap;">' +
        String(message || 'Unknown runtime error') + (details ? '\\n\\n' + details : '') + '</pre>' +
        '<div style="color:#9ca3af;margin-top:16px;font-size:12px;">The published app could not start.</div>';
    }

    function loadScriptWithTimeout(url, timeoutMs) {
      return new Promise(function(resolve, reject) {
        var script = document.createElement('script');
        var settled = false;
        var timeout = window.setTimeout(function() {
          if (settled) {
            return;
          }
          settled = true;
          script.remove();
          reject(new Error('Timed out loading ' + url));
        }, timeoutMs);

        script.src = url;
        script.async = true;
        script.onload = function() {
          if (settled) {
            return;
          }
          settled = true;
          window.clearTimeout(timeout);
          resolve(url);
        };
        script.onerror = function() {
          if (settled) {
            return;
          }
          settled = true;
          window.clearTimeout(timeout);
          script.remove();
          reject(new Error('Failed to load ' + url));
        };

        document.head.appendChild(script);
      });
    }

    async function loadFirstAvailable(label, urls, required) {
      var errors = [];
      for (var i = 0; i < urls.length; i += 1) {
        var url = urls[i];
        try {
          waktiLog('Loading ' + label + ' from ' + url);
          await loadScriptWithTimeout(url, 6000);
          waktiLog('Loaded ' + label + ' from ' + url);
          return url;
        } catch (error) {
          var message = error && error.message ? error.message : String(error);
          errors.push(message);
          waktiLog('Failed ' + label + ' from ' + url + ': ' + message);
        }
      }

      if (required) {
        throw new Error(label + ' failed to load. ' + errors.join(' | '));
      }

      return null;
    }

    async function ensureRuntimeDependencies() {
      await loadFirstAvailable('React', ${reactUrls}, true);
      await loadFirstAvailable('ReactDOM', ${reactDomUrls}, true);
      await Promise.allSettled([
        ${optionalLoadersJs}
      ]);
      if (${useBabelRuntime ? 'true' : 'false'}) {
        await loadFirstAvailable('Babel', ${babelUrls}, true);
      }
    }

    function executeBundledApp() {
      var source = ${encodedBundledJs};
      if (!source) {
        throw new Error('Bundled app source is empty');
      }

      if (${useBabelRuntime ? 'true' : 'false'}) {
        if (!window.Babel || typeof window.Babel.transform !== 'function') {
          throw new Error('Babel is not available for runtime compilation');
        }
        source = window.Babel.transform(source, { presets: ['react', 'typescript'] }).code;
      }

      var script = document.createElement('script');
      script.text = source;
      document.body.appendChild(script);
      script.remove();
      waktiLog('Bundled code executed');
    }
  </script>
  <script>
    function renderApp(retries) {
      retries = retries || 0;
      try {
        if (typeof window.App === 'undefined' || window.App === null) {
          if (retries < 120) {
            setTimeout(function() { renderApp(retries + 1); }, 100);
            return;
          }
          throw new Error('App component not found after ' + retries + ' attempts. window.App = ' + typeof window.App + '. Boot log: ' + window.__waktiBootLog.join(' | '));
        }
        var rootElement = document.getElementById('root');
        var root = ReactDOM.createRoot(rootElement);
        root.render(React.createElement(window.App));
        waktiLog('App rendered successfully');
        waktiRunnerNotify('ready', { ok: true });
      } catch (err) {
        var message = err && err.message ? err.message : String(err);
        waktiLog('RENDER ERROR: ' + message);
        console.error('[Wakti] Render error:', err);
        waktiRunnerNotify('error', { message: message, stack: err && err.stack ? err.stack : '' });
        document.getElementById('root').innerHTML = '<div style="padding:40px;text-align:center;color:#f87171;font-family:Inter,sans-serif;"><h2>Error loading app</h2><pre style="background:#1e1e1e;padding:20px;border-radius:8px;text-align:left;overflow:auto;max-width:100%;font-size:12px;">' + message + '</pre><details style="margin-top:20px;text-align:left;"><summary style="cursor:pointer;color:#9ca3af;">Boot Log</summary><pre style="background:#1e1e1e;padding:12px;border-radius:4px;font-size:10px;margin-top:8px;">' + (window.__waktiBootLog || []).join('\\n') + '</pre></details></div>';
      }
    }

    async function bootPublishedApp() {
      try {
        await ensureRuntimeDependencies();
        window.__waktiDepsLoading = false;

        syncRuntimeGlobals('Framer Motion available after load');

        executeBundledApp();
        renderApp(0);
      } catch (error) {
        var message = error && error.message ? error.message : String(error);
        waktiLog('BOOT ERROR: ' + message);
        setBootError(message, (window.__waktiBootLog || []).join('\\n'));
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { bootPublishedApp(); });
    } else {
      bootPublishedApp();
    }
  </script>
</body>
</html>`;
}
