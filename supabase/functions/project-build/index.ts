import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// @ts-ignore - esbuild WASM for Deno Edge (no cache directory needed)
import * as esbuild from "https://deno.land/x/esbuild@v0.20.1/wasm.js";

// Initialize esbuild WASM once (singleton pattern for edge runtime)
let esbuildInitialized = false;
const initializeEsbuild = async () => {
  if (esbuildInitialized) return;
  try {
    await esbuild.initialize({
      wasmURL: "https://unpkg.com/esbuild-wasm@0.20.1/esbuild.wasm",
      worker: false, // Edge runtime doesn't support workers
    });
    esbuildInitialized = true;
    console.log("esbuild WASM initialized successfully");
  } catch (error) {
    // If already initialized, that's fine
    if (error instanceof Error && error.message.includes("initialized")) {
      esbuildInitialized = true;
      console.log("esbuild was already initialized");
    } else {
      throw error;
    }
  }
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface BuildRequest {
  files: Record<string, string>; // { "/App.js": "...", "/components/Modal.jsx": "..." }
  entryPoint?: string; // Default: "/App.js"
}

interface BuildResponse {
  success: boolean;
  bundle?: {
    js: string;
    css: string;
  };
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize esbuild WASM first
    const startTime = Date.now();
    await initializeEsbuild();
    console.log(`esbuild init took ${Date.now() - startTime}ms`);

    const { files, entryPoint = "/App.js" }: BuildRequest = await req.json();

    if (!files || Object.keys(files).length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No files provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Building project with ${Object.keys(files).length} files, entry: ${entryPoint}`);

    // Collect all CSS content
    const cssFiles: string[] = [];
    for (const [path, content] of Object.entries(files)) {
      if (path.endsWith('.css')) {
        // Remove @tailwind directives (we use CDN)
        let css = content.replace(/@tailwind\s+[^;]+;/g, '');
        css = css.replace(/@import\s+url\([^)]+\);?/g, '');
        cssFiles.push(`/* ${path} */\n${css}`);
      }
    }

    // Create shim content for external packages
    const packageShims: Record<string, string> = {
      'react': `
        export const useState = window.React.useState;
        export const useEffect = window.React.useEffect;
        export const useRef = window.React.useRef;
        export const useCallback = window.React.useCallback;
        export const useMemo = window.React.useMemo;
        export const useContext = window.React.useContext;
        export const createContext = window.React.createContext;
        export const forwardRef = window.React.forwardRef;
        export const memo = window.React.memo;
        export const lazy = window.React.lazy;
        export const Suspense = window.React.Suspense;
        export const Fragment = window.React.Fragment;
        export const createElement = window.React.createElement;
        export const cloneElement = window.React.cloneElement;
        export const isValidElement = window.React.isValidElement;
        export const Children = window.React.Children;
        export default window.React;
      `,
      'react-dom': `
        export const createRoot = window.ReactDOM.createRoot;
        export const createPortal = window.ReactDOM.createPortal;
        export const flushSync = window.ReactDOM.flushSync;
        export default window.ReactDOM;
      `,
      'react-dom/client': `
        export const createRoot = window.ReactDOM.createRoot;
        export const hydrateRoot = window.ReactDOM.hydrateRoot;
      `,
      'framer-motion': `
        const motionProxy = new Proxy({}, {
          get: (_, tag) => {
            const Component = window.React.forwardRef((props, ref) => {
              const { initial, animate, exit, transition, whileHover, whileTap, whileInView, variants, ...rest } = props;
              return window.React.createElement(tag, { ...rest, ref });
            });
            return Component;
          }
        });
        export const motion = motionProxy;
        export const AnimatePresence = ({ children }) => children;
        export const useAnimation = () => ({ start: () => {}, stop: () => {} });
        export const useInView = () => true;
        export const useScroll = () => ({ scrollY: { get: () => 0 } });
        export const useTransform = () => 0;
      `,
      'lucide-react': getLucideShim(),
      'i18next': `
        // Create i18n instance and expose to window for react-i18next shim
        const i18n = {
          language: 'en',
          languages: ['en', 'ar'],
          resources: {},
          use: function() { return this; },
          init: function(options) { 
            if (options?.lng) this.language = options.lng;
            if (options?.fallbackLng && !options?.lng) this.language = options.fallbackLng;
            if (options?.resources) this.resources = options.resources;
            // CRITICAL: Expose to window so react-i18next can find it
            window.__i18n = this;
            return Promise.resolve(this); 
          },
          t: function(key, options) {
            const lng = this.language || 'en';
            const ns = options?.ns || 'translation';
            try {
              const langResources = this.resources[lng]?.[ns] || this.resources[lng]?.translation || {};
              if (langResources[key]) return langResources[key];
              const parts = key.split('.');
              let value = langResources;
              for (const part of parts) { value = value?.[part]; }
              if (value && typeof value === 'string') return value;
            } catch (e) {}
            return key;
          },
          changeLanguage: function(lng) { 
            this.language = lng || 'en';
            window.dispatchEvent(new CustomEvent('languageChanged', { detail: lng }));
            return Promise.resolve(this); 
          },
          dir: function(lng) { return (lng || this.language)?.startsWith('ar') ? 'rtl' : 'ltr'; },
          on: function() { return this; },
          off: function() { return this; },
          exists: () => true,
          getFixedT: function() { return (key) => this.t(key); },
          hasResourceBundle: () => true,
          addResourceBundle: function(lng, ns, res) { 
            if (!this.resources[lng]) this.resources[lng] = {};
            this.resources[lng][ns] = { ...this.resources[lng][ns], ...res };
            return this; 
          }
        };
        // Also expose immediately (before init is called)
        window.__i18n = i18n;
        export default i18n;
        export { i18n };
      `,
      'react-i18next': `
        const useTranslation = (ns) => {
          const [, forceUpdate] = window.React.useState(0);
          window.React.useEffect(() => {
            const handler = () => forceUpdate(n => n + 1);
            window.addEventListener('languageChanged', handler);
            return () => window.removeEventListener('languageChanged', handler);
          }, []);
          const i18nRef = window.__i18n || { t: (k) => k, language: 'en', changeLanguage: () => {}, dir: () => 'ltr' };
          return { t: (key, opts) => i18nRef.t(key, { ns, ...opts }), i18n: i18nRef };
        };
        export { useTranslation };
        export const initReactI18next = { type: '3rdParty', init: () => {} };
        export const I18nextProvider = ({ children }) => children;
        export const Trans = ({ children }) => children;
      `,
      'i18next-browser-languagedetector': `
        export default class LanguageDetector { 
          static type = 'languageDetector';
          detect() { return navigator.language?.split('-')[0] || 'en'; }
          cacheUserLanguage() {}
        }
      `,
      'clsx': `
        export default function clsx(...args) {
          return args.flat().filter(Boolean).join(' ');
        }
        export { clsx };
      `,
      'tailwind-merge': `
        export function twMerge(...args) {
          return args.flat().filter(Boolean).join(' ');
        }
      `,
      'class-variance-authority': `
        export function cva(base, config) {
          return (props) => {
            let result = base || '';
            if (config?.variants && props) {
              for (const [key, value] of Object.entries(props)) {
                if (config.variants[key]?.[value]) {
                  result += ' ' + config.variants[key][value];
                }
              }
            }
            return result;
          };
        }
      `
    };

    // Create a virtual file system plugin for esbuild
    const virtualFsPlugin: esbuild.Plugin = {
      name: "virtual-fs",
      setup(build) {
        // Resolve all imports
        build.onResolve({ filter: /.*/ }, (args) => {
          // Check if it's a shimmed package
          for (const pkg of Object.keys(packageShims)) {
            if (args.path === pkg || args.path.startsWith(pkg + '/')) {
              return { path: pkg, namespace: 'shim' };
            }
          }

          // Resolve relative imports
          if (args.path.startsWith('./') || args.path.startsWith('../')) {
            let resolvedPath = resolvePath(args.path, args.importer || entryPoint);
            
            // Try with extensions
            const extensions = ['', '.js', '.jsx', '.ts', '.tsx', '.json'];
            for (const ext of extensions) {
              const fullPath = resolvedPath + ext;
              if (files[fullPath]) {
                return { path: fullPath, namespace: 'virtual' };
              }
            }
            
            // Try index files
            for (const idx of ['/index.js', '/index.jsx', '/index.ts', '/index.tsx']) {
              const fullPath = resolvedPath + idx;
              if (files[fullPath]) {
                return { path: fullPath, namespace: 'virtual' };
              }
            }
            
            console.warn(`Could not resolve: ${args.path} from ${args.importer}`);
            // Return empty module instead of external
            return { path: args.path, namespace: 'empty' };
          }

          // Entry point
          if (args.path === entryPoint || args.path === entryPoint.replace(/^\//, '')) {
            return { path: entryPoint, namespace: 'virtual' };
          }

          // Absolute paths in our virtual fs
          if (args.path.startsWith('/') && files[args.path]) {
            return { path: args.path, namespace: 'virtual' };
          }

          // Unknown packages - return empty module
          console.warn(`Unknown package: ${args.path}`);
          return { path: args.path, namespace: 'empty' };
        });

        // Load shim content
        build.onLoad({ filter: /.*/, namespace: 'shim' }, (args) => {
          const shimContent = packageShims[args.path] || 'export default {};';
          return { contents: shimContent, loader: 'js' };
        });

        // Load empty modules for unknown
        build.onLoad({ filter: /.*/, namespace: 'empty' }, () => {
          return { contents: 'export default {};', loader: 'js' };
        });

        // Load file contents
        build.onLoad({ filter: /.*/, namespace: 'virtual' }, (args) => {
          const content = files[args.path];
          if (!content) {
            return { contents: '', loader: 'js' };
          }

          // Determine loader based on extension
          let loader: esbuild.Loader = 'jsx';
          if (args.path.endsWith('.ts')) loader = 'ts';
          if (args.path.endsWith('.tsx')) loader = 'tsx';
          if (args.path.endsWith('.json')) loader = 'json';
          if (args.path.endsWith('.css')) loader = 'css';

          return { contents: content, loader };
        });
      }
    };

    // Helper to resolve relative paths
    function resolvePath(importPath: string, importer: string): string {
      const importerDir = importer.substring(0, importer.lastIndexOf('/')) || '';
      const parts = importPath.split('/');
      const resolvedParts = importerDir.split('/').filter(p => p);

      for (const part of parts) {
        if (part === '.') continue;
        if (part === '..') resolvedParts.pop();
        else resolvedParts.push(part);
      }

      return '/' + resolvedParts.join('/');
    }

    // Run esbuild - NO externals, everything is bundled via shims
    const result = await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      write: false,
      format: 'iife',
      globalName: 'AppBundle',
      platform: 'browser',
      target: ['es2020'],
      jsx: 'transform',
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment',
      plugins: [virtualFsPlugin],
      // NO externals - everything is resolved via shims
      minify: false,
      sourcemap: false,
    });

    // Note: Don't call esbuild.stop() in WASM mode - it's managed differently
    // and calling stop() can cause issues with subsequent builds

    // Get the bundled JS
    const bundledJs = result.outputFiles?.[0]?.text || '';

    // Build the final bundle with shims
    const finalBundle = buildFinalBundle(bundledJs, cssFiles.join('\n\n'));

    const buildTime = Date.now() - startTime;
    console.log(`Build successful in ${buildTime}ms: ${finalBundle.js.length} bytes JS, ${finalBundle.css.length} bytes CSS`);

    return new Response(
      JSON.stringify({ success: true, bundle: finalBundle }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Build error:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : 'No stack');
    // Don't call esbuild.stop() in catch - may not be initialized
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown build error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildFinalBundle(bundledJs: string, css: string): { js: string; css: string } {
  // The bundled code already contains all shims via the virtual module system
  // We just need to expose the App component globally
  const wrappedJs = `
// ========== BUNDLED APP WITH SHIMS ==========
// Store i18n globally for react-i18next shim
(function() {
${bundledJs}

// Extract the default export (App component) and make it global
if (typeof AppBundle !== 'undefined' && AppBundle.default) {
  window.App = AppBundle.default;
} else if (typeof AppBundle !== 'undefined') {
  window.App = AppBundle;
}
})();
`;

  return { js: wrappedJs, css };
}

// Generate Lucide icons shim as ES module exports
function getLucideShim(): string {
  const icons: Record<string, string[]> = {
    Heart: ['M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'],
    Sparkles: ['M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z'],
    Gift: ['M20 12v10H4V12', 'M2 7h20v5H2z', 'M12 22V7', 'M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z', 'M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z'],
    Smile: ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M8 14s1.5 2 4 2 4-2 4-2'],
    BookOpen: ['M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z', 'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'],
    Languages: ['M5 8l6 6', 'M4 14l6-6 2-3', 'M2 5h12', 'M7 2v3', 'M22 22l-5-10-5 10', 'M14 18h6'],
    Star: ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'],
    Check: ['M20 6L9 17l-5-5'],
    X: ['M18 6L6 18', 'M6 6l12 12'],
    Menu: ['M3 12h18', 'M3 6h18', 'M3 18h18'],
    ChevronRight: ['M9 18l6-6-6-6'],
    ChevronLeft: ['M15 18l-6-6 6-6'],
    ChevronUp: ['M18 15l-6-6-6 6'],
    ChevronDown: ['M6 9l6 6 6-6'],
    ArrowRight: ['M5 12h14', 'M12 5l7 7-7 7'],
    ArrowLeft: ['M19 12H5', 'M12 19l-7-7 7-7'],
    ArrowUp: ['M12 19V5', 'M5 12l7-7 7 7'],
    ArrowDown: ['M12 5v14', 'M19 12l-7 7-7-7'],
    Search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35'],
    User: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
    Settings: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
    Home: ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
    Mail: ['M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z', 'M22 6l-10 7L2 6'],
    Phone: ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72'],
    MapPin: ['M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z', 'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
    Clock: ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M12 6v6l4 2'],
    Calendar: ['M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z', 'M16 2v4', 'M8 2v4', 'M3 10h18'],
    Plus: ['M12 5v14', 'M5 12h14'],
    Minus: ['M5 12h14'],
    Edit: ['M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'],
    Trash: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
    Download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
    Upload: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12'],
    Share: ['M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8', 'M16 6l-4-4-4 4', 'M12 2v13'],
    ExternalLink: ['M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6', 'M15 3h6v6', 'M10 14L21 3'],
    Copy: ['M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
    Info: ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M12 16v-4', 'M12 8h.01'],
    AlertCircle: ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M12 8v4', 'M12 16h.01'],
    CheckCircle: ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M9 12l2 2 4-4'],
    XCircle: ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M15 9l-6 6', 'M9 9l6 6'],
    Globe: ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M2 12h20'],
    Lock: ['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z', 'M7 11V7a5 5 0 0 1 10 0v4'],
    Eye: ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
    EyeOff: ['M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94', 'M1 1l22 22'],
    Play: ['M5 3l14 9-14 9V3z'],
    Pause: ['M6 4h4v16H6z', 'M14 4h4v16h-4z'],
    Sun: ['M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z'],
    Moon: ['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'],
    Send: ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4 20-7z'],
    Bell: ['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9'],
    MessageCircle: ['M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z'],
    RefreshCw: ['M23 4v6h-6', 'M1 20v-6h6'],
    Loader: ['M12 2v4', 'M12 18v4', 'M4.93 4.93l2.83 2.83', 'M16.24 16.24l2.83 2.83'],
    Zap: ['M13 2L3 14h9l-1 8 10-12h-9l1-8z'],
    Award: ['M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14z'],
    Target: ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z'],
    TrendingUp: ['M23 6l-9.5 9.5-5-5L1 18'],
    Bookmark: ['M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z'],
    Tag: ['M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z'],
    Folder: ['M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'],
    Filter: ['M22 3H2l8 9.46V19l4 2v-8.54L22 3z'],
    Save: ['M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z'],
    LogIn: ['M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4'],
    LogOut: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4'],
    MoreHorizontal: ['M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'],
    MoreVertical: ['M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M12 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M12 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'],
    Activity: ['M22 12h-4l-3 9L9 3l-3 9H2'],
    BarChart: ['M12 20V10', 'M18 20V4', 'M6 20v-4'],
    Grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
    List: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
    Code: ['M16 18l6-6-6-6', 'M8 6l-6 6 6 6'],
    Terminal: ['M4 17l6-6-6-6', 'M12 19h8'],
    Layers: ['M12 2L2 7l10 5 10-5-10-5z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'],
  };

  // Generate export statements for each icon
  const iconExports = Object.entries(icons).map(([name, paths]) => {
    const pathsStr = JSON.stringify(paths);
    return `export const ${name} = (props) => window.React.createElement('svg', {
  xmlns: 'http://www.w3.org/2000/svg',
  width: props?.size || 24,
  height: props?.size || 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  className: props?.className || '',
  ...props
}, ${pathsStr}.map((d, i) => window.React.createElement('path', { key: i, d })));`;
  }).join('\n\n');

  return iconExports;
}
