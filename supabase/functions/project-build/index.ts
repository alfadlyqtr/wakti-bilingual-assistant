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
        // CRITICAL: Use REAL framer-motion from CDN.
        // NOTE: The UMD build from unpkg registers on window as window.Motion (not window.FramerMotion).
        // The publishing HTML must load the CDN script before the bundled JS.
        const FM = (typeof window !== 'undefined')
          ? (window.FramerMotion || window.Motion || null)
          : null;
        
        if (!FM) {
          console.warn('[framer-motion shim] Motion library not found on window (expected window.Motion from UMD build)');
        }
        
        // Export the REAL motion proxy from CDN (preserves ALL animation props like initial, animate, transition)
        const motion = FM ? FM.motion : new Proxy({}, {
          get: (_, tag) => {
            // Fallback: render element with inline animation via CSS
            return window.React.forwardRef((props, ref) => {
              const { 
                initial, animate, exit, transition, whileHover, whileTap, whileInView, 
                variants, style = {}, ...rest 
              } = props;
              
              // Apply animate values directly as style if initial opacity is 0
              let computedStyle = { ...style };
              if (animate && typeof animate === 'object') {
                if (animate.opacity !== undefined) computedStyle.opacity = animate.opacity;
                if (animate.y !== undefined) computedStyle.transform = 'translateY(' + animate.y + 'px)';
                if (animate.x !== undefined) computedStyle.transform = 'translateX(' + animate.x + 'px)';
                if (animate.scale !== undefined) computedStyle.transform = 'scale(' + animate.scale + ')';
              }
              // Add transition CSS
              if (transition && transition.duration) {
                computedStyle.transition = 'all ' + transition.duration + 's ease-out';
              }
              
              return window.React.createElement(tag, { ...rest, ref, style: computedStyle });
            });
          }
        });
        
        // Export REAL AnimatePresence from CDN
        const AnimatePresence = FM ? FM.AnimatePresence : ({ children, mode, initial, onExitComplete }) => children;
        
        // Export REAL hooks from CDN with proper fallbacks
        const useAnimation = FM && FM.useAnimation ? FM.useAnimation : () => ({ 
          start: () => Promise.resolve(), 
          stop: () => {},
          set: () => {}
        });
        const useInView = FM && FM.useInView ? FM.useInView : (ref, opts) => true;
        const useScroll = FM && FM.useScroll ? FM.useScroll : () => ({ 
          scrollY: { get: () => 0, set: () => {}, onChange: () => () => {} }, 
          scrollYProgress: { get: () => 0, onChange: () => () => {} },
          scrollX: { get: () => 0, set: () => {} },
          scrollXProgress: { get: () => 0 }
        });
        const useTransform = FM && FM.useTransform ? FM.useTransform : (value, inputRange, outputRange) => {
          // Simple linear transform fallback
          if (Array.isArray(inputRange) && Array.isArray(outputRange) && inputRange.length > 0) {
            return outputRange[0];
          }
          return 0;
        };
        const useMotionValue = FM && FM.useMotionValue ? FM.useMotionValue : (init) => ({ 
          get: () => init, 
          set: () => {},
          onChange: () => () => {}
        });
        const useSpring = FM && FM.useSpring ? FM.useSpring : (value, config) => value;
        const useMotionTemplate = FM && FM.useMotionTemplate ? FM.useMotionTemplate : (...args) => args.join('');
        const useReducedMotion = FM && FM.useReducedMotion ? FM.useReducedMotion : () => false;
        const useAnimate = FM && FM.useAnimate ? FM.useAnimate : () => [null, () => Promise.resolve()];
        const usePresence = FM && FM.usePresence ? FM.usePresence : () => [true, () => {}];
        const useIsPresent = FM && FM.useIsPresent ? FM.useIsPresent : () => true;
        
        // Motion components for legacy usage
        const m = motion;
        
        // Additional exports that some projects might use
        const domAnimation = {};
        const domMax = {};
        const LazyMotion = ({ children }) => children;
        const MotionConfig = ({ children }) => children;
        const LayoutGroup = ({ children }) => children;
        const Reorder = FM && FM.Reorder ? FM.Reorder : { Group: ({ children }) => children, Item: motion.div };
        
        export { 
          motion, m, AnimatePresence, 
          useAnimation, useInView, useScroll, useTransform, useMotionValue, useSpring,
          useMotionTemplate, useReducedMotion, useAnimate, usePresence, useIsPresent,
          domAnimation, domMax, LazyMotion, MotionConfig, LayoutGroup, Reorder
        };
        export default { motion, AnimatePresence };
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
            // Normalize language to base code (en-US -> en)
            if (options?.lng) this.language = options.lng.split(/[-_]/)[0];
            if (options?.fallbackLng && !options?.lng) {
              const fb = Array.isArray(options.fallbackLng) ? options.fallbackLng[0] : options.fallbackLng;
              this.language = fb.split(/[-_]/)[0];
            }
            if (options?.resources) this.resources = options.resources;
            // CRITICAL: Expose to window so react-i18next can find it
            window.__i18n = this;
            return Promise.resolve(this); 
          },
          t: function(key, options) {
            // Normalize language to base code
            const lng = (this.language || 'en').split(/[-_]/)[0];
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
            // Normalize language to base code
            this.language = (lng || 'en').split(/[-_]/)[0];
            window.dispatchEvent(new CustomEvent('languageChanged', { detail: this.language }));
            return Promise.resolve(this); 
          },
          dir: function(lng) { 
            const baseLng = (lng || this.language || 'en').split(/[-_]/)[0];
            return baseLng === 'ar' ? 'rtl' : 'ltr'; 
          },
          on: function() { return this; },
          off: function() { return this; },
          exists: () => true,
          getFixedT: function() { return (key) => this.t(key); },
          hasResourceBundle: () => true,
          addResourceBundle: function(lng, ns, res) { 
            const baseLng = lng.split(/[-_]/)[0];
            if (!this.resources[baseLng]) this.resources[baseLng] = {};
            this.resources[baseLng][ns] = { ...this.resources[baseLng][ns], ...res };
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
    // Added icons for publishing support
    Feather: ['M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z', 'M16 8L2 22', 'M17.5 15H9'],
    Crown: ['M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z'],
    Medal: ['M7.21 15L2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15'],
    Trophy: ['M6 9H4.5a2.5 2.5 0 0 1 0-5H6', 'M18 9h1.5a2.5 2.5 0 0 0 0-5H18', 'M4 22h16', 'M18 2H6v7a6 6 0 0 0 12 0V2z'],
    Flame: ['M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z'],
    Flower: ['M12 7.5a4.5 4.5 0 1 1 4.5 4.5M12 7.5A4.5 4.5 0 1 0 7.5 12M12 7.5V9m-4.5 3a4.5 4.5 0 1 0 4.5 4.5M7.5 12H9m7.5 0a4.5 4.5 0 1 1-4.5 4.5m4.5-4.5H15m-3 4.5V15'],
    Leaf: ['M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z', 'M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12'],
    Rainbow: ['M22 17a10 10 0 0 0-20 0', 'M6 17a6 6 0 0 1 12 0', 'M10 17a2 2 0 0 1 4 0'],
    Snowflake: ['M2 12h20', 'M12 2v20', 'M20 16l-4-4 4-4', 'M4 8l4 4-4 4', 'M16 4l-4 4-4-4', 'M8 20l4-4 4 4'],
    CloudRain: ['M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242', 'M16 14v6', 'M8 14v6', 'M12 16v6'],
    Wind: ['M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2', 'M9.6 4.6A2 2 0 1 1 11 8H2', 'M12.6 19.4A2 2 0 1 0 14 16H2'],
    Music: ['M9 18V5l12-2v13'],
    Mic: ['M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z', 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 19v3'],
    Headphones: ['M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3'],
    Video: ['M22 8l-6 4 6 4V8z', 'M2 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2V6z'],
    Camera: ['M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z'],
    Image: ['M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z', 'M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z', 'M21 15l-5-5L5 21'],
    Coffee: ['M17 8h1a4 4 0 1 1 0 8h-1', 'M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z', 'M6 2v4', 'M10 2v4', 'M14 2v4'],
    Pizza: ['M15 11h.01', 'M11 15h.01', 'M16 16h.01', 'M2 16l20 6-6-20A20 20 0 0 0 2 16', 'M5.71 17.11a17.04 17.04 0 0 1 11.4-11.4'],
    Cake: ['M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8', 'M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1', 'M2 21h20', 'M7 8v2', 'M12 8v2', 'M17 8v2', 'M7 4h.01', 'M12 4h.01', 'M17 4h.01'],
    Car: ['M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2'],
    Truck: ['M10 17h4V5H2v12h3', 'M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5', 'M14 17h1'],
    Plane: ['M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1V17l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2C18.7 20 18.9 19.6 17.8 19.2z'],
    Rocket: ['M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z', 'M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z', 'M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0', 'M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5'],
    Building: ['M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18z', 'M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2', 'M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2', 'M10 6h4', 'M10 10h4', 'M10 14h4', 'M10 18h4'],
    Key: ['M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4'],
    Pencil: ['M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z'],
    Brush: ['M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08', 'M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z'],
    Palette: ['M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z'],
    Scissors: ['M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M20 4L8.12 15.88', 'M14.47 14.48L20 20', 'M8.12 8.12L12 12'],
    Lightbulb: ['M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5', 'M9 18h6', 'M10 22h4'],
    Gem: ['M6 3h12l4 6-10 13L2 9z', 'M11 3l8 6-7 13-7-13 6-6', 'M2 9h20'],
    Diamond: ['M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0z'],
    Sparkle: ['M12 3l-1.9 5.8a2 2 0 0 1-1.287 1.288L3 12l5.8 1.9a2 2 0 0 1 1.288 1.287L12 21l1.9-5.8a2 2 0 0 1 1.287-1.288L21 12l-5.8-1.9a2 2 0 0 1-1.288-1.287z'],
    PartyPopper: ['M5.8 11.3L2 22l10.7-3.79', 'M4 3h.01', 'M22 8h.01', 'M15 2h.01', 'M22 20h.01', 'M22 2l-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10', 'M22 13l-.82-.33c-.86-.34-1.82.2-1.98 1.11-.11.7-.72 1.22-1.43 1.22H17', 'M11 2l.33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7', 'M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2z'],
    Angry: ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M16 16s-1.5-2-4-2-4 2-4 2', 'M7.5 8L10 9', 'M14 9l2.5-1', 'M9 10h.01', 'M15 10h.01'],
    Laugh: ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M18 13a6 6 0 0 1-6 5 6 6 0 0 1-6-5h12z', 'M9 9h.01', 'M15 9h.01'],
    Frown: ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M16 16s-1.5-2-4-2-4 2-4 2', 'M9 9h.01', 'M15 9h.01'],
    Meh: ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M8 15h8', 'M9 9h.01', 'M15 9h.01'],
    HeartCrack: ['M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z', 'M12 13l-1-1 2-2-3-2.5 2-2'],
    Users: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
    UserPlus: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M19 8v6', 'M22 11h-6'],
    UserMinus: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M22 11h-6'],
    UserCheck: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M16 11l2 2 4-4'],
    Shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
    ShieldCheck: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M9 12l2 2 4-4'],
    Verified: ['M12 2l2.4 2.4 3.4-.4-.4 3.4L20 10l-2.4 2.4.4 3.4-3.4-.4L12 18l-2.4-2.4-3.4.4.4-3.4L4 10l2.4-2.4-.4-3.4 3.4.4L12 2z', 'M9 12l2 2 4-4'],
    BadgeCheck: ['M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76z', 'M9 12l2 2 4-4'],
    HelpCircle: ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3', 'M12 17h.01'],
    MessageSquare: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
    Reply: ['M9 17H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3.5', 'M21 15l-5 5', 'M21 10l-5 5'],
    Forward: ['M15 17H9a2 2 0 0 0-2 2v0a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3.5', 'M3 9l5-5', 'M3 14l5-5'],
    FileText: ['M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8', 'M10 9H8'],
    Clipboard: ['M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2', 'M8 2h8a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z'],
    ClipboardCheck: ['M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2', 'M8 2h8a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z', 'M9 14l2 2 4-4'],
    StickyNote: ['M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3z', 'M15 3v6h6'],
    Pin: ['M12 17v5', 'M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z'],
    Paperclip: ['M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48'],
    AtSign: ['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8'],
    Hash: ['M4 9h16', 'M4 15h16', 'M10 3l-2 18', 'M16 3l-2 18'],
    DollarSign: ['M12 2v20', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'],
    CreditCard: ['M2 5h20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M2 10h22'],
    Wallet: ['M21 12V7H5a2 2 0 0 1 0-4h14v4', 'M3 5v14a2 2 0 0 0 2 2h16v-5', 'M18 12a2 2 0 0 0 0 4h4v-4z'],
    ShoppingBag: ['M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z', 'M3 6h18', 'M16 10a4 4 0 0 1-8 0'],
    ShoppingCart: ['M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6'],
    Package: ['M7.5 4.27l9 5.15', 'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z', 'M3.3 7l8.7 5 8.7-5', 'M12 22V12'],
    Timer: ['M10 2h4', 'M12 14l0-4', 'M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z'],
    Hourglass: ['M5 22h14', 'M5 2h14', 'M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22', 'M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2'],
    AlarmClock: ['M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M12 9v4l2 2', 'M5 3L2 6', 'M22 6l-3-3', 'M6.38 18.7L4 21', 'M17.64 18.67L20 21'],
    Wifi: ['M5 13a10 10 0 0 1 14 0', 'M8.5 16.5a5 5 0 0 1 7 0', 'M2 8.82a15 15 0 0 1 20 0', 'M12 20h.01'],
    WifiOff: ['M2 2l20 20', 'M8.5 16.5a5 5 0 0 1 7 0', 'M2 8.82a15 15 0 0 1 4.17-2.65', 'M10.66 5c4.01-.36 8.14.9 11.34 3.76', 'M16.85 11.25a10 10 0 0 1 2.22 1.68', 'M5 13a10 10 0 0 1 5.24-2.76', 'M12 20h.01'],
    Bluetooth: ['M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11'],
    Battery: ['M2 7h16a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z', 'M22 11v2'],
    Signal: ['M2 20h.01', 'M7 20v-4', 'M12 20v-8', 'M17 20V8', 'M22 4v16'],
    Smartphone: ['M5 2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z', 'M12 18h.01'],
    Tablet: ['M4 2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z', 'M12 18h.01'],
    Laptop: ['M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0l1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16'],
    Monitor: ['M2 3h20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M8 21h8', 'M12 17v4'],
    Tv: ['M2 7h20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z', 'M17 2l-5 5-5-5'],
    Server: ['M2 2h20a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z', 'M2 14h20a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z', 'M6 6h.01', 'M6 18h.01'],
    Database: ['M12 2c-5.523 0-10 1.5-10 4v12c0 2.5 4.477 4 10 4s10-1.5 10-4V6c0-2.5-4.477-4-10-4z', 'M2 6c0 2.5 4.477 4 10 4s10-1.5 10-4'],
    Cloud: ['M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z'],
    CloudUpload: ['M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242', 'M12 12v9', 'M16 16l-4-4-4 4'],
    CloudDownload: ['M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242', 'M12 13v9', 'M8 17l4 4 4-4'],
    Map: ['M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z', 'M8 2v16', 'M16 6v16'],
    Compass: ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z'],
    Navigation: ['M3 11l19-9-9 19-2-8-8-2z'],
    Printer: ['M6 9V2h12v7', 'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2', 'M6 14h12v8H6z'],
    QrCode: ['M3 3h5v5H3z', 'M16 3h5v5h-5z', 'M3 16h5v5H3z', 'M21 16h-3a2 2 0 0 0-2 2v3', 'M21 21v.01', 'M12 7v3a2 2 0 0 1-2 2H7', 'M3 12h.01', 'M12 3h.01', 'M12 16v.01', 'M16 12h1', 'M21 12v.01', 'M12 21v-1'],
    Scan: ['M3 7V5a2 2 0 0 1 2-2h2', 'M17 3h2a2 2 0 0 1 2 2v2', 'M21 17v2a2 2 0 0 1-2 2h-2', 'M7 21H5a2 2 0 0 1-2-2v-2'],
    Fingerprint: ['M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4', 'M14 13.12c0 2.38 0 6.38-1 8.88', 'M17.29 21.02c.12-.6.43-2.3.5-3.02', 'M2 12a10 10 0 0 1 18-6', 'M2 16h.01', 'M21.8 16c.2-2 .131-5.354 0-6', 'M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2', 'M8.65 22c.21-.66.45-1.32.57-2', 'M9 6.8a6 6 0 0 1 9 5.2v2'],
    Move: ['M5 9l-3 3 3 3', 'M9 5l3-3 3 3', 'M15 19l-3 3-3-3', 'M19 9l3 3-3 3', 'M2 12h20', 'M12 2v20'],
    Maximize: ['M8 3H5a2 2 0 0 0-2 2v3', 'M21 8V5a2 2 0 0 0-2-2h-3', 'M3 16v3a2 2 0 0 0 2 2h3', 'M16 21h3a2 2 0 0 0 2-2v-3'],
    Minimize: ['M8 3v3a2 2 0 0 1-2 2H3', 'M21 8h-3a2 2 0 0 1-2-2V3', 'M3 16h3a2 2 0 0 1 2 2v3', 'M16 21v-3a2 2 0 0 1 2-2h3'],
    Expand: ['M21 21l-6-6m6 6v-4.8m0 4.8h-4.8', 'M3 16.2V21m0 0h4.8M3 21l6-6', 'M21 7.8V3m0 0h-4.8M21 3l-6 6', 'M3 7.8V3m0 0h4.8M3 3l6 6'],
    Shrink: ['M15 15l6 6m-6-6v4.8m0-4.8h4.8', 'M9 19.8V15m0 0H4.2M9 15l-6 6', 'M15 4.2V9m0 0h4.8M15 9l6-6', 'M9 4.2V9m0 0H4.2M9 9L3 3'],
    RotateCcw: ['M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5'],
    Repeat: ['M17 2l4 4-4 4', 'M3 11V9a4 4 0 0 1 4-4h14', 'M7 22l-4-4 4-4', 'M21 13v2a4 4 0 0 1-4 4H3'],
    Shuffle: ['M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22', 'M18 2l4 4-4 4', 'M2 6h1.9c1.5 0 2.9.9 3.6 2.2', 'M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8', 'M18 14l4 4-4 4'],
    FastForward: ['M13 19l9-7-9-7v14z', 'M2 19l9-7-9-7v14z'],
    Rewind: ['M11 19l-9-7 9-7v14z', 'M22 19l-9-7 9-7v14z'],
    SkipForward: ['M5 4l10 8-10 8V4z', 'M19 5v14'],
    SkipBack: ['M19 20L9 12l10-8v16z', 'M5 19V5'],
    PlayCircle: ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M10 8l6 4-6 4V8z'],
    PauseCircle: ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M10 15V9', 'M14 15V9'],
    StopCircle: ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M9 9h6v6H9z'],
    Volume: ['M11 5L6 9H2v6h4l5 4V5z'],
    Volume2: ['M11 5L6 9H2v6h4l5 4V5z', 'M15.54 8.46a5 5 0 0 1 0 7.07', 'M19.07 4.93a10 10 0 0 1 0 14.14'],
    VolumeX: ['M11 5L6 9H2v6h4l5 4V5z', 'M22 9l-6 6', 'M16 9l6 6'],
    MicOff: ['M2 2l20 20', 'M18.89 13.23A7.12 7.12 0 0 0 19 12V10', 'M5 10v2a7 7 0 0 0 12 5', 'M15 9.34V5a3 3 0 0 0-5.68-1.33', 'M9 9v3a3 3 0 0 0 5.12 2.12', 'M12 19v4'],
    VideoOff: ['M10.66 6H14a2 2 0 0 1 2 2v2.34l1 1L22 8v8', 'M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2l10 10z', 'M2 2l20 20'],
    CameraOff: ['M2 2l20 20', 'M7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16', 'M9.5 4h5L17 7h4a2 2 0 0 1 2 2v7.5', 'M14.121 15.121A3 3 0 1 1 9.88 10.88'],
    Type: ['M4 7V4h16v3', 'M9 20h6', 'M12 4v16'],
    Bold: ['M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z', 'M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z'],
    Italic: ['M19 4h-9', 'M14 20H5', 'M15 4L9 20'],
    Underline: ['M6 4v6a6 6 0 0 0 12 0V4', 'M4 20h16'],
    AlignLeft: ['M21 6H3', 'M15 12H3', 'M17 18H3'],
    AlignCenter: ['M21 6H3', 'M17 12H7', 'M19 18H5'],
    AlignRight: ['M21 6H3', 'M21 12H9', 'M21 18H7'],
    AlignJustify: ['M3 6h18', 'M3 12h18', 'M3 18h18'],
    Undo: ['M3 7v6h6', 'M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13'],
    Redo: ['M21 7v6h-6', 'M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13'],
    Quote: ['M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21c0 1 0 1 1 1z', 'M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z'],
    Link: ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
    LinkOff: ['M2 2l20 20', 'M9 9a5 5 0 0 0 6.89 6.89', 'M14.71 14.71a5 5 0 0 0-7.07 0l-1.72 1.72', 'M16.24 7.76a5 5 0 0 1 0 7.07'],
    Unlink: ['M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M5.16 11.75l-1.72 1.71a5 5 0 0 0 7.07 7.07l1.72-1.71', 'M8 2v3', 'M2 8h3', 'M16 22v-3', 'M22 16h-3'],
    GripVertical: ['M9 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M9 5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M9 19a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M15 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M15 5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M15 19a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'],
    GripHorizontal: ['M12 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M19 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M5 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M12 15a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M19 15a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M5 15a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'],
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
