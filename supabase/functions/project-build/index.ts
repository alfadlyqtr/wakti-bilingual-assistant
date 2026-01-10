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
  // The bundled code creates AppBundle as an IIFE result
  // We need to execute it first, then extract the App component
  // IMPORTANT: Don't wrap in another IIFE - let AppBundle be global
  const wrappedJs = `
// ========== BUNDLED APP WITH SHIMS ==========
// Execute the bundle (this creates window.AppBundle or var AppBundle)
${bundledJs}

// Extract the App component and make it globally accessible
(function() {
  try {
    // Check both window.AppBundle and local AppBundle (esbuild IIFE creates local var)
    var bundle = (typeof AppBundle !== 'undefined') ? AppBundle : window.AppBundle;
    
    console.log('[Wakti Build] bundle type:', typeof bundle);
    if (bundle) {
      console.log('[Wakti Build] bundle keys:', Object.keys(bundle));
      console.log('[Wakti Build] bundle.default type:', typeof bundle.default);
    }
    
    if (bundle && bundle.default) {
      window.App = bundle.default;
      console.log('[Wakti Build] Set window.App from bundle.default');
    } else if (bundle && typeof bundle === 'function') {
      window.App = bundle;
      console.log('[Wakti Build] Set window.App from bundle (function)');
    } else if (bundle && bundle.App) {
      window.App = bundle.App;
      console.log('[Wakti Build] Set window.App from bundle.App');
    } else if (bundle) {
      // Find first function export
      for (var key in bundle) {
        if (typeof bundle[key] === 'function') {
          window.App = bundle[key];
          console.log('[Wakti Build] Set window.App from bundle.' + key);
          break;
        }
      }
    } else {
      console.error('[Wakti Build] AppBundle is undefined! Check if esbuild output is correct.');
    }
    
    console.log('[Wakti Build] Final window.App type:', typeof window.App);
    if (typeof window.App === 'undefined') {
      console.error('[Wakti Build] CRITICAL: window.App is still undefined after all attempts!');
    }
  } catch (e) {
    console.error('[Wakti Build] Error extracting App:', e);
  }
})();
`;

  return { js: wrappedJs, css };
}

// Generate Lucide icons shim as ES module exports
// CRITICAL: This uses the CDN-based lucide library from window.lucide
// All ~1500 icons are available through window.lucide (or window.__lucideIcons)
function getLucideShim(): string {
  return `
// LUCIDE ICONS CDN-BASED SHIM - LAZY LOADING VERSION
// Icons are looked up at RENDER TIME, not module load time
// This ensures window.lucide is available when icons are actually rendered

// Create an icon component that looks up the icon LAZILY at render time
const createLazyIconComponent = (iconName) => {
  return window.React.forwardRef((props, ref) => {
    const { size = 24, color = 'currentColor', strokeWidth = 2, className = '', ...rest } = props || {};
    
    // LAZY LOOKUP: Get lucide library at render time, not module load time
    const lucideLib = window.__lucideIcons || window.lucide || {};
    const iconNode = lucideLib[iconName];
    
    if (!iconNode) {
      // Return a placeholder span instead of null to avoid React error #130
      console.warn('[Lucide] Icon "' + iconName + '" not found in lucide library');
      return window.React.createElement('span', {
        ref,
        className: className,
        style: { display: 'inline-block', width: size, height: size }
      });
    }
    
    // Create children from icon node definition
    const children = [];
    for (var i = 0; i < iconNode.length; i++) {
      var item = iconNode[i];
      if (Array.isArray(item) && item.length >= 2) {
        children.push(window.React.createElement(item[0], Object.assign({ key: i }, item[1])));
      }
    }
    
    return window.React.createElement('svg', {
      ref: ref,
      xmlns: 'http://www.w3.org/2000/svg',
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: color,
      strokeWidth: strokeWidth,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: className,
      ...rest
    }, ...children);
  });
};

// Proxy for dynamic icon access - creates lazy components on demand
const iconsProxy = new Proxy({}, {
  get: (target, prop) => {
    if (typeof prop === 'string') {
      if (!target[prop]) {
        target[prop] = createLazyIconComponent(prop);
      }
      return target[prop];
    }
    return undefined;
  }
});

// Export ALL icons using the lazy component creator
// Icons are looked up at RENDER time, not module load time
export const Heart = createLazyIconComponent('Heart');
export const Sparkles = createLazyIconComponent('Sparkles');
export const Gift = createLazyIconComponent('Gift');
export const Smile = createLazyIconComponent('Smile');
export const BookOpen = createLazyIconComponent('BookOpen');
export const Languages = createLazyIconComponent('Languages');
export const Star = createLazyIconComponent('Star');
export const Check = createLazyIconComponent('Check');
export const X = createLazyIconComponent('X');
export const Menu = createLazyIconComponent('Menu');
export const ChevronRight = createLazyIconComponent('ChevronRight');
export const ChevronLeft = createLazyIconComponent('ChevronLeft');
export const ChevronUp = createLazyIconComponent('ChevronUp');
export const ChevronDown = createLazyIconComponent('ChevronDown');
export const ArrowRight = createLazyIconComponent('ArrowRight');
export const ArrowLeft = createLazyIconComponent('ArrowLeft');
export const ArrowUp = createLazyIconComponent('ArrowUp');
export const ArrowDown = createLazyIconComponent('ArrowDown');
export const Search = createLazyIconComponent('Search');
export const User = createLazyIconComponent('User');
export const Settings = createLazyIconComponent('Settings');
export const Home = createLazyIconComponent('Home');
export const Mail = createLazyIconComponent('Mail');
export const Phone = createLazyIconComponent('Phone');
export const MapPin = createLazyIconComponent('MapPin');
export const Clock = createLazyIconComponent('Clock');
export const Calendar = createLazyIconComponent('Calendar');
export const Plus = createLazyIconComponent('Plus');
export const Minus = createLazyIconComponent('Minus');
export const Edit = createLazyIconComponent('Edit');
export const Trash = createLazyIconComponent('Trash');
export const Download = createLazyIconComponent('Download');
export const Upload = createLazyIconComponent('Upload');
export const Share = createLazyIconComponent('Share');
export const ExternalLink = createLazyIconComponent('ExternalLink');
export const Copy = createLazyIconComponent('Copy');
export const Info = createLazyIconComponent('Info');
export const AlertCircle = createLazyIconComponent('AlertCircle');
export const CheckCircle = createLazyIconComponent('CheckCircle');
export const XCircle = createLazyIconComponent('XCircle');
export const Globe = createLazyIconComponent('Globe');
export const Lock = createLazyIconComponent('Lock');
export const Eye = createLazyIconComponent('Eye');
export const EyeOff = createLazyIconComponent('EyeOff');
export const Play = createLazyIconComponent('Play');
export const Pause = createLazyIconComponent('Pause');
export const Sun = createLazyIconComponent('Sun');
export const Moon = createLazyIconComponent('Moon');
export const Send = createLazyIconComponent('Send');
export const Bell = createLazyIconComponent('Bell');
export const MessageCircle = createLazyIconComponent('MessageCircle');
export const RefreshCw = createLazyIconComponent('RefreshCw');
export const Loader = createLazyIconComponent('Loader');
export const Loader2 = createLazyIconComponent('Loader2');
export const Zap = createLazyIconComponent('Zap');
export const Award = createLazyIconComponent('Award');
export const Target = createLazyIconComponent('Target');
export const TrendingUp = createLazyIconComponent('TrendingUp');
export const Bookmark = createLazyIconComponent('Bookmark');
export const Tag = createLazyIconComponent('Tag');
export const Folder = createLazyIconComponent('Folder');
export const Filter = createLazyIconComponent('Filter');
export const Save = createLazyIconComponent('Save');
export const LogIn = createLazyIconComponent('LogIn');
export const LogOut = createLazyIconComponent('LogOut');
export const MoreHorizontal = createLazyIconComponent('MoreHorizontal');
export const MoreVertical = createLazyIconComponent('MoreVertical');
export const Activity = createLazyIconComponent('Activity');
export const BarChart = createLazyIconComponent('BarChart');
export const Grid = createLazyIconComponent('Grid');
export const List = createLazyIconComponent('List');
export const Code = createLazyIconComponent('Code');
export const Terminal = createLazyIconComponent('Terminal');
export const Layers = createLazyIconComponent('Layers');
export const Feather = createLazyIconComponent('Feather');
export const Crown = createLazyIconComponent('Crown');
export const Medal = createLazyIconComponent('Medal');
export const Trophy = createLazyIconComponent('Trophy');
export const Flame = createLazyIconComponent('Flame');
export const Flower = createLazyIconComponent('Flower');
export const Leaf = createLazyIconComponent('Leaf');
export const Rainbow = createLazyIconComponent('Rainbow');
export const Snowflake = createLazyIconComponent('Snowflake');
export const CloudRain = createLazyIconComponent('CloudRain');
export const Wind = createLazyIconComponent('Wind');
export const Music = createLazyIconComponent('Music');
export const Mic = createLazyIconComponent('Mic');
export const Headphones = createLazyIconComponent('Headphones');
export const Video = createLazyIconComponent('Video');
export const Camera = createLazyIconComponent('Camera');
export const Image = createLazyIconComponent('Image');
export const Coffee = createLazyIconComponent('Coffee');
export const Pizza = createLazyIconComponent('Pizza');
export const Cake = createLazyIconComponent('Cake');
export const Car = createLazyIconComponent('Car');
export const Truck = createLazyIconComponent('Truck');
export const Plane = createLazyIconComponent('Plane');
export const Rocket = createLazyIconComponent('Rocket');
export const Building = createLazyIconComponent('Building');
export const Key = createLazyIconComponent('Key');
export const Pencil = createLazyIconComponent('Pencil');
export const Brush = createLazyIconComponent('Brush');
export const Palette = createLazyIconComponent('Palette');
export const Scissors = createLazyIconComponent('Scissors');
export const Lightbulb = createLazyIconComponent('Lightbulb');
export const Gem = createLazyIconComponent('Gem');
export const Diamond = createLazyIconComponent('Diamond');
export const Sparkle = createLazyIconComponent('Sparkle');
export const PartyPopper = createLazyIconComponent('PartyPopper');
export const Angry = createLazyIconComponent('Angry');
export const Laugh = createLazyIconComponent('Laugh');
export const Frown = createLazyIconComponent('Frown');
export const Meh = createLazyIconComponent('Meh');
export const HeartCrack = createLazyIconComponent('HeartCrack');
export const Users = createLazyIconComponent('Users');
export const UserPlus = createLazyIconComponent('UserPlus');
export const UserMinus = createLazyIconComponent('UserMinus');
export const UserCheck = createLazyIconComponent('UserCheck');
export const Shield = createLazyIconComponent('Shield');
export const ShieldCheck = createLazyIconComponent('ShieldCheck');
export const Verified = createLazyIconComponent('Verified');
export const BadgeCheck = createLazyIconComponent('BadgeCheck');
export const HelpCircle = createLazyIconComponent('HelpCircle');
export const MessageSquare = createLazyIconComponent('MessageSquare');
export const Reply = createLazyIconComponent('Reply');
export const Forward = createLazyIconComponent('Forward');
export const FileText = createLazyIconComponent('FileText');
export const Clipboard = createLazyIconComponent('Clipboard');
export const ClipboardCheck = createLazyIconComponent('ClipboardCheck');
export const StickyNote = createLazyIconComponent('StickyNote');
export const Pin = createLazyIconComponent('Pin');
export const Paperclip = createLazyIconComponent('Paperclip');
export const AtSign = createLazyIconComponent('AtSign');
export const Hash = createLazyIconComponent('Hash');
export const DollarSign = createLazyIconComponent('DollarSign');
export const CreditCard = createLazyIconComponent('CreditCard');
export const Wallet = createLazyIconComponent('Wallet');
export const ShoppingBag = createLazyIconComponent('ShoppingBag');
export const ShoppingCart = createLazyIconComponent('ShoppingCart');
export const Package = createLazyIconComponent('Package');
export const Timer = createLazyIconComponent('Timer');
export const Hourglass = createLazyIconComponent('Hourglass');
export const AlarmClock = createLazyIconComponent('AlarmClock');
export const Wifi = createLazyIconComponent('Wifi');
export const WifiOff = createLazyIconComponent('WifiOff');
export const Bluetooth = createLazyIconComponent('Bluetooth');
export const Battery = createLazyIconComponent('Battery');
export const Signal = createLazyIconComponent('Signal');
export const Smartphone = createLazyIconComponent('Smartphone');
export const Tablet = createLazyIconComponent('Tablet');
export const Laptop = createLazyIconComponent('Laptop');
export const Monitor = createLazyIconComponent('Monitor');
export const Tv = createLazyIconComponent('Tv');
export const Server = createLazyIconComponent('Server');
export const Database = createLazyIconComponent('Database');
export const Cloud = createLazyIconComponent('Cloud');
export const CloudUpload = createLazyIconComponent('CloudUpload');
export const CloudDownload = createLazyIconComponent('CloudDownload');
export const Map = createLazyIconComponent('Map');
export const Compass = createLazyIconComponent('Compass');
export const Navigation = createLazyIconComponent('Navigation');
export const Printer = createLazyIconComponent('Printer');
export const QrCode = createLazyIconComponent('QrCode');
export const Scan = createLazyIconComponent('Scan');
export const Fingerprint = createLazyIconComponent('Fingerprint');
export const Move = createLazyIconComponent('Move');
export const Maximize = createLazyIconComponent('Maximize');
export const Minimize = createLazyIconComponent('Minimize');
export const Expand = createLazyIconComponent('Expand');
export const Shrink = createLazyIconComponent('Shrink');
export const RotateCcw = createLazyIconComponent('RotateCcw');
export const Repeat = createLazyIconComponent('Repeat');
export const Shuffle = createLazyIconComponent('Shuffle');
export const FastForward = createLazyIconComponent('FastForward');
export const Rewind = createLazyIconComponent('Rewind');
export const SkipForward = createLazyIconComponent('SkipForward');
export const SkipBack = createLazyIconComponent('SkipBack');
export const PlayCircle = createLazyIconComponent('PlayCircle');
export const PauseCircle = createLazyIconComponent('PauseCircle');
export const StopCircle = createLazyIconComponent('StopCircle');
export const Volume = createLazyIconComponent('Volume');
export const Volume2 = createLazyIconComponent('Volume2');
export const VolumeX = createLazyIconComponent('VolumeX');
export const MicOff = createLazyIconComponent('MicOff');
export const VideoOff = createLazyIconComponent('VideoOff');
export const CameraOff = createLazyIconComponent('CameraOff');
export const Type = createLazyIconComponent('Type');
export const Bold = createLazyIconComponent('Bold');
export const Italic = createLazyIconComponent('Italic');
export const Underline = createLazyIconComponent('Underline');
export const AlignLeft = createLazyIconComponent('AlignLeft');
export const AlignCenter = createLazyIconComponent('AlignCenter');
export const AlignRight = createLazyIconComponent('AlignRight');
export const AlignJustify = createLazyIconComponent('AlignJustify');
export const Undo = createLazyIconComponent('Undo');
export const Redo = createLazyIconComponent('Redo');
export const Quote = createLazyIconComponent('Quote');
export const Link = createLazyIconComponent('Link');
export const LinkOff = createLazyIconComponent('LinkOff');
export const Unlink = createLazyIconComponent('Unlink');
export const GripVertical = createLazyIconComponent('GripVertical');
export const GripHorizontal = createLazyIconComponent('GripHorizontal');
export const CircleCheck = createLazyIconComponent('CircleCheck');
export const CircleX = createLazyIconComponent('CircleX');
export const CirclePlus = createLazyIconComponent('CirclePlus');
export const CircleMinus = createLazyIconComponent('CircleMinus');
export const CircleAlert = createLazyIconComponent('CircleAlert');
export const CircleHelp = createLazyIconComponent('CircleHelp');
export const CircleUser = createLazyIconComponent('CircleUser');
export const CirclePlay = createLazyIconComponent('CirclePlay');
export const CirclePause = createLazyIconComponent('CirclePause');
export const CircleStop = createLazyIconComponent('CircleStop');
export const Trash2 = createLazyIconComponent('Trash2');
export const Edit2 = createLazyIconComponent('Edit2');
export const Edit3 = createLazyIconComponent('Edit3');
export const PenLine = createLazyIconComponent('PenLine');
export const PenTool = createLazyIconComponent('PenTool');
export const Eraser = createLazyIconComponent('Eraser');
export const Highlighter = createLazyIconComponent('Highlighter');
export const Crop = createLazyIconComponent('Crop');
export const ZoomIn = createLazyIconComponent('ZoomIn');
export const ZoomOut = createLazyIconComponent('ZoomOut');
export const RotateCw = createLazyIconComponent('RotateCw');
export const FlipHorizontal = createLazyIconComponent('FlipHorizontal');
export const FlipVertical = createLazyIconComponent('FlipVertical');
export const Square = createLazyIconComponent('Square');
export const Circle = createLazyIconComponent('Circle');
export const Triangle = createLazyIconComponent('Triangle');
export const Hexagon = createLazyIconComponent('Hexagon');
export const Pentagon = createLazyIconComponent('Pentagon');
export const Octagon = createLazyIconComponent('Octagon');
export const Box = createLazyIconComponent('Box');
export const Boxes = createLazyIconComponent('Boxes');
export const Cube = createLazyIconComponent('Cube');
export const Cylinder = createLazyIconComponent('Cylinder');
export const Shapes = createLazyIconComponent('Shapes');
export const Gamepad = createLazyIconComponent('Gamepad');
export const Gamepad2 = createLazyIconComponent('Gamepad2');
export const Dices = createLazyIconComponent('Dices');
export const Puzzle = createLazyIconComponent('Puzzle');
export const Swords = createLazyIconComponent('Swords');
export const Wand = createLazyIconComponent('Wand');
export const Wand2 = createLazyIconComponent('Wand2');
export const PlusCircle = createLazyIconComponent('PlusCircle');
export const MinusCircle = createLazyIconComponent('MinusCircle');
export const XOctagon = createLazyIconComponent('XOctagon');
export const AlertTriangle = createLazyIconComponent('AlertTriangle');
export const AlertOctagon = createLazyIconComponent('AlertOctagon');
export const BellRing = createLazyIconComponent('BellRing');
export const BellOff = createLazyIconComponent('BellOff');
export const BellPlus = createLazyIconComponent('BellPlus');
export const BellMinus = createLazyIconComponent('BellMinus');
export const ChevronFirst = createLazyIconComponent('ChevronFirst');
export const ChevronLast = createLazyIconComponent('ChevronLast');
export const ChevronsLeft = createLazyIconComponent('ChevronsLeft');
export const ChevronsRight = createLazyIconComponent('ChevronsRight');
export const ChevronsUp = createLazyIconComponent('ChevronsUp');
export const ChevronsDown = createLazyIconComponent('ChevronsDown');
export const ChevronsUpDown = createLazyIconComponent('ChevronsUpDown');
export const ArrowUpRight = createLazyIconComponent('ArrowUpRight');
export const ArrowDownRight = createLazyIconComponent('ArrowDownRight');
export const ArrowUpLeft = createLazyIconComponent('ArrowUpLeft');
export const ArrowDownLeft = createLazyIconComponent('ArrowDownLeft');
export const ArrowBigUp = createLazyIconComponent('ArrowBigUp');
export const ArrowBigDown = createLazyIconComponent('ArrowBigDown');
export const ArrowBigLeft = createLazyIconComponent('ArrowBigLeft');
export const ArrowBigRight = createLazyIconComponent('ArrowBigRight');
export const MoveUp = createLazyIconComponent('MoveUp');
export const MoveDown = createLazyIconComponent('MoveDown');
export const MoveLeft = createLazyIconComponent('MoveLeft');
export const MoveRight = createLazyIconComponent('MoveRight');
export const PanelLeft = createLazyIconComponent('PanelLeft');
export const PanelRight = createLazyIconComponent('PanelRight');
export const PanelTop = createLazyIconComponent('PanelTop');
export const PanelBottom = createLazyIconComponent('PanelBottom');
export const Sidebar = createLazyIconComponent('Sidebar');
export const SidebarOpen = createLazyIconComponent('SidebarOpen');
export const SidebarClose = createLazyIconComponent('SidebarClose');
export const LayoutGrid = createLazyIconComponent('LayoutGrid');
export const LayoutList = createLazyIconComponent('LayoutList');
export const LayoutDashboard = createLazyIconComponent('LayoutDashboard');
export const LayoutTemplate = createLazyIconComponent('LayoutTemplate');
export const Table = createLazyIconComponent('Table');
export const Table2 = createLazyIconComponent('Table2');
export const Columns = createLazyIconComponent('Columns');
export const Rows = createLazyIconComponent('Rows');
export const Split = createLazyIconComponent('Split');
export const Merge = createLazyIconComponent('Merge');
export const Github = createLazyIconComponent('Github');
export const Gitlab = createLazyIconComponent('Gitlab');
export const Twitter = createLazyIconComponent('Twitter');
export const Facebook = createLazyIconComponent('Facebook');
export const Instagram = createLazyIconComponent('Instagram');
export const Linkedin = createLazyIconComponent('Linkedin');
export const Youtube = createLazyIconComponent('Youtube');
export const Twitch = createLazyIconComponent('Twitch');
export const Slack = createLazyIconComponent('Slack');
export const Chrome = createLazyIconComponent('Chrome');
export const Figma = createLazyIconComponent('Figma');
export const Framer = createLazyIconComponent('Framer');
export const Apple = createLazyIconComponent('Apple');
export const Dribbble = createLazyIconComponent('Dribbble');
export const Copyright = createLazyIconComponent('Copyright');
export const Trademark = createLazyIconComponent('Trademark');
export const Percent = createLazyIconComponent('Percent');
export const Infinity = createLazyIconComponent('Infinity');
export const Equal = createLazyIconComponent('Equal');
export const EqualNot = createLazyIconComponent('EqualNot');
export const Divide = createLazyIconComponent('Divide');
export const Sigma = createLazyIconComponent('Sigma');
export const Pi = createLazyIconComponent('Pi');
export const Asterisk = createLazyIconComponent('Asterisk');
export const Grip = createLazyIconComponent('Grip');
export const MoreHorizontalIcon = createLazyIconComponent('MoreHorizontal');
export const Ellipsis = createLazyIconComponent('Ellipsis');
export const EllipsisVertical = createLazyIconComponent('EllipsisVertical');
export const House = createLazyIconComponent('House');
export const Building2 = createLazyIconComponent('Building2');
export const Store = createLazyIconComponent('Store');
export const Factory = createLazyIconComponent('Factory');
export const Warehouse = createLazyIconComponent('Warehouse');
export const Hotel = createLazyIconComponent('Hotel');
export const Hospital = createLazyIconComponent('Hospital');
export const School = createLazyIconComponent('School');
export const Library = createLazyIconComponent('Library');
export const Church = createLazyIconComponent('Church');
export const Castle = createLazyIconComponent('Castle');
export const Mountain = createLazyIconComponent('Mountain');
export const Trees = createLazyIconComponent('Trees');
export const Tent = createLazyIconComponent('Tent');
export const Anchor = createLazyIconComponent('Anchor');
export const Ship = createLazyIconComponent('Ship');
export const Sailboat = createLazyIconComponent('Sailboat');
export const Train = createLazyIconComponent('Train');
export const Bus = createLazyIconComponent('Bus');
export const Bike = createLazyIconComponent('Bike');
export const Footprints = createLazyIconComponent('Footprints');
export const Baby = createLazyIconComponent('Baby');
export const PersonStanding = createLazyIconComponent('PersonStanding');
export const Accessibility = createLazyIconComponent('Accessibility');
export const Ear = createLazyIconComponent('Ear');
export const EarOff = createLazyIconComponent('EarOff');
export const Hand = createLazyIconComponent('Hand');
export const HandMetal = createLazyIconComponent('HandMetal');
export const ThumbsUp = createLazyIconComponent('ThumbsUp');
export const ThumbsDown = createLazyIconComponent('ThumbsDown');
export const Grab = createLazyIconComponent('Grab');
export const Pointer = createLazyIconComponent('Pointer');
export const MousePointer = createLazyIconComponent('MousePointer');
export const MousePointer2 = createLazyIconComponent('MousePointer2');
export const Mouse = createLazyIconComponent('Mouse');
export const Keyboard = createLazyIconComponent('Keyboard');
export const Joystick = createLazyIconComponent('Joystick');
export const Command = createLazyIconComponent('Command');
export const Option = createLazyIconComponent('Option');
export const Delete = createLazyIconComponent('Delete');
export const CornerUpLeft = createLazyIconComponent('CornerUpLeft');
export const CornerUpRight = createLazyIconComponent('CornerUpRight');
export const CornerDownLeft = createLazyIconComponent('CornerDownLeft');
export const CornerDownRight = createLazyIconComponent('CornerDownRight');
export const File = createLazyIconComponent('File');
export const FileCode = createLazyIconComponent('FileCode');
export const FileJson = createLazyIconComponent('FileJson');
export const FilePlus = createLazyIconComponent('FilePlus');
export const FileMinus = createLazyIconComponent('FileMinus');
export const FileX = createLazyIconComponent('FileX');
export const FileCheck = createLazyIconComponent('FileCheck');
export const FileSearch = createLazyIconComponent('FileSearch');
export const FileImage = createLazyIconComponent('FileImage');
export const FileVideo = createLazyIconComponent('FileVideo');
export const FileAudio = createLazyIconComponent('FileAudio');
export const FileArchive = createLazyIconComponent('FileArchive');
export const FileSpreadsheet = createLazyIconComponent('FileSpreadsheet');
export const FileType = createLazyIconComponent('FileType');
export const FileType2 = createLazyIconComponent('FileType2');
export const Files = createLazyIconComponent('Files');
export const FolderOpen = createLazyIconComponent('FolderOpen');
export const FolderPlus = createLazyIconComponent('FolderPlus');
export const FolderMinus = createLazyIconComponent('FolderMinus');
export const FolderX = createLazyIconComponent('FolderX');
export const FolderCheck = createLazyIconComponent('FolderCheck');
export const FolderSearch = createLazyIconComponent('FolderSearch');
export const FolderArchive = createLazyIconComponent('FolderArchive');
export const Folders = createLazyIconComponent('Folders');
export const Archive = createLazyIconComponent('Archive');
export const Inbox = createLazyIconComponent('Inbox');
export const MailOpen = createLazyIconComponent('MailOpen');
export const MailCheck = createLazyIconComponent('MailCheck');
export const MailPlus = createLazyIconComponent('MailPlus');
export const MailMinus = createLazyIconComponent('MailMinus');
export const MailX = createLazyIconComponent('MailX');
export const MailSearch = createLazyIconComponent('MailSearch');
export const MailWarning = createLazyIconComponent('MailWarning');
export const MailQuestion = createLazyIconComponent('MailQuestion');
export const Mails = createLazyIconComponent('Mails');
export const MessagesSquare = createLazyIconComponent('MessagesSquare');
export const MessageSquarePlus = createLazyIconComponent('MessageSquarePlus');
export const MessageSquareDashed = createLazyIconComponent('MessageSquareDashed');
export const MessageSquareWarning = createLazyIconComponent('MessageSquareWarning');
export const MessageSquareX = createLazyIconComponent('MessageSquareX');
export const MessageCirclePlus = createLazyIconComponent('MessageCirclePlus');
export const MessageCircleWarning = createLazyIconComponent('MessageCircleWarning');
export const MessageCircleX = createLazyIconComponent('MessageCircleX');
export const Speech = createLazyIconComponent('Speech');
export const QuoteIcon = createLazyIconComponent('Quote');
export const Text = createLazyIconComponent('Text');
export const TextCursor = createLazyIconComponent('TextCursor');
export const TextCursorInput = createLazyIconComponent('TextCursorInput');
export const TextSelect = createLazyIconComponent('TextSelect');
export const TextSearch = createLazyIconComponent('TextSearch');
export const Heading = createLazyIconComponent('Heading');
export const Heading1 = createLazyIconComponent('Heading1');
export const Heading2 = createLazyIconComponent('Heading2');
export const Heading3 = createLazyIconComponent('Heading3');
export const Heading4 = createLazyIconComponent('Heading4');
export const Heading5 = createLazyIconComponent('Heading5');
export const Heading6 = createLazyIconComponent('Heading6');
export const ListOrdered = createLazyIconComponent('ListOrdered');
export const ListChecks = createLazyIconComponent('ListChecks');
export const ListTodo = createLazyIconComponent('ListTodo');
export const ListPlus = createLazyIconComponent('ListPlus');
export const ListMinus = createLazyIconComponent('ListMinus');
export const ListX = createLazyIconComponent('ListX');
export const ListFilter = createLazyIconComponent('ListFilter');
export const ListTree = createLazyIconComponent('ListTree');
export const ListCollapse = createLazyIconComponent('ListCollapse');
export const ListRestart = createLazyIconComponent('ListRestart');
export const Indent = createLazyIconComponent('Indent');
export const Outdent = createLazyIconComponent('Outdent');
export const WrapText = createLazyIconComponent('WrapText');
export const CaseSensitive = createLazyIconComponent('CaseSensitive');
export const CaseUpper = createLazyIconComponent('CaseUpper');
export const CaseLower = createLazyIconComponent('CaseLower');
export const Strikethrough = createLazyIconComponent('Strikethrough');
export const Subscript = createLazyIconComponent('Subscript');
export const Superscript = createLazyIconComponent('Superscript');
export const RemoveFormatting = createLazyIconComponent('RemoveFormatting');
export const Spellcheck = createLazyIconComponent('Spellcheck');
export const LanguagesIcon = createLazyIconComponent('Languages');
export const BrainCircuit = createLazyIconComponent('BrainCircuit');
export const BrainCog = createLazyIconComponent('BrainCog');
export const Brain = createLazyIconComponent('Brain');
export const Cpu = createLazyIconComponent('Cpu');
export const Chip = createLazyIconComponent('Chip');
export const Bot = createLazyIconComponent('Bot');
export const BotMessageSquare = createLazyIconComponent('BotMessageSquare');
export const Workflow = createLazyIconComponent('Workflow');
export const GitBranch = createLazyIconComponent('GitBranch');
export const GitCommit = createLazyIconComponent('GitCommit');
export const GitMerge = createLazyIconComponent('GitMerge');
export const GitPullRequest = createLazyIconComponent('GitPullRequest');
export const GitCompare = createLazyIconComponent('GitCompare');
export const GitFork = createLazyIconComponent('GitFork');
export const Bug = createLazyIconComponent('Bug');
export const BugOff = createLazyIconComponent('BugOff');
export const BugPlay = createLazyIconComponent('BugPlay');
export const TestTube = createLazyIconComponent('TestTube');
export const TestTube2 = createLazyIconComponent('TestTube2');
export const TestTubes = createLazyIconComponent('TestTubes');
export const FlaskConical = createLazyIconComponent('FlaskConical');
export const FlaskRound = createLazyIconComponent('FlaskRound');
export const Microscope = createLazyIconComponent('Microscope');
export const Stethoscope = createLazyIconComponent('Stethoscope');
export const Syringe = createLazyIconComponent('Syringe');
export const Pill = createLazyIconComponent('Pill');
export const Tablets = createLazyIconComponent('Tablets');
export const Thermometer = createLazyIconComponent('Thermometer');
export const ThermometerSun = createLazyIconComponent('ThermometerSun');
export const ThermometerSnowflake = createLazyIconComponent('ThermometerSnowflake');
export const HeartPulse = createLazyIconComponent('HeartPulse');
export const HeartHandshake = createLazyIconComponent('HeartHandshake');
export const Droplet = createLazyIconComponent('Droplet');
export const Droplets = createLazyIconComponent('Droplets');
export const Waves = createLazyIconComponent('Waves');
export const Sunrise = createLazyIconComponent('Sunrise');
export const Sunset = createLazyIconComponent('Sunset');
export const CloudSun = createLazyIconComponent('CloudSun');
export const CloudMoon = createLazyIconComponent('CloudMoon');
export const CloudSnow = createLazyIconComponent('CloudSnow');
export const CloudLightning = createLazyIconComponent('CloudLightning');
export const CloudDrizzle = createLazyIconComponent('CloudDrizzle');
export const CloudFog = createLazyIconComponent('CloudFog');
export const CloudHail = createLazyIconComponent('CloudHail');
export const CloudOff = createLazyIconComponent('CloudOff');
export const Tornado = createLazyIconComponent('Tornado');
export const FlameIcon = createLazyIconComponent('Flame');
export const Fuel = createLazyIconComponent('Fuel');
export const Gauge = createLazyIconComponent('Gauge');
export const Speedometer = createLazyIconComponent('Speedometer');
export const Milestone = createLazyIconComponent('Milestone');
export const Goal = createLazyIconComponent('Goal');
export const FlagTriangleLeft = createLazyIconComponent('FlagTriangleLeft');
export const FlagTriangleRight = createLazyIconComponent('FlagTriangleRight');
export const Flag = createLazyIconComponent('Flag');
export const FlagOff = createLazyIconComponent('FlagOff');
export const Megaphone = createLazyIconComponent('Megaphone');
export const MegaphoneOff = createLazyIconComponent('MegaphoneOff');
export const Radio = createLazyIconComponent('Radio');
export const RadioReceiver = createLazyIconComponent('RadioReceiver');
export const RadioTower = createLazyIconComponent('RadioTower');
export const Satellite = createLazyIconComponent('Satellite');
export const SatelliteDish = createLazyIconComponent('SatelliteDish');
export const Rss = createLazyIconComponent('Rss');
export const Podcast = createLazyIconComponent('Podcast');
export const TrendingDown = createLazyIconComponent('TrendingDown');
export const LineChart = createLazyIconComponent('LineChart');
export const BarChart2 = createLazyIconComponent('BarChart2');
export const BarChart3 = createLazyIconComponent('BarChart3');
export const BarChart4 = createLazyIconComponent('BarChart4');
export const BarChartBig = createLazyIconComponent('BarChartBig');
export const BarChartHorizontal = createLazyIconComponent('BarChartHorizontal');
export const BarChartHorizontalBig = createLazyIconComponent('BarChartHorizontalBig');
export const AreaChart = createLazyIconComponent('AreaChart');
export const PieChart = createLazyIconComponent('PieChart');
export const ScatterChart = createLazyIconComponent('ScatterChart');
export const CandlestickChart = createLazyIconComponent('CandlestickChart');
export const GanttChart = createLazyIconComponent('GanttChart');
export const CalendarDays = createLazyIconComponent('CalendarDays');
export const CalendarCheck = createLazyIconComponent('CalendarCheck');
export const CalendarCheck2 = createLazyIconComponent('CalendarCheck2');
export const CalendarPlus = createLazyIconComponent('CalendarPlus');
export const CalendarMinus = createLazyIconComponent('CalendarMinus');
export const CalendarX = createLazyIconComponent('CalendarX');
export const CalendarX2 = createLazyIconComponent('CalendarX2');
export const CalendarSearch = createLazyIconComponent('CalendarSearch');
export const CalendarClock = createLazyIconComponent('CalendarClock');
export const CalendarHeart = createLazyIconComponent('CalendarHeart');
export const CalendarRange = createLazyIconComponent('CalendarRange');
export const CalendarOff = createLazyIconComponent('CalendarOff');
export const CalendarFold = createLazyIconComponent('CalendarFold');
export const History = createLazyIconComponent('History');
export const Watch = createLazyIconComponent('Watch');
export const Stopwatch = createLazyIconComponent('Stopwatch');
export const TimerOff = createLazyIconComponent('TimerOff');
export const TimerReset = createLazyIconComponent('TimerReset');
export const AlarmClockOff = createLazyIconComponent('AlarmClockOff');
export const AlarmClockCheck = createLazyIconComponent('AlarmClockCheck');
export const AlarmClockPlus = createLazyIconComponent('AlarmClockPlus');
export const AlarmClockMinus = createLazyIconComponent('AlarmClockMinus');
export const ClockIcon = createLazyIconComponent('Clock');
export const Clock1 = createLazyIconComponent('Clock1');
export const Clock2 = createLazyIconComponent('Clock2');
export const Clock3 = createLazyIconComponent('Clock3');
export const Clock4 = createLazyIconComponent('Clock4');
export const Clock5 = createLazyIconComponent('Clock5');
export const Clock6 = createLazyIconComponent('Clock6');
export const Clock7 = createLazyIconComponent('Clock7');
export const Clock8 = createLazyIconComponent('Clock8');
export const Clock9 = createLazyIconComponent('Clock9');
export const Clock10 = createLazyIconComponent('Clock10');
export const Clock11 = createLazyIconComponent('Clock11');
export const Clock12 = createLazyIconComponent('Clock12');
export const Euro = createLazyIconComponent('Euro');
export const PoundSterling = createLazyIconComponent('PoundSterling');
export const JapaneseYen = createLazyIconComponent('JapaneseYen');
export const RussianRuble = createLazyIconComponent('RussianRuble');
export const SwissFranc = createLazyIconComponent('SwissFranc');
export const IndianRupee = createLazyIconComponent('IndianRupee');
export const BadgeDollarSign = createLazyIconComponent('BadgeDollarSign');
export const BadgePercent = createLazyIconComponent('BadgePercent');
export const Receipt = createLazyIconComponent('Receipt');
export const ReceiptText = createLazyIconComponent('ReceiptText');
export const Banknote = createLazyIconComponent('Banknote');
export const Coins = createLazyIconComponent('Coins');
export const PiggyBank = createLazyIconComponent('PiggyBank');
export const Vault = createLazyIconComponent('Vault');
export const HandCoins = createLazyIconComponent('HandCoins');
export const CircleDollarSign = createLazyIconComponent('CircleDollarSign');
export const BadgePlus = createLazyIconComponent('BadgePlus');
export const BadgeMinus = createLazyIconComponent('BadgeMinus');
export const BadgeX = createLazyIconComponent('BadgeX');
export const BadgeAlert = createLazyIconComponent('BadgeAlert');
export const BadgeHelp = createLazyIconComponent('BadgeHelp');
export const BadgeInfo = createLazyIconComponent('BadgeInfo');
export const AwardIcon = createLazyIconComponent('Award');
export const MedalIcon = createLazyIconComponent('Medal');
export const TrophyIcon = createLazyIconComponent('Trophy');
export const CrownIcon = createLazyIconComponent('Crown');
export const LockKeyhole = createLazyIconComponent('LockKeyhole');
export const LockOpen = createLazyIconComponent('LockOpen');
export const Unlock = createLazyIconComponent('Unlock');
export const UnlockKeyhole = createLazyIconComponent('UnlockKeyhole');
export const KeyRound = createLazyIconComponent('KeyRound');
export const KeySquare = createLazyIconComponent('KeySquare');
export const ShieldAlert = createLazyIconComponent('ShieldAlert');
export const ShieldOff = createLazyIconComponent('ShieldOff');
export const ShieldPlus = createLazyIconComponent('ShieldPlus');
export const ShieldMinus = createLazyIconComponent('ShieldMinus');
export const ShieldX = createLazyIconComponent('ShieldX');
export const ShieldQuestion = createLazyIconComponent('ShieldQuestion');
export const ShieldBan = createLazyIconComponent('ShieldBan');
export const ShieldEllipsis = createLazyIconComponent('ShieldEllipsis');
export const ShieldHalf = createLazyIconComponent('ShieldHalf');
export const ScanFace = createLazyIconComponent('ScanFace');
export const ScanEye = createLazyIconComponent('ScanEye');
export const ScanText = createLazyIconComponent('ScanText');
export const ScanLine = createLazyIconComponent('ScanLine');
export const ScanBarcode = createLazyIconComponent('ScanBarcode');
export const ScanSearch = createLazyIconComponent('ScanSearch');
export const QrCodeIcon = createLazyIconComponent('QrCode');
export const Barcode = createLazyIconComponent('Barcode');
export const NfcIcon = createLazyIconComponent('Nfc');
export const ContactlessIcon = createLazyIconComponent('Contactless');
export const SquareCheck = createLazyIconComponent('SquareCheck');
export const SquareX = createLazyIconComponent('SquareX');
export const SquarePlus = createLazyIconComponent('SquarePlus');
export const SquareMinus = createLazyIconComponent('SquareMinus');
export const SquareSlash = createLazyIconComponent('SquareSlash');
export const SquareCode = createLazyIconComponent('SquareCode');
export const SquareDot = createLazyIconComponent('SquareDot');
export const SquareAsterisk = createLazyIconComponent('SquareAsterisk');
export const SquareStack = createLazyIconComponent('SquareStack');
export const SquareArrowUpRight = createLazyIconComponent('SquareArrowUpRight');
export const SquareArrowOutUpRight = createLazyIconComponent('SquareArrowOutUpRight');
export const ExternalLinkIcon = createLazyIconComponent('ExternalLink');
export const SquareArrowOutUpLeft = createLazyIconComponent('SquareArrowOutUpLeft');
export const SquareArrowUp = createLazyIconComponent('SquareArrowUp');
export const SquareArrowDown = createLazyIconComponent('SquareArrowDown');
export const SquareArrowLeft = createLazyIconComponent('SquareArrowLeft');
export const SquareArrowRight = createLazyIconComponent('SquareArrowRight');
export const SquareUser = createLazyIconComponent('SquareUser');
export const SquareUserRound = createLazyIconComponent('SquareUserRound');
export const SquarePen = createLazyIconComponent('SquarePen');
export const SquareTerminal = createLazyIconComponent('SquareTerminal');
export const SquareKanban = createLazyIconComponent('SquareKanban');
export const SquareGanttChart = createLazyIconComponent('SquareGanttChart');
export const SquareActivity = createLazyIconComponent('SquareActivity');
export const SquarePlay = createLazyIconComponent('SquarePlay');
export const SquareMenu = createLazyIconComponent('SquareMenu');
export const SquareLibrary = createLazyIconComponent('SquareLibrary');
export const SquareBottomDashedScissors = createLazyIconComponent('SquareBottomDashedScissors');
export const SquareChartGantt = createLazyIconComponent('SquareChartGantt');
export const SquareFunction = createLazyIconComponent('SquareFunction');
export const SquareEqual = createLazyIconComponent('SquareEqual');
export const SquareDivide = createLazyIconComponent('SquareDivide');
export const SquareSigma = createLazyIconComponent('SquareSigma');
export const SquarePi = createLazyIconComponent('SquarePi');
export const SquarePercent = createLazyIconComponent('SquarePercent');
export const SquareMousePointer = createLazyIconComponent('SquareMousePointer');
export const SquareParking = createLazyIconComponent('SquareParking');
export const ParkingCircle = createLazyIconComponent('ParkingCircle');
export const Briefcase = createLazyIconComponent('Briefcase');
export const BriefcaseBusiness = createLazyIconComponent('BriefcaseBusiness');
export const BriefcaseMedical = createLazyIconComponent('BriefcaseMedical');
export const Backpack = createLazyIconComponent('Backpack');
export const Luggage = createLazyIconComponent('Luggage');
export const Suitcase = createLazyIconComponent('Suitcase');
export const GraduationCap = createLazyIconComponent('GraduationCap');
export const BookMarked = createLazyIconComponent('BookMarked');
export const BookPlus = createLazyIconComponent('BookPlus');
export const BookMinus = createLazyIconComponent('BookMinus');
export const BookX = createLazyIconComponent('BookX');
export const BookCheck = createLazyIconComponent('BookCheck');
export const BookCopy = createLazyIconComponent('BookCopy');
export const BookOpenCheck = createLazyIconComponent('BookOpenCheck');
export const BookOpenText = createLazyIconComponent('BookOpenText');
export const BookText = createLazyIconComponent('BookText');
export const BookLock = createLazyIconComponent('BookLock');
export const BookKey = createLazyIconComponent('BookKey');
export const BookHeart = createLazyIconComponent('BookHeart');
export const BookImage = createLazyIconComponent('BookImage');
export const BookAudio = createLazyIconComponent('BookAudio');
export const BookDown = createLazyIconComponent('BookDown');
export const BookUp = createLazyIconComponent('BookUp');
export const BookUp2 = createLazyIconComponent('BookUp2');
export const BookA = createLazyIconComponent('BookA');
export const BookType = createLazyIconComponent('BookType');
export const BookDashed = createLazyIconComponent('BookDashed');
export const Notebook = createLazyIconComponent('Notebook');
export const NotebookPen = createLazyIconComponent('NotebookPen');
export const NotebookText = createLazyIconComponent('NotebookText');
export const NotebookTabs = createLazyIconComponent('NotebookTabs');
export const Presentation = createLazyIconComponent('Presentation');
export const PresentationIcon = createLazyIconComponent('Presentation');
export const Projector = createLazyIconComponent('Projector');
export const ScreenShare = createLazyIconComponent('ScreenShare');
export const ScreenShareOff = createLazyIconComponent('ScreenShareOff');
export const Airplay = createLazyIconComponent('Airplay');
export const Cast = createLazyIconComponent('Cast');
export const MonitorPlay = createLazyIconComponent('MonitorPlay');
export const MonitorStop = createLazyIconComponent('MonitorStop');
export const MonitorPause = createLazyIconComponent('MonitorPause');
export const MonitorUp = createLazyIconComponent('MonitorUp');
export const MonitorDown = createLazyIconComponent('MonitorDown');
export const MonitorOff = createLazyIconComponent('MonitorOff');
export const MonitorCheck = createLazyIconComponent('MonitorCheck');
export const MonitorX = createLazyIconComponent('MonitorX');
export const MonitorDot = createLazyIconComponent('MonitorDot');
export const MonitorSmartphone = createLazyIconComponent('MonitorSmartphone');
export const MonitorSpeaker = createLazyIconComponent('MonitorSpeaker');
// CRITICAL: Export the icons proxy for dynamic icon resolution
// This allows: import { icons } from 'lucide-react'; icons.SomeRareIcon
export const icons = iconsProxy;

// Default export for compatibility
export default { icons: iconsProxy };
`;
}
