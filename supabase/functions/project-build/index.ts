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
// CRITICAL: This uses the CDN-based lucide library from window.lucide
// All ~1500 icons are available through window.lucide (or window.__lucideIcons)
function getLucideShim(): string {
  return `
// LUCIDE ICONS CDN-BASED SHIM
// This shim dynamically creates React components from the lucide UMD build (window.lucide)
// Supports ALL 1500+ Lucide icons without static embedding

const createIconComponent = (iconName, iconNode) => {
  // iconNode is an array of [elementType, attributes] tuples from lucide
  return window.React.forwardRef((props, ref) => {
    const { size = 24, color = 'currentColor', strokeWidth = 2, className = '', ...rest } = props || {};
    
    if (!iconNode) {
      console.warn(\`[Lucide] Icon "\${iconName}" not found in lucide library\`);
      return null;
    }
    
    // Create children from icon node definition
    const children = iconNode.map((item, i) => {
      if (!Array.isArray(item) || item.length < 2) return null;
      const [tag, attrs] = item;
      return window.React.createElement(tag, { key: i, ...attrs });
    });
    
    return window.React.createElement('svg', {
      ref,
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

// Get lucide icons from CDN (window.lucide or window.__lucideIcons)
const lucideLib = (typeof window !== 'undefined') 
  ? (window.__lucideIcons || window.lucide || {}) 
  : {};

// Create a Proxy that dynamically generates icon components on access
// This supports ALL 1500+ icons without needing to enumerate them
const iconsProxy = new Proxy({}, {
  get: (target, prop) => {
    if (typeof prop === 'string') {
      // Check cache first
      if (target[prop]) return target[prop];
      
      // Look up the icon in lucide library
      const iconNode = lucideLib[prop];
      if (iconNode) {
        target[prop] = createIconComponent(prop, iconNode);
        return target[prop];
      }
      
      // Fallback: create a placeholder component that shows the icon name
      return createIconComponent(prop, null);
    }
    return undefined;
  }
});

// Export commonly used icons directly for tree-shaking compatibility
// These are resolved at import time
export const Heart = createIconComponent('Heart', lucideLib.Heart);
export const Sparkles = createIconComponent('Sparkles', lucideLib.Sparkles);
export const Gift = createIconComponent('Gift', lucideLib.Gift);
export const Smile = createIconComponent('Smile', lucideLib.Smile);
export const BookOpen = createIconComponent('BookOpen', lucideLib.BookOpen);
export const Languages = createIconComponent('Languages', lucideLib.Languages);
export const Star = createIconComponent('Star', lucideLib.Star);
export const Check = createIconComponent('Check', lucideLib.Check);
export const X = createIconComponent('X', lucideLib.X);
export const Menu = createIconComponent('Menu', lucideLib.Menu);
export const ChevronRight = createIconComponent('ChevronRight', lucideLib.ChevronRight);
export const ChevronLeft = createIconComponent('ChevronLeft', lucideLib.ChevronLeft);
export const ChevronUp = createIconComponent('ChevronUp', lucideLib.ChevronUp);
export const ChevronDown = createIconComponent('ChevronDown', lucideLib.ChevronDown);
export const ArrowRight = createIconComponent('ArrowRight', lucideLib.ArrowRight);
export const ArrowLeft = createIconComponent('ArrowLeft', lucideLib.ArrowLeft);
export const ArrowUp = createIconComponent('ArrowUp', lucideLib.ArrowUp);
export const ArrowDown = createIconComponent('ArrowDown', lucideLib.ArrowDown);
export const Search = createIconComponent('Search', lucideLib.Search);
export const User = createIconComponent('User', lucideLib.User);
export const Settings = createIconComponent('Settings', lucideLib.Settings);
export const Home = createIconComponent('Home', lucideLib.Home);
export const Mail = createIconComponent('Mail', lucideLib.Mail);
export const Phone = createIconComponent('Phone', lucideLib.Phone);
export const MapPin = createIconComponent('MapPin', lucideLib.MapPin);
export const Clock = createIconComponent('Clock', lucideLib.Clock);
export const Calendar = createIconComponent('Calendar', lucideLib.Calendar);
export const Plus = createIconComponent('Plus', lucideLib.Plus);
export const Minus = createIconComponent('Minus', lucideLib.Minus);
export const Edit = createIconComponent('Edit', lucideLib.Edit);
export const Trash = createIconComponent('Trash', lucideLib.Trash);
export const Download = createIconComponent('Download', lucideLib.Download);
export const Upload = createIconComponent('Upload', lucideLib.Upload);
export const Share = createIconComponent('Share', lucideLib.Share);
export const ExternalLink = createIconComponent('ExternalLink', lucideLib.ExternalLink);
export const Copy = createIconComponent('Copy', lucideLib.Copy);
export const Info = createIconComponent('Info', lucideLib.Info);
export const AlertCircle = createIconComponent('AlertCircle', lucideLib.AlertCircle);
export const CheckCircle = createIconComponent('CheckCircle', lucideLib.CheckCircle);
export const XCircle = createIconComponent('XCircle', lucideLib.XCircle);
export const Globe = createIconComponent('Globe', lucideLib.Globe);
export const Lock = createIconComponent('Lock', lucideLib.Lock);
export const Eye = createIconComponent('Eye', lucideLib.Eye);
export const EyeOff = createIconComponent('EyeOff', lucideLib.EyeOff);
export const Play = createIconComponent('Play', lucideLib.Play);
export const Pause = createIconComponent('Pause', lucideLib.Pause);
export const Sun = createIconComponent('Sun', lucideLib.Sun);
export const Moon = createIconComponent('Moon', lucideLib.Moon);
export const Send = createIconComponent('Send', lucideLib.Send);
export const Bell = createIconComponent('Bell', lucideLib.Bell);
export const MessageCircle = createIconComponent('MessageCircle', lucideLib.MessageCircle);
export const RefreshCw = createIconComponent('RefreshCw', lucideLib.RefreshCw);
export const Loader = createIconComponent('Loader', lucideLib.Loader);
export const Loader2 = createIconComponent('Loader2', lucideLib.Loader2);
export const Zap = createIconComponent('Zap', lucideLib.Zap);
export const Award = createIconComponent('Award', lucideLib.Award);
export const Target = createIconComponent('Target', lucideLib.Target);
export const TrendingUp = createIconComponent('TrendingUp', lucideLib.TrendingUp);
export const Bookmark = createIconComponent('Bookmark', lucideLib.Bookmark);
export const Tag = createIconComponent('Tag', lucideLib.Tag);
export const Folder = createIconComponent('Folder', lucideLib.Folder);
export const Filter = createIconComponent('Filter', lucideLib.Filter);
export const Save = createIconComponent('Save', lucideLib.Save);
export const LogIn = createIconComponent('LogIn', lucideLib.LogIn);
export const LogOut = createIconComponent('LogOut', lucideLib.LogOut);
export const MoreHorizontal = createIconComponent('MoreHorizontal', lucideLib.MoreHorizontal);
export const MoreVertical = createIconComponent('MoreVertical', lucideLib.MoreVertical);
export const Activity = createIconComponent('Activity', lucideLib.Activity);
export const BarChart = createIconComponent('BarChart', lucideLib.BarChart);
export const Grid = createIconComponent('Grid', lucideLib.Grid);
export const List = createIconComponent('List', lucideLib.List);
export const Code = createIconComponent('Code', lucideLib.Code);
export const Terminal = createIconComponent('Terminal', lucideLib.Terminal);
export const Layers = createIconComponent('Layers', lucideLib.Layers);
export const Feather = createIconComponent('Feather', lucideLib.Feather);
export const Crown = createIconComponent('Crown', lucideLib.Crown);
export const Medal = createIconComponent('Medal', lucideLib.Medal);
export const Trophy = createIconComponent('Trophy', lucideLib.Trophy);
export const Flame = createIconComponent('Flame', lucideLib.Flame);
export const Flower = createIconComponent('Flower', lucideLib.Flower);
export const Leaf = createIconComponent('Leaf', lucideLib.Leaf);
export const Rainbow = createIconComponent('Rainbow', lucideLib.Rainbow);
export const Snowflake = createIconComponent('Snowflake', lucideLib.Snowflake);
export const CloudRain = createIconComponent('CloudRain', lucideLib.CloudRain);
export const Wind = createIconComponent('Wind', lucideLib.Wind);
export const Music = createIconComponent('Music', lucideLib.Music);
export const Mic = createIconComponent('Mic', lucideLib.Mic);
export const Headphones = createIconComponent('Headphones', lucideLib.Headphones);
export const Video = createIconComponent('Video', lucideLib.Video);
export const Camera = createIconComponent('Camera', lucideLib.Camera);
export const Image = createIconComponent('Image', lucideLib.Image);
export const Coffee = createIconComponent('Coffee', lucideLib.Coffee);
export const Pizza = createIconComponent('Pizza', lucideLib.Pizza);
export const Cake = createIconComponent('Cake', lucideLib.Cake);
export const Car = createIconComponent('Car', lucideLib.Car);
export const Truck = createIconComponent('Truck', lucideLib.Truck);
export const Plane = createIconComponent('Plane', lucideLib.Plane);
export const Rocket = createIconComponent('Rocket', lucideLib.Rocket);
export const Building = createIconComponent('Building', lucideLib.Building);
export const Key = createIconComponent('Key', lucideLib.Key);
export const Pencil = createIconComponent('Pencil', lucideLib.Pencil);
export const Brush = createIconComponent('Brush', lucideLib.Brush);
export const Palette = createIconComponent('Palette', lucideLib.Palette);
export const Scissors = createIconComponent('Scissors', lucideLib.Scissors);
export const Lightbulb = createIconComponent('Lightbulb', lucideLib.Lightbulb);
export const Gem = createIconComponent('Gem', lucideLib.Gem);
export const Diamond = createIconComponent('Diamond', lucideLib.Diamond);
export const Sparkle = createIconComponent('Sparkle', lucideLib.Sparkle);
export const PartyPopper = createIconComponent('PartyPopper', lucideLib.PartyPopper);
export const Angry = createIconComponent('Angry', lucideLib.Angry);
export const Laugh = createIconComponent('Laugh', lucideLib.Laugh);
export const Frown = createIconComponent('Frown', lucideLib.Frown);
export const Meh = createIconComponent('Meh', lucideLib.Meh);
export const HeartCrack = createIconComponent('HeartCrack', lucideLib.HeartCrack);
export const Users = createIconComponent('Users', lucideLib.Users);
export const UserPlus = createIconComponent('UserPlus', lucideLib.UserPlus);
export const UserMinus = createIconComponent('UserMinus', lucideLib.UserMinus);
export const UserCheck = createIconComponent('UserCheck', lucideLib.UserCheck);
export const Shield = createIconComponent('Shield', lucideLib.Shield);
export const ShieldCheck = createIconComponent('ShieldCheck', lucideLib.ShieldCheck);
export const Verified = createIconComponent('Verified', lucideLib.Verified);
export const BadgeCheck = createIconComponent('BadgeCheck', lucideLib.BadgeCheck);
export const HelpCircle = createIconComponent('HelpCircle', lucideLib.HelpCircle);
export const MessageSquare = createIconComponent('MessageSquare', lucideLib.MessageSquare);
export const Reply = createIconComponent('Reply', lucideLib.Reply);
export const Forward = createIconComponent('Forward', lucideLib.Forward);
export const FileText = createIconComponent('FileText', lucideLib.FileText);
export const Clipboard = createIconComponent('Clipboard', lucideLib.Clipboard);
export const ClipboardCheck = createIconComponent('ClipboardCheck', lucideLib.ClipboardCheck);
export const StickyNote = createIconComponent('StickyNote', lucideLib.StickyNote);
export const Pin = createIconComponent('Pin', lucideLib.Pin);
export const Paperclip = createIconComponent('Paperclip', lucideLib.Paperclip);
export const AtSign = createIconComponent('AtSign', lucideLib.AtSign);
export const Hash = createIconComponent('Hash', lucideLib.Hash);
export const DollarSign = createIconComponent('DollarSign', lucideLib.DollarSign);
export const CreditCard = createIconComponent('CreditCard', lucideLib.CreditCard);
export const Wallet = createIconComponent('Wallet', lucideLib.Wallet);
export const ShoppingBag = createIconComponent('ShoppingBag', lucideLib.ShoppingBag);
export const ShoppingCart = createIconComponent('ShoppingCart', lucideLib.ShoppingCart);
export const Package = createIconComponent('Package', lucideLib.Package);
export const Timer = createIconComponent('Timer', lucideLib.Timer);
export const Hourglass = createIconComponent('Hourglass', lucideLib.Hourglass);
export const AlarmClock = createIconComponent('AlarmClock', lucideLib.AlarmClock);
export const Wifi = createIconComponent('Wifi', lucideLib.Wifi);
export const WifiOff = createIconComponent('WifiOff', lucideLib.WifiOff);
export const Bluetooth = createIconComponent('Bluetooth', lucideLib.Bluetooth);
export const Battery = createIconComponent('Battery', lucideLib.Battery);
export const Signal = createIconComponent('Signal', lucideLib.Signal);
export const Smartphone = createIconComponent('Smartphone', lucideLib.Smartphone);
export const Tablet = createIconComponent('Tablet', lucideLib.Tablet);
export const Laptop = createIconComponent('Laptop', lucideLib.Laptop);
export const Monitor = createIconComponent('Monitor', lucideLib.Monitor);
export const Tv = createIconComponent('Tv', lucideLib.Tv);
export const Server = createIconComponent('Server', lucideLib.Server);
export const Database = createIconComponent('Database', lucideLib.Database);
export const Cloud = createIconComponent('Cloud', lucideLib.Cloud);
export const CloudUpload = createIconComponent('CloudUpload', lucideLib.CloudUpload);
export const CloudDownload = createIconComponent('CloudDownload', lucideLib.CloudDownload);
export const Map = createIconComponent('Map', lucideLib.Map);
export const Compass = createIconComponent('Compass', lucideLib.Compass);
export const Navigation = createIconComponent('Navigation', lucideLib.Navigation);
export const Printer = createIconComponent('Printer', lucideLib.Printer);
export const QrCode = createIconComponent('QrCode', lucideLib.QrCode);
export const Scan = createIconComponent('Scan', lucideLib.Scan);
export const Fingerprint = createIconComponent('Fingerprint', lucideLib.Fingerprint);
export const Move = createIconComponent('Move', lucideLib.Move);
export const Maximize = createIconComponent('Maximize', lucideLib.Maximize);
export const Minimize = createIconComponent('Minimize', lucideLib.Minimize);
export const Expand = createIconComponent('Expand', lucideLib.Expand);
export const Shrink = createIconComponent('Shrink', lucideLib.Shrink);
export const RotateCcw = createIconComponent('RotateCcw', lucideLib.RotateCcw);
export const Repeat = createIconComponent('Repeat', lucideLib.Repeat);
export const Shuffle = createIconComponent('Shuffle', lucideLib.Shuffle);
export const FastForward = createIconComponent('FastForward', lucideLib.FastForward);
export const Rewind = createIconComponent('Rewind', lucideLib.Rewind);
export const SkipForward = createIconComponent('SkipForward', lucideLib.SkipForward);
export const SkipBack = createIconComponent('SkipBack', lucideLib.SkipBack);
export const PlayCircle = createIconComponent('PlayCircle', lucideLib.PlayCircle);
export const PauseCircle = createIconComponent('PauseCircle', lucideLib.PauseCircle);
export const StopCircle = createIconComponent('StopCircle', lucideLib.StopCircle);
export const Volume = createIconComponent('Volume', lucideLib.Volume);
export const Volume2 = createIconComponent('Volume2', lucideLib.Volume2);
export const VolumeX = createIconComponent('VolumeX', lucideLib.VolumeX);
export const MicOff = createIconComponent('MicOff', lucideLib.MicOff);
export const VideoOff = createIconComponent('VideoOff', lucideLib.VideoOff);
export const CameraOff = createIconComponent('CameraOff', lucideLib.CameraOff);
export const Type = createIconComponent('Type', lucideLib.Type);
export const Bold = createIconComponent('Bold', lucideLib.Bold);
export const Italic = createIconComponent('Italic', lucideLib.Italic);
export const Underline = createIconComponent('Underline', lucideLib.Underline);
export const AlignLeft = createIconComponent('AlignLeft', lucideLib.AlignLeft);
export const AlignCenter = createIconComponent('AlignCenter', lucideLib.AlignCenter);
export const AlignRight = createIconComponent('AlignRight', lucideLib.AlignRight);
export const AlignJustify = createIconComponent('AlignJustify', lucideLib.AlignJustify);
export const Undo = createIconComponent('Undo', lucideLib.Undo);
export const Redo = createIconComponent('Redo', lucideLib.Redo);
export const Quote = createIconComponent('Quote', lucideLib.Quote);
export const Link = createIconComponent('Link', lucideLib.Link);
export const LinkOff = createIconComponent('LinkOff', lucideLib.LinkOff);
export const Unlink = createIconComponent('Unlink', lucideLib.Unlink);
export const GripVertical = createIconComponent('GripVertical', lucideLib.GripVertical);
export const GripHorizontal = createIconComponent('GripHorizontal', lucideLib.GripHorizontal);
export const CircleCheck = createIconComponent('CircleCheck', lucideLib.CircleCheck);
export const CircleX = createIconComponent('CircleX', lucideLib.CircleX);
export const CirclePlus = createIconComponent('CirclePlus', lucideLib.CirclePlus);
export const CircleMinus = createIconComponent('CircleMinus', lucideLib.CircleMinus);
export const CircleAlert = createIconComponent('CircleAlert', lucideLib.CircleAlert);
export const CircleHelp = createIconComponent('CircleHelp', lucideLib.CircleHelp);
export const CircleUser = createIconComponent('CircleUser', lucideLib.CircleUser);
export const CirclePlay = createIconComponent('CirclePlay', lucideLib.CirclePlay);
export const CirclePause = createIconComponent('CirclePause', lucideLib.CirclePause);
export const CircleStop = createIconComponent('CircleStop', lucideLib.CircleStop);
export const Trash2 = createIconComponent('Trash2', lucideLib.Trash2);
export const Edit2 = createIconComponent('Edit2', lucideLib.Edit2);
export const Edit3 = createIconComponent('Edit3', lucideLib.Edit3);
export const PenLine = createIconComponent('PenLine', lucideLib.PenLine);
export const PenTool = createIconComponent('PenTool', lucideLib.PenTool);
export const Eraser = createIconComponent('Eraser', lucideLib.Eraser);
export const Highlighter = createIconComponent('Highlighter', lucideLib.Highlighter);
export const Crop = createIconComponent('Crop', lucideLib.Crop);
export const ZoomIn = createIconComponent('ZoomIn', lucideLib.ZoomIn);
export const ZoomOut = createIconComponent('ZoomOut', lucideLib.ZoomOut);
export const RotateCw = createIconComponent('RotateCw', lucideLib.RotateCw);
export const FlipHorizontal = createIconComponent('FlipHorizontal', lucideLib.FlipHorizontal);
export const FlipVertical = createIconComponent('FlipVertical', lucideLib.FlipVertical);
export const Square = createIconComponent('Square', lucideLib.Square);
export const Circle = createIconComponent('Circle', lucideLib.Circle);
export const Triangle = createIconComponent('Triangle', lucideLib.Triangle);
export const Hexagon = createIconComponent('Hexagon', lucideLib.Hexagon);
export const Pentagon = createIconComponent('Pentagon', lucideLib.Pentagon);
export const Octagon = createIconComponent('Octagon', lucideLib.Octagon);
export const Box = createIconComponent('Box', lucideLib.Box);
export const Boxes = createIconComponent('Boxes', lucideLib.Boxes);
export const Cube = createIconComponent('Cube', lucideLib.Cube);
export const Cylinder = createIconComponent('Cylinder', lucideLib.Cylinder);
export const Shapes = createIconComponent('Shapes', lucideLib.Shapes);
export const Gamepad = createIconComponent('Gamepad', lucideLib.Gamepad);
export const Gamepad2 = createIconComponent('Gamepad2', lucideLib.Gamepad2);
export const Dices = createIconComponent('Dices', lucideLib.Dices);
export const Puzzle = createIconComponent('Puzzle', lucideLib.Puzzle);
export const Swords = createIconComponent('Swords', lucideLib.Swords);
export const Wand = createIconComponent('Wand', lucideLib.Wand);
export const Wand2 = createIconComponent('Wand2', lucideLib.Wand2);
export const PlusCircle = createIconComponent('PlusCircle', lucideLib.PlusCircle);
export const MinusCircle = createIconComponent('MinusCircle', lucideLib.MinusCircle);
export const XOctagon = createIconComponent('XOctagon', lucideLib.XOctagon);
export const AlertTriangle = createIconComponent('AlertTriangle', lucideLib.AlertTriangle);
export const AlertOctagon = createIconComponent('AlertOctagon', lucideLib.AlertOctagon);
export const BellRing = createIconComponent('BellRing', lucideLib.BellRing);
export const BellOff = createIconComponent('BellOff', lucideLib.BellOff);
export const BellPlus = createIconComponent('BellPlus', lucideLib.BellPlus);
export const BellMinus = createIconComponent('BellMinus', lucideLib.BellMinus);
export const ChevronFirst = createIconComponent('ChevronFirst', lucideLib.ChevronFirst);
export const ChevronLast = createIconComponent('ChevronLast', lucideLib.ChevronLast);
export const ChevronsLeft = createIconComponent('ChevronsLeft', lucideLib.ChevronsLeft);
export const ChevronsRight = createIconComponent('ChevronsRight', lucideLib.ChevronsRight);
export const ChevronsUp = createIconComponent('ChevronsUp', lucideLib.ChevronsUp);
export const ChevronsDown = createIconComponent('ChevronsDown', lucideLib.ChevronsDown);
export const ChevronsUpDown = createIconComponent('ChevronsUpDown', lucideLib.ChevronsUpDown);
export const ArrowUpRight = createIconComponent('ArrowUpRight', lucideLib.ArrowUpRight);
export const ArrowDownRight = createIconComponent('ArrowDownRight', lucideLib.ArrowDownRight);
export const ArrowUpLeft = createIconComponent('ArrowUpLeft', lucideLib.ArrowUpLeft);
export const ArrowDownLeft = createIconComponent('ArrowDownLeft', lucideLib.ArrowDownLeft);
export const ArrowBigUp = createIconComponent('ArrowBigUp', lucideLib.ArrowBigUp);
export const ArrowBigDown = createIconComponent('ArrowBigDown', lucideLib.ArrowBigDown);
export const ArrowBigLeft = createIconComponent('ArrowBigLeft', lucideLib.ArrowBigLeft);
export const ArrowBigRight = createIconComponent('ArrowBigRight', lucideLib.ArrowBigRight);
export const MoveUp = createIconComponent('MoveUp', lucideLib.MoveUp);
export const MoveDown = createIconComponent('MoveDown', lucideLib.MoveDown);
export const MoveLeft = createIconComponent('MoveLeft', lucideLib.MoveLeft);
export const MoveRight = createIconComponent('MoveRight', lucideLib.MoveRight);
export const PanelLeft = createIconComponent('PanelLeft', lucideLib.PanelLeft);
export const PanelRight = createIconComponent('PanelRight', lucideLib.PanelRight);
export const PanelTop = createIconComponent('PanelTop', lucideLib.PanelTop);
export const PanelBottom = createIconComponent('PanelBottom', lucideLib.PanelBottom);
export const Sidebar = createIconComponent('Sidebar', lucideLib.Sidebar);
export const SidebarOpen = createIconComponent('SidebarOpen', lucideLib.SidebarOpen);
export const SidebarClose = createIconComponent('SidebarClose', lucideLib.SidebarClose);
export const LayoutGrid = createIconComponent('LayoutGrid', lucideLib.LayoutGrid);
export const LayoutList = createIconComponent('LayoutList', lucideLib.LayoutList);
export const LayoutDashboard = createIconComponent('LayoutDashboard', lucideLib.LayoutDashboard);
export const LayoutTemplate = createIconComponent('LayoutTemplate', lucideLib.LayoutTemplate);
export const Table = createIconComponent('Table', lucideLib.Table);
export const Table2 = createIconComponent('Table2', lucideLib.Table2);
export const Columns = createIconComponent('Columns', lucideLib.Columns);
export const Rows = createIconComponent('Rows', lucideLib.Rows);
export const Split = createIconComponent('Split', lucideLib.Split);
export const Merge = createIconComponent('Merge', lucideLib.Merge);
export const Github = createIconComponent('Github', lucideLib.Github);
export const Gitlab = createIconComponent('Gitlab', lucideLib.Gitlab);
export const Twitter = createIconComponent('Twitter', lucideLib.Twitter);
export const Facebook = createIconComponent('Facebook', lucideLib.Facebook);
export const Instagram = createIconComponent('Instagram', lucideLib.Instagram);
export const Linkedin = createIconComponent('Linkedin', lucideLib.Linkedin);
export const Youtube = createIconComponent('Youtube', lucideLib.Youtube);
export const Twitch = createIconComponent('Twitch', lucideLib.Twitch);
export const Slack = createIconComponent('Slack', lucideLib.Slack);
export const Chrome = createIconComponent('Chrome', lucideLib.Chrome);
export const Figma = createIconComponent('Figma', lucideLib.Figma);
export const Framer = createIconComponent('Framer', lucideLib.Framer);
export const Apple = createIconComponent('Apple', lucideLib.Apple);
export const Dribbble = createIconComponent('Dribbble', lucideLib.Dribbble);
export const Copyright = createIconComponent('Copyright', lucideLib.Copyright);
export const Trademark = createIconComponent('Trademark', lucideLib.Trademark);
export const Percent = createIconComponent('Percent', lucideLib.Percent);
export const Infinity = createIconComponent('Infinity', lucideLib.Infinity);
export const Equal = createIconComponent('Equal', lucideLib.Equal);
export const EqualNot = createIconComponent('EqualNot', lucideLib.EqualNot);
export const Divide = createIconComponent('Divide', lucideLib.Divide);
export const Sigma = createIconComponent('Sigma', lucideLib.Sigma);
export const Pi = createIconComponent('Pi', lucideLib.Pi);
export const Asterisk = createIconComponent('Asterisk', lucideLib.Asterisk);
export const Grip = createIconComponent('Grip', lucideLib.Grip);
export const MoreHorizontalIcon = createIconComponent('MoreHorizontal', lucideLib.MoreHorizontal);
export const Ellipsis = createIconComponent('Ellipsis', lucideLib.Ellipsis);
export const EllipsisVertical = createIconComponent('EllipsisVertical', lucideLib.EllipsisVertical);
export const House = createIconComponent('House', lucideLib.House);
export const Building2 = createIconComponent('Building2', lucideLib.Building2);
export const Store = createIconComponent('Store', lucideLib.Store);
export const Factory = createIconComponent('Factory', lucideLib.Factory);
export const Warehouse = createIconComponent('Warehouse', lucideLib.Warehouse);
export const Hotel = createIconComponent('Hotel', lucideLib.Hotel);
export const Hospital = createIconComponent('Hospital', lucideLib.Hospital);
export const School = createIconComponent('School', lucideLib.School);
export const Library = createIconComponent('Library', lucideLib.Library);
export const Church = createIconComponent('Church', lucideLib.Church);
export const Castle = createIconComponent('Castle', lucideLib.Castle);
export const Mountain = createIconComponent('Mountain', lucideLib.Mountain);
export const Trees = createIconComponent('Trees', lucideLib.Trees);
export const Tent = createIconComponent('Tent', lucideLib.Tent);
export const Anchor = createIconComponent('Anchor', lucideLib.Anchor);
export const Ship = createIconComponent('Ship', lucideLib.Ship);
export const Sailboat = createIconComponent('Sailboat', lucideLib.Sailboat);
export const Train = createIconComponent('Train', lucideLib.Train);
export const Bus = createIconComponent('Bus', lucideLib.Bus);
export const Bike = createIconComponent('Bike', lucideLib.Bike);
export const Footprints = createIconComponent('Footprints', lucideLib.Footprints);
export const Baby = createIconComponent('Baby', lucideLib.Baby);
export const PersonStanding = createIconComponent('PersonStanding', lucideLib.PersonStanding);
export const Accessibility = createIconComponent('Accessibility', lucideLib.Accessibility);
export const Ear = createIconComponent('Ear', lucideLib.Ear);
export const EarOff = createIconComponent('EarOff', lucideLib.EarOff);
export const Hand = createIconComponent('Hand', lucideLib.Hand);
export const HandMetal = createIconComponent('HandMetal', lucideLib.HandMetal);
export const ThumbsUp = createIconComponent('ThumbsUp', lucideLib.ThumbsUp);
export const ThumbsDown = createIconComponent('ThumbsDown', lucideLib.ThumbsDown);
export const Grab = createIconComponent('Grab', lucideLib.Grab);
export const Pointer = createIconComponent('Pointer', lucideLib.Pointer);
export const MousePointer = createIconComponent('MousePointer', lucideLib.MousePointer);
export const MousePointer2 = createIconComponent('MousePointer2', lucideLib.MousePointer2);
export const Mouse = createIconComponent('Mouse', lucideLib.Mouse);
export const Keyboard = createIconComponent('Keyboard', lucideLib.Keyboard);
export const Joystick = createIconComponent('Joystick', lucideLib.Joystick);
export const Command = createIconComponent('Command', lucideLib.Command);
export const Option = createIconComponent('Option', lucideLib.Option);
export const Delete = createIconComponent('Delete', lucideLib.Delete);
export const CornerUpLeft = createIconComponent('CornerUpLeft', lucideLib.CornerUpLeft);
export const CornerUpRight = createIconComponent('CornerUpRight', lucideLib.CornerUpRight);
export const CornerDownLeft = createIconComponent('CornerDownLeft', lucideLib.CornerDownLeft);
export const CornerDownRight = createIconComponent('CornerDownRight', lucideLib.CornerDownRight);
export const File = createIconComponent('File', lucideLib.File);
export const FileCode = createIconComponent('FileCode', lucideLib.FileCode);
export const FileJson = createIconComponent('FileJson', lucideLib.FileJson);
export const FilePlus = createIconComponent('FilePlus', lucideLib.FilePlus);
export const FileMinus = createIconComponent('FileMinus', lucideLib.FileMinus);
export const FileX = createIconComponent('FileX', lucideLib.FileX);
export const FileCheck = createIconComponent('FileCheck', lucideLib.FileCheck);
export const FileSearch = createIconComponent('FileSearch', lucideLib.FileSearch);
export const FileImage = createIconComponent('FileImage', lucideLib.FileImage);
export const FileVideo = createIconComponent('FileVideo', lucideLib.FileVideo);
export const FileAudio = createIconComponent('FileAudio', lucideLib.FileAudio);
export const FileArchive = createIconComponent('FileArchive', lucideLib.FileArchive);
export const FileSpreadsheet = createIconComponent('FileSpreadsheet', lucideLib.FileSpreadsheet);
export const FileType = createIconComponent('FileType', lucideLib.FileType);
export const FileType2 = createIconComponent('FileType2', lucideLib.FileType2);
export const Files = createIconComponent('Files', lucideLib.Files);
export const FolderOpen = createIconComponent('FolderOpen', lucideLib.FolderOpen);
export const FolderPlus = createIconComponent('FolderPlus', lucideLib.FolderPlus);
export const FolderMinus = createIconComponent('FolderMinus', lucideLib.FolderMinus);
export const FolderX = createIconComponent('FolderX', lucideLib.FolderX);
export const FolderCheck = createIconComponent('FolderCheck', lucideLib.FolderCheck);
export const FolderSearch = createIconComponent('FolderSearch', lucideLib.FolderSearch);
export const FolderArchive = createIconComponent('FolderArchive', lucideLib.FolderArchive);
export const Folders = createIconComponent('Folders', lucideLib.Folders);
export const Archive = createIconComponent('Archive', lucideLib.Archive);
export const Inbox = createIconComponent('Inbox', lucideLib.Inbox);
export const MailOpen = createIconComponent('MailOpen', lucideLib.MailOpen);
export const MailCheck = createIconComponent('MailCheck', lucideLib.MailCheck);
export const MailPlus = createIconComponent('MailPlus', lucideLib.MailPlus);
export const MailMinus = createIconComponent('MailMinus', lucideLib.MailMinus);
export const MailX = createIconComponent('MailX', lucideLib.MailX);
export const MailSearch = createIconComponent('MailSearch', lucideLib.MailSearch);
export const MailWarning = createIconComponent('MailWarning', lucideLib.MailWarning);
export const MailQuestion = createIconComponent('MailQuestion', lucideLib.MailQuestion);
export const Mails = createIconComponent('Mails', lucideLib.Mails);
export const MessagesSquare = createIconComponent('MessagesSquare', lucideLib.MessagesSquare);
export const MessageSquarePlus = createIconComponent('MessageSquarePlus', lucideLib.MessageSquarePlus);
export const MessageSquareDashed = createIconComponent('MessageSquareDashed', lucideLib.MessageSquareDashed);
export const MessageSquareWarning = createIconComponent('MessageSquareWarning', lucideLib.MessageSquareWarning);
export const MessageSquareX = createIconComponent('MessageSquareX', lucideLib.MessageSquareX);
export const MessageCirclePlus = createIconComponent('MessageCirclePlus', lucideLib.MessageCirclePlus);
export const MessageCircleWarning = createIconComponent('MessageCircleWarning', lucideLib.MessageCircleWarning);
export const MessageCircleX = createIconComponent('MessageCircleX', lucideLib.MessageCircleX);
export const Speech = createIconComponent('Speech', lucideLib.Speech);
export const Quote as QuoteIcon = createIconComponent('Quote', lucideLib.Quote);
export const Text = createIconComponent('Text', lucideLib.Text);
export const TextCursor = createIconComponent('TextCursor', lucideLib.TextCursor);
export const TextCursorInput = createIconComponent('TextCursorInput', lucideLib.TextCursorInput);
export const TextSelect = createIconComponent('TextSelect', lucideLib.TextSelect);
export const TextSearch = createIconComponent('TextSearch', lucideLib.TextSearch);
export const Heading = createIconComponent('Heading', lucideLib.Heading);
export const Heading1 = createIconComponent('Heading1', lucideLib.Heading1);
export const Heading2 = createIconComponent('Heading2', lucideLib.Heading2);
export const Heading3 = createIconComponent('Heading3', lucideLib.Heading3);
export const Heading4 = createIconComponent('Heading4', lucideLib.Heading4);
export const Heading5 = createIconComponent('Heading5', lucideLib.Heading5);
export const Heading6 = createIconComponent('Heading6', lucideLib.Heading6);
export const ListOrdered = createIconComponent('ListOrdered', lucideLib.ListOrdered);
export const ListChecks = createIconComponent('ListChecks', lucideLib.ListChecks);
export const ListTodo = createIconComponent('ListTodo', lucideLib.ListTodo);
export const ListPlus = createIconComponent('ListPlus', lucideLib.ListPlus);
export const ListMinus = createIconComponent('ListMinus', lucideLib.ListMinus);
export const ListX = createIconComponent('ListX', lucideLib.ListX);
export const ListFilter = createIconComponent('ListFilter', lucideLib.ListFilter);
export const ListTree = createIconComponent('ListTree', lucideLib.ListTree);
export const ListCollapse = createIconComponent('ListCollapse', lucideLib.ListCollapse);
export const ListRestart = createIconComponent('ListRestart', lucideLib.ListRestart);
export const Indent = createIconComponent('Indent', lucideLib.Indent);
export const Outdent = createIconComponent('Outdent', lucideLib.Outdent);
export const WrapText = createIconComponent('WrapText', lucideLib.WrapText);
export const CaseSensitive = createIconComponent('CaseSensitive', lucideLib.CaseSensitive);
export const CaseUpper = createIconComponent('CaseUpper', lucideLib.CaseUpper);
export const CaseLower = createIconComponent('CaseLower', lucideLib.CaseLower);
export const Strikethrough = createIconComponent('Strikethrough', lucideLib.Strikethrough);
export const Subscript = createIconComponent('Subscript', lucideLib.Subscript);
export const Superscript = createIconComponent('Superscript', lucideLib.Superscript);
export const RemoveFormatting = createIconComponent('RemoveFormatting', lucideLib.RemoveFormatting);
export const Spellcheck = createIconComponent('Spellcheck', lucideLib.Spellcheck);
export const Languages as LanguagesIcon = createIconComponent('Languages', lucideLib.Languages);
export const BrainCircuit = createIconComponent('BrainCircuit', lucideLib.BrainCircuit);
export const BrainCog = createIconComponent('BrainCog', lucideLib.BrainCog);
export const Brain = createIconComponent('Brain', lucideLib.Brain);
export const Cpu = createIconComponent('Cpu', lucideLib.Cpu);
export const Chip = createIconComponent('Chip', lucideLib.Chip);
export const Bot = createIconComponent('Bot', lucideLib.Bot);
export const BotMessageSquare = createIconComponent('BotMessageSquare', lucideLib.BotMessageSquare);
export const Workflow = createIconComponent('Workflow', lucideLib.Workflow);
export const GitBranch = createIconComponent('GitBranch', lucideLib.GitBranch);
export const GitCommit = createIconComponent('GitCommit', lucideLib.GitCommit);
export const GitMerge = createIconComponent('GitMerge', lucideLib.GitMerge);
export const GitPullRequest = createIconComponent('GitPullRequest', lucideLib.GitPullRequest);
export const GitCompare = createIconComponent('GitCompare', lucideLib.GitCompare);
export const GitFork = createIconComponent('GitFork', lucideLib.GitFork);
export const Bug = createIconComponent('Bug', lucideLib.Bug);
export const BugOff = createIconComponent('BugOff', lucideLib.BugOff);
export const BugPlay = createIconComponent('BugPlay', lucideLib.BugPlay);
export const TestTube = createIconComponent('TestTube', lucideLib.TestTube);
export const TestTube2 = createIconComponent('TestTube2', lucideLib.TestTube2);
export const TestTubes = createIconComponent('TestTubes', lucideLib.TestTubes);
export const FlaskConical = createIconComponent('FlaskConical', lucideLib.FlaskConical);
export const FlaskRound = createIconComponent('FlaskRound', lucideLib.FlaskRound);
export const Microscope = createIconComponent('Microscope', lucideLib.Microscope);
export const Stethoscope = createIconComponent('Stethoscope', lucideLib.Stethoscope);
export const Syringe = createIconComponent('Syringe', lucideLib.Syringe);
export const Pill = createIconComponent('Pill', lucideLib.Pill);
export const Tablets = createIconComponent('Tablets', lucideLib.Tablets);
export const Thermometer = createIconComponent('Thermometer', lucideLib.Thermometer);
export const ThermometerSun = createIconComponent('ThermometerSun', lucideLib.ThermometerSun);
export const ThermometerSnowflake = createIconComponent('ThermometerSnowflake', lucideLib.ThermometerSnowflake);
export const HeartPulse = createIconComponent('HeartPulse', lucideLib.HeartPulse);
export const HeartHandshake = createIconComponent('HeartHandshake', lucideLib.HeartHandshake);
export const Droplet = createIconComponent('Droplet', lucideLib.Droplet);
export const Droplets = createIconComponent('Droplets', lucideLib.Droplets);
export const Waves = createIconComponent('Waves', lucideLib.Waves);
export const Sunrise = createIconComponent('Sunrise', lucideLib.Sunrise);
export const Sunset = createIconComponent('Sunset', lucideLib.Sunset);
export const CloudSun = createIconComponent('CloudSun', lucideLib.CloudSun);
export const CloudMoon = createIconComponent('CloudMoon', lucideLib.CloudMoon);
export const CloudSnow = createIconComponent('CloudSnow', lucideLib.CloudSnow);
export const CloudLightning = createIconComponent('CloudLightning', lucideLib.CloudLightning);
export const CloudDrizzle = createIconComponent('CloudDrizzle', lucideLib.CloudDrizzle);
export const CloudFog = createIconComponent('CloudFog', lucideLib.CloudFog);
export const CloudHail = createIconComponent('CloudHail', lucideLib.CloudHail);
export const CloudOff = createIconComponent('CloudOff', lucideLib.CloudOff);
export const Tornado = createIconComponent('Tornado', lucideLib.Tornado);
export const Flame as FlameIcon = createIconComponent('Flame', lucideLib.Flame);
export const Fuel = createIconComponent('Fuel', lucideLib.Fuel);
export const Gauge = createIconComponent('Gauge', lucideLib.Gauge);
export const Speedometer = createIconComponent('Speedometer', lucideLib.Speedometer);
export const Milestone = createIconComponent('Milestone', lucideLib.Milestone);
export const Goal = createIconComponent('Goal', lucideLib.Goal);
export const FlagTriangleLeft = createIconComponent('FlagTriangleLeft', lucideLib.FlagTriangleLeft);
export const FlagTriangleRight = createIconComponent('FlagTriangleRight', lucideLib.FlagTriangleRight);
export const Flag = createIconComponent('Flag', lucideLib.Flag);
export const FlagOff = createIconComponent('FlagOff', lucideLib.FlagOff);
export const Megaphone = createIconComponent('Megaphone', lucideLib.Megaphone);
export const MegaphoneOff = createIconComponent('MegaphoneOff', lucideLib.MegaphoneOff);
export const Radio = createIconComponent('Radio', lucideLib.Radio);
export const RadioReceiver = createIconComponent('RadioReceiver', lucideLib.RadioReceiver);
export const RadioTower = createIconComponent('RadioTower', lucideLib.RadioTower);
export const Satellite = createIconComponent('Satellite', lucideLib.Satellite);
export const SatelliteDish = createIconComponent('SatelliteDish', lucideLib.SatelliteDish);
export const Rss = createIconComponent('Rss', lucideLib.Rss);
export const Podcast = createIconComponent('Podcast', lucideLib.Podcast);
export const TrendingDown = createIconComponent('TrendingDown', lucideLib.TrendingDown);
export const LineChart = createIconComponent('LineChart', lucideLib.LineChart);
export const BarChart2 = createIconComponent('BarChart2', lucideLib.BarChart2);
export const BarChart3 = createIconComponent('BarChart3', lucideLib.BarChart3);
export const BarChart4 = createIconComponent('BarChart4', lucideLib.BarChart4);
export const BarChartBig = createIconComponent('BarChartBig', lucideLib.BarChartBig);
export const BarChartHorizontal = createIconComponent('BarChartHorizontal', lucideLib.BarChartHorizontal);
export const BarChartHorizontalBig = createIconComponent('BarChartHorizontalBig', lucideLib.BarChartHorizontalBig);
export const AreaChart = createIconComponent('AreaChart', lucideLib.AreaChart);
export const PieChart = createIconComponent('PieChart', lucideLib.PieChart);
export const ScatterChart = createIconComponent('ScatterChart', lucideLib.ScatterChart);
export const CandlestickChart = createIconComponent('CandlestickChart', lucideLib.CandlestickChart);
export const GanttChart = createIconComponent('GanttChart', lucideLib.GanttChart);
export const CalendarDays = createIconComponent('CalendarDays', lucideLib.CalendarDays);
export const CalendarCheck = createIconComponent('CalendarCheck', lucideLib.CalendarCheck);
export const CalendarCheck2 = createIconComponent('CalendarCheck2', lucideLib.CalendarCheck2);
export const CalendarPlus = createIconComponent('CalendarPlus', lucideLib.CalendarPlus);
export const CalendarMinus = createIconComponent('CalendarMinus', lucideLib.CalendarMinus);
export const CalendarX = createIconComponent('CalendarX', lucideLib.CalendarX);
export const CalendarX2 = createIconComponent('CalendarX2', lucideLib.CalendarX2);
export const CalendarSearch = createIconComponent('CalendarSearch', lucideLib.CalendarSearch);
export const CalendarClock = createIconComponent('CalendarClock', lucideLib.CalendarClock);
export const CalendarHeart = createIconComponent('CalendarHeart', lucideLib.CalendarHeart);
export const CalendarRange = createIconComponent('CalendarRange', lucideLib.CalendarRange);
export const CalendarOff = createIconComponent('CalendarOff', lucideLib.CalendarOff);
export const CalendarFold = createIconComponent('CalendarFold', lucideLib.CalendarFold);
export const History = createIconComponent('History', lucideLib.History);
export const Watch = createIconComponent('Watch', lucideLib.Watch);
export const Stopwatch = createIconComponent('Stopwatch', lucideLib.Stopwatch);
export const TimerOff = createIconComponent('TimerOff', lucideLib.TimerOff);
export const TimerReset = createIconComponent('TimerReset', lucideLib.TimerReset);
export const AlarmClockOff = createIconComponent('AlarmClockOff', lucideLib.AlarmClockOff);
export const AlarmClockCheck = createIconComponent('AlarmClockCheck', lucideLib.AlarmClockCheck);
export const AlarmClockPlus = createIconComponent('AlarmClockPlus', lucideLib.AlarmClockPlus);
export const AlarmClockMinus = createIconComponent('AlarmClockMinus', lucideLib.AlarmClockMinus);
export const ClockIcon = createIconComponent('Clock', lucideLib.Clock);
export const Clock1 = createIconComponent('Clock1', lucideLib.Clock1);
export const Clock2 = createIconComponent('Clock2', lucideLib.Clock2);
export const Clock3 = createIconComponent('Clock3', lucideLib.Clock3);
export const Clock4 = createIconComponent('Clock4', lucideLib.Clock4);
export const Clock5 = createIconComponent('Clock5', lucideLib.Clock5);
export const Clock6 = createIconComponent('Clock6', lucideLib.Clock6);
export const Clock7 = createIconComponent('Clock7', lucideLib.Clock7);
export const Clock8 = createIconComponent('Clock8', lucideLib.Clock8);
export const Clock9 = createIconComponent('Clock9', lucideLib.Clock9);
export const Clock10 = createIconComponent('Clock10', lucideLib.Clock10);
export const Clock11 = createIconComponent('Clock11', lucideLib.Clock11);
export const Clock12 = createIconComponent('Clock12', lucideLib.Clock12);
export const Euro = createIconComponent('Euro', lucideLib.Euro);
export const PoundSterling = createIconComponent('PoundSterling', lucideLib.PoundSterling);
export const JapaneseYen = createIconComponent('JapaneseYen', lucideLib.JapaneseYen);
export const RussianRuble = createIconComponent('RussianRuble', lucideLib.RussianRuble);
export const SwissFranc = createIconComponent('SwissFranc', lucideLib.SwissFranc);
export const IndianRupee = createIconComponent('IndianRupee', lucideLib.IndianRupee);
export const BadgeDollarSign = createIconComponent('BadgeDollarSign', lucideLib.BadgeDollarSign);
export const BadgePercent = createIconComponent('BadgePercent', lucideLib.BadgePercent);
export const Receipt = createIconComponent('Receipt', lucideLib.Receipt);
export const ReceiptText = createIconComponent('ReceiptText', lucideLib.ReceiptText);
export const Banknote = createIconComponent('Banknote', lucideLib.Banknote);
export const Coins = createIconComponent('Coins', lucideLib.Coins);
export const PiggyBank = createIconComponent('PiggyBank', lucideLib.PiggyBank);
export const Vault = createIconComponent('Vault', lucideLib.Vault);
export const HandCoins = createIconComponent('HandCoins', lucideLib.HandCoins);
export const CircleDollarSign = createIconComponent('CircleDollarSign', lucideLib.CircleDollarSign);
export const BadgePlus = createIconComponent('BadgePlus', lucideLib.BadgePlus);
export const BadgeMinus = createIconComponent('BadgeMinus', lucideLib.BadgeMinus);
export const BadgeX = createIconComponent('BadgeX', lucideLib.BadgeX);
export const BadgeAlert = createIconComponent('BadgeAlert', lucideLib.BadgeAlert);
export const BadgeHelp = createIconComponent('BadgeHelp', lucideLib.BadgeHelp);
export const BadgeInfo = createIconComponent('BadgeInfo', lucideLib.BadgeInfo);
export const Award as AwardIcon = createIconComponent('Award', lucideLib.Award);
export const Medal as MedalIcon = createIconComponent('Medal', lucideLib.Medal);
export const Trophy as TrophyIcon = createIconComponent('Trophy', lucideLib.Trophy);
export const Crown as CrownIcon = createIconComponent('Crown', lucideLib.Crown);
export const LockKeyhole = createIconComponent('LockKeyhole', lucideLib.LockKeyhole);
export const LockOpen = createIconComponent('LockOpen', lucideLib.LockOpen);
export const Unlock = createIconComponent('Unlock', lucideLib.Unlock);
export const UnlockKeyhole = createIconComponent('UnlockKeyhole', lucideLib.UnlockKeyhole);
export const KeyRound = createIconComponent('KeyRound', lucideLib.KeyRound);
export const KeySquare = createIconComponent('KeySquare', lucideLib.KeySquare);
export const ShieldAlert = createIconComponent('ShieldAlert', lucideLib.ShieldAlert);
export const ShieldOff = createIconComponent('ShieldOff', lucideLib.ShieldOff);
export const ShieldPlus = createIconComponent('ShieldPlus', lucideLib.ShieldPlus);
export const ShieldMinus = createIconComponent('ShieldMinus', lucideLib.ShieldMinus);
export const ShieldX = createIconComponent('ShieldX', lucideLib.ShieldX);
export const ShieldQuestion = createIconComponent('ShieldQuestion', lucideLib.ShieldQuestion);
export const ShieldBan = createIconComponent('ShieldBan', lucideLib.ShieldBan);
export const ShieldEllipsis = createIconComponent('ShieldEllipsis', lucideLib.ShieldEllipsis);
export const ShieldHalf = createIconComponent('ShieldHalf', lucideLib.ShieldHalf);
export const ScanFace = createIconComponent('ScanFace', lucideLib.ScanFace);
export const ScanEye = createIconComponent('ScanEye', lucideLib.ScanEye);
export const ScanText = createIconComponent('ScanText', lucideLib.ScanText);
export const ScanLine = createIconComponent('ScanLine', lucideLib.ScanLine);
export const ScanBarcode = createIconComponent('ScanBarcode', lucideLib.ScanBarcode);
export const ScanSearch = createIconComponent('ScanSearch', lucideLib.ScanSearch);
export const QrCodeIcon = createIconComponent('QrCode', lucideLib.QrCode);
export const Barcode = createIconComponent('Barcode', lucideLib.Barcode);
export const NfcIcon = createIconComponent('Nfc', lucideLib.Nfc);
export const ContactlessIcon = createIconComponent('Contactless', lucideLib.Contactless);
export const SquareCheck = createIconComponent('SquareCheck', lucideLib.SquareCheck);
export const SquareX = createIconComponent('SquareX', lucideLib.SquareX);
export const SquarePlus = createIconComponent('SquarePlus', lucideLib.SquarePlus);
export const SquareMinus = createIconComponent('SquareMinus', lucideLib.SquareMinus);
export const SquareSlash = createIconComponent('SquareSlash', lucideLib.SquareSlash);
export const SquareCode = createIconComponent('SquareCode', lucideLib.SquareCode);
export const SquareDot = createIconComponent('SquareDot', lucideLib.SquareDot);
export const SquareAsterisk = createIconComponent('SquareAsterisk', lucideLib.SquareAsterisk);
export const SquareStack = createIconComponent('SquareStack', lucideLib.SquareStack);
export const SquareArrowUpRight = createIconComponent('SquareArrowUpRight', lucideLib.SquareArrowUpRight);
export const SquareArrowOutUpRight = createIconComponent('SquareArrowOutUpRight', lucideLib.SquareArrowOutUpRight);
export const ExternalLinkIcon = createIconComponent('ExternalLink', lucideLib.ExternalLink);
export const SquareArrowOutUpLeft = createIconComponent('SquareArrowOutUpLeft', lucideLib.SquareArrowOutUpLeft);
export const SquareArrowUp = createIconComponent('SquareArrowUp', lucideLib.SquareArrowUp);
export const SquareArrowDown = createIconComponent('SquareArrowDown', lucideLib.SquareArrowDown);
export const SquareArrowLeft = createIconComponent('SquareArrowLeft', lucideLib.SquareArrowLeft);
export const SquareArrowRight = createIconComponent('SquareArrowRight', lucideLib.SquareArrowRight);
export const SquareUser = createIconComponent('SquareUser', lucideLib.SquareUser);
export const SquareUserRound = createIconComponent('SquareUserRound', lucideLib.SquareUserRound);
export const SquarePen = createIconComponent('SquarePen', lucideLib.SquarePen);
export const SquareTerminal = createIconComponent('SquareTerminal', lucideLib.SquareTerminal);
export const SquareKanban = createIconComponent('SquareKanban', lucideLib.SquareKanban);
export const SquareGanttChart = createIconComponent('SquareGanttChart', lucideLib.SquareGanttChart);
export const SquareActivity = createIconComponent('SquareActivity', lucideLib.SquareActivity);
export const SquarePlay = createIconComponent('SquarePlay', lucideLib.SquarePlay);
export const SquareMenu = createIconComponent('SquareMenu', lucideLib.SquareMenu);
export const SquareLibrary = createIconComponent('SquareLibrary', lucideLib.SquareLibrary);
export const SquareBottomDashedScissors = createIconComponent('SquareBottomDashedScissors', lucideLib.SquareBottomDashedScissors);
export const SquareChartGantt = createIconComponent('SquareChartGantt', lucideLib.SquareChartGantt);
export const SquareFunction = createIconComponent('SquareFunction', lucideLib.SquareFunction);
export const SquareEqual = createIconComponent('SquareEqual', lucideLib.SquareEqual);
export const SquareDivide = createIconComponent('SquareDivide', lucideLib.SquareDivide);
export const SquareSigma = createIconComponent('SquareSigma', lucideLib.SquareSigma);
export const SquarePi = createIconComponent('SquarePi', lucideLib.SquarePi);
export const SquarePercent = createIconComponent('SquarePercent', lucideLib.SquarePercent);
export const SquareParking = createIconComponent('SquareParking', lucideLib.SquareParking);
export const SquareParkingOff = createIconComponent('SquareParkingOff', lucideLib.SquareParkingOff);
export const SquareM = createIconComponent('SquareM', lucideLib.SquareM);

// Work & Education icons (commonly used in portfolios)
export const Briefcase = createIconComponent('Briefcase', lucideLib.Briefcase);
export const BriefcaseBusiness = createIconComponent('BriefcaseBusiness', lucideLib.BriefcaseBusiness);
export const BriefcaseMedical = createIconComponent('BriefcaseMedical', lucideLib.BriefcaseMedical);
export const GraduationCap = createIconComponent('GraduationCap', lucideLib.GraduationCap);
export const BookMarked = createIconComponent('BookMarked', lucideLib.BookMarked);
export const BookCopy = createIconComponent('BookCopy', lucideLib.BookCopy);
export const BookText = createIconComponent('BookText', lucideLib.BookText);
export const BookOpenCheck = createIconComponent('BookOpenCheck', lucideLib.BookOpenCheck);
export const BookOpenText = createIconComponent('BookOpenText', lucideLib.BookOpenText);
export const BookUser = createIconComponent('BookUser', lucideLib.BookUser);
export const BookPlus = createIconComponent('BookPlus', lucideLib.BookPlus);
export const BookMinus = createIconComponent('BookMinus', lucideLib.BookMinus);
export const BookX = createIconComponent('BookX', lucideLib.BookX);
export const BookCheck = createIconComponent('BookCheck', lucideLib.BookCheck);
export const Notebook = createIconComponent('Notebook', lucideLib.Notebook);
export const NotebookPen = createIconComponent('NotebookPen', lucideLib.NotebookPen);
export const NotebookText = createIconComponent('NotebookText', lucideLib.NotebookText);
export const NotebookTabs = createIconComponent('NotebookTabs', lucideLib.NotebookTabs);
export const Presentation = createIconComponent('Presentation', lucideLib.Presentation);
export const PresentationIcon = createIconComponent('Presentation', lucideLib.Presentation);
export const GalleryHorizontal = createIconComponent('GalleryHorizontal', lucideLib.GalleryHorizontal);
export const GalleryVertical = createIconComponent('GalleryVertical', lucideLib.GalleryVertical);
export const GalleryHorizontalEnd = createIconComponent('GalleryHorizontalEnd', lucideLib.GalleryHorizontalEnd);
export const GalleryVerticalEnd = createIconComponent('GalleryVerticalEnd', lucideLib.GalleryVerticalEnd);
export const GalleryThumbnails = createIconComponent('GalleryThumbnails', lucideLib.GalleryThumbnails);

// Portfolio & Professional icons
export const Award2 = createIconComponent('Award', lucideLib.Award);
export const Briefcase2 = createIconComponent('Briefcase', lucideLib.Briefcase);
export const UserRound = createIconComponent('UserRound', lucideLib.UserRound);
export const UserRoundCheck = createIconComponent('UserRoundCheck', lucideLib.UserRoundCheck);
export const UserRoundPlus = createIconComponent('UserRoundPlus', lucideLib.UserRoundPlus);
export const UserRoundMinus = createIconComponent('UserRoundMinus', lucideLib.UserRoundMinus);
export const UserRoundX = createIconComponent('UserRoundX', lucideLib.UserRoundX);
export const UserRoundCog = createIconComponent('UserRoundCog', lucideLib.UserRoundCog);
export const UserRoundSearch = createIconComponent('UserRoundSearch', lucideLib.UserRoundSearch);
export const UserCog = createIconComponent('UserCog', lucideLib.UserCog);
export const UserX = createIconComponent('UserX', lucideLib.UserX);
export const UserSearch = createIconComponent('UserSearch', lucideLib.UserSearch);
export const UsersRound = createIconComponent('UsersRound', lucideLib.UsersRound);
export const Contact = createIconComponent('Contact', lucideLib.Contact);
export const Contact2 = createIconComponent('Contact2', lucideLib.Contact2);
export const ContactRound = createIconComponent('ContactRound', lucideLib.ContactRound);
export const IdCard = createIconComponent('IdCard', lucideLib.IdCard);
export const BadgeId = createIconComponent('BadgeId', lucideLib.BadgeId);
export const CircleUserRound = createIconComponent('CircleUserRound', lucideLib.CircleUserRound);
export const Handshake = createIconComponent('Handshake', lucideLib.Handshake);
export const Building3 = createIconComponent('Building', lucideLib.Building);
export const Landmark = createIconComponent('Landmark', lucideLib.Landmark);
export const LandPlot = createIconComponent('LandPlot', lucideLib.LandPlot);
export const Hammer = createIconComponent('Hammer', lucideLib.Hammer);
export const Wrench = createIconComponent('Wrench', lucideLib.Wrench);
export const Cog = createIconComponent('Cog', lucideLib.Cog);
export const Settings2 = createIconComponent('Settings2', lucideLib.Settings2);
export const SlidersHorizontal = createIconComponent('SlidersHorizontal', lucideLib.SlidersHorizontal);
export const SlidersVertical = createIconComponent('SlidersVertical', lucideLib.SlidersVertical);
export const Sliders = createIconComponent('Sliders', lucideLib.Sliders);
export const Gauge = createIconComponent('Gauge', lucideLib.Gauge);
export const GaugeCircle = createIconComponent('GaugeCircle', lucideLib.GaugeCircle);

// Communication & Social
export const AtSignIcon = createIconComponent('AtSign', lucideLib.AtSign);
export const PhoneCall = createIconComponent('PhoneCall', lucideLib.PhoneCall);
export const PhoneForwarded = createIconComponent('PhoneForwarded', lucideLib.PhoneForwarded);
export const PhoneIncoming = createIconComponent('PhoneIncoming', lucideLib.PhoneIncoming);
export const PhoneOutgoing = createIconComponent('PhoneOutgoing', lucideLib.PhoneOutgoing);
export const PhoneMissed = createIconComponent('PhoneMissed', lucideLib.PhoneMissed);
export const PhoneOff = createIconComponent('PhoneOff', lucideLib.PhoneOff);
export const Voicemail = createIconComponent('Voicemail', lucideLib.Voicemail);
export const VideoIcon = createIconComponent('Video', lucideLib.Video);
export const ScreenShare = createIconComponent('ScreenShare', lucideLib.ScreenShare);
export const ScreenShareOff = createIconComponent('ScreenShareOff', lucideLib.ScreenShareOff);
export const Cast = createIconComponent('Cast', lucideLib.Cast);
export const Airplay = createIconComponent('Airplay', lucideLib.Airplay);

// More social icons
export const Linkedin2 = createIconComponent('Linkedin', lucideLib.Linkedin);
export const Instagram2 = createIconComponent('Instagram', lucideLib.Instagram);
export const TwitterIcon = createIconComponent('Twitter', lucideLib.Twitter);
export const FacebookIcon = createIconComponent('Facebook', lucideLib.Facebook);
export const YoutubeIcon = createIconComponent('Youtube', lucideLib.Youtube);
export const TwitchIcon = createIconComponent('Twitch', lucideLib.Twitch);
export const DiscordIcon = createIconComponent('Discord', lucideLib.Discord);
export const Discord = createIconComponent('Discord', lucideLib.Discord);
export const GithubIcon = createIconComponent('Github', lucideLib.Github);
export const GitlabIcon = createIconComponent('Gitlab', lucideLib.Gitlab);
export const Codepen = createIconComponent('Codepen', lucideLib.Codepen);
export const Codesandbox = createIconComponent('Codesandbox', lucideLib.Codesandbox);

// Nature & Weather
export const Flower2 = createIconComponent('Flower2', lucideLib.Flower2);
export const TreeDeciduous = createIconComponent('TreeDeciduous', lucideLib.TreeDeciduous);
export const TreePine = createIconComponent('TreePine', lucideLib.TreePine);
export const TreePalm = createIconComponent('TreePalm', lucideLib.TreePalm);
export const Clover = createIconComponent('Clover', lucideLib.Clover);
export const Sprout = createIconComponent('Sprout', lucideLib.Sprout);
export const MountainSnow = createIconComponent('MountainSnow', lucideLib.MountainSnow);
export const Sunrise = createIconComponent('Sunrise', lucideLib.Sunrise);
export const Sunset = createIconComponent('Sunset', lucideLib.Sunset);
export const CloudSun = createIconComponent('CloudSun', lucideLib.CloudSun);
export const CloudMoon = createIconComponent('CloudMoon', lucideLib.CloudMoon);
export const CloudSnow = createIconComponent('CloudSnow', lucideLib.CloudSnow);
export const CloudLightning = createIconComponent('CloudLightning', lucideLib.CloudLightning);
export const CloudDrizzle = createIconComponent('CloudDrizzle', lucideLib.CloudDrizzle);
export const CloudFog = createIconComponent('CloudFog', lucideLib.CloudFog);
export const CloudHail = createIconComponent('CloudHail', lucideLib.CloudHail);
export const CloudOff = createIconComponent('CloudOff', lucideLib.CloudOff);
export const Umbrella = createIconComponent('Umbrella', lucideLib.Umbrella);
export const Thermometer = createIconComponent('Thermometer', lucideLib.Thermometer);
export const ThermometerSun = createIconComponent('ThermometerSun', lucideLib.ThermometerSun);
export const ThermometerSnowflake = createIconComponent('ThermometerSnowflake', lucideLib.ThermometerSnowflake);
export const Droplet = createIconComponent('Droplet', lucideLib.Droplet);
export const Droplets = createIconComponent('Droplets', lucideLib.Droplets);
export const Waves = createIconComponent('Waves', lucideLib.Waves);

// More commonly used icons
export const HeartHandshake = createIconComponent('HeartHandshake', lucideLib.HeartHandshake);
export const HeartPulse = createIconComponent('HeartPulse', lucideLib.HeartPulse);
export const Heartbeat = createIconComponent('HeartPulse', lucideLib.HeartPulse);
export const Activity2 = createIconComponent('Activity', lucideLib.Activity);
export const Stethoscope = createIconComponent('Stethoscope', lucideLib.Stethoscope);
export const Pill = createIconComponent('Pill', lucideLib.Pill);
export const Syringe = createIconComponent('Syringe', lucideLib.Syringe);
export const Dna = createIconComponent('Dna', lucideLib.Dna);
export const Atom = createIconComponent('Atom', lucideLib.Atom);
export const Microscope = createIconComponent('Microscope', lucideLib.Microscope);
export const TestTube = createIconComponent('TestTube', lucideLib.TestTube);
export const TestTube2 = createIconComponent('TestTube2', lucideLib.TestTube2);
export const TestTubes = createIconComponent('TestTubes', lucideLib.TestTubes);
export const Beaker = createIconComponent('Beaker', lucideLib.Beaker);
export const FlaskConical = createIconComponent('FlaskConical', lucideLib.FlaskConical);
export const FlaskRound = createIconComponent('FlaskRound', lucideLib.FlaskRound);

// Food & Drink
export const UtensilsCrossed = createIconComponent('UtensilsCrossed', lucideLib.UtensilsCrossed);
export const Utensils = createIconComponent('Utensils', lucideLib.Utensils);
export const ChefHat = createIconComponent('ChefHat', lucideLib.ChefHat);
export const CookingPot = createIconComponent('CookingPot', lucideLib.CookingPot);
export const Soup = createIconComponent('Soup', lucideLib.Soup);
export const Salad = createIconComponent('Salad', lucideLib.Salad);
export const Sandwich = createIconComponent('Sandwich', lucideLib.Sandwich);
export const Croissant = createIconComponent('Croissant', lucideLib.Croissant);
export const Cookie = createIconComponent('Cookie', lucideLib.Cookie);
export const Candy = createIconComponent('Candy', lucideLib.Candy);
export const CandyCane = createIconComponent('CandyCane', lucideLib.CandyCane);
export const IceCream = createIconComponent('IceCream', lucideLib.IceCream);
export const IceCream2 = createIconComponent('IceCream2', lucideLib.IceCream2);
export const Lollipop = createIconComponent('Lollipop', lucideLib.Lollipop);
export const Popcorn = createIconComponent('Popcorn', lucideLib.Popcorn);
export const Citrus = createIconComponent('Citrus', lucideLib.Citrus);
export const Apple = createIconComponent('Apple', lucideLib.Apple);
export const Banana = createIconComponent('Banana', lucideLib.Banana);
export const Cherry = createIconComponent('Cherry', lucideLib.Cherry);
export const Grape = createIconComponent('Grape', lucideLib.Grape);
export const Carrot = createIconComponent('Carrot', lucideLib.Carrot);
export const Egg = createIconComponent('Egg', lucideLib.Egg);
export const EggFried = createIconComponent('EggFried', lucideLib.EggFried);
export const Beef = createIconComponent('Beef', lucideLib.Beef);
export const Fish = createIconComponent('Fish', lucideLib.Fish);
export const Milk = createIconComponent('Milk', lucideLib.Milk);
export const Beer = createIconComponent('Beer', lucideLib.Beer);
export const Wine = createIconComponent('Wine', lucideLib.Wine);
export const Martini = createIconComponent('Martini', lucideLib.Martini);
export const CupSoda = createIconComponent('CupSoda', lucideLib.CupSoda);
export const GlassWater = createIconComponent('GlassWater', lucideLib.GlassWater);
export const Wheat = createIconComponent('Wheat', lucideLib.Wheat);
export const WheatOff = createIconComponent('WheatOff', lucideLib.WheatOff);

// Animals
export const Dog = createIconComponent('Dog', lucideLib.Dog);
export const Cat = createIconComponent('Cat', lucideLib.Cat);
export const Bird = createIconComponent('Bird', lucideLib.Bird);
export const Rabbit = createIconComponent('Rabbit', lucideLib.Rabbit);
export const Turtle = createIconComponent('Turtle', lucideLib.Turtle);
export const Snail = createIconComponent('Snail', lucideLib.Snail);
export const Bug = createIconComponent('Bug', lucideLib.Bug);
export const BugPlay = createIconComponent('BugPlay', lucideLib.BugPlay);
export const BugOff = createIconComponent('BugOff', lucideLib.BugOff);
export const Spider = createIconComponent('Spider', lucideLib.Spider);
export const Worm = createIconComponent('Worm', lucideLib.Worm);
export const Rat = createIconComponent('Rat', lucideLib.Rat);
export const Squirrel = createIconComponent('Squirrel', lucideLib.Squirrel);
export const Paw = createIconComponent('Paw', lucideLib.Paw);
export const PawPrint = createIconComponent('PawPrint', lucideLib.PawPrint);
export const Bone = createIconComponent('Bone', lucideLib.Bone);
export const FishSymbol = createIconComponent('FishSymbol', lucideLib.FishSymbol);
export const Shell = createIconComponent('Shell', lucideLib.Shell);

// Arrows and directions (more)
export const MoveHorizontal = createIconComponent('MoveHorizontal', lucideLib.MoveHorizontal);
export const MoveVertical = createIconComponent('MoveVertical', lucideLib.MoveVertical);
export const MoveDiagonal = createIconComponent('MoveDiagonal', lucideLib.MoveDiagonal);
export const MoveDiagonal2 = createIconComponent('MoveDiagonal2', lucideLib.MoveDiagonal2);
export const ArrowLeftRight = createIconComponent('ArrowLeftRight', lucideLib.ArrowLeftRight);
export const ArrowUpDown = createIconComponent('ArrowUpDown', lucideLib.ArrowUpDown);
export const ArrowRightLeft = createIconComponent('ArrowRightLeft', lucideLib.ArrowRightLeft);
export const ArrowDownUp = createIconComponent('ArrowDownUp', lucideLib.ArrowDownUp);
export const Maximize2 = createIconComponent('Maximize2', lucideLib.Maximize2);
export const Minimize2 = createIconComponent('Minimize2', lucideLib.Minimize2);
export const FullscreenIcon = createIconComponent('Fullscreen', lucideLib.Fullscreen);
export const Fullscreen = createIconComponent('Fullscreen', lucideLib.Fullscreen);
export const FullscreenExit = createIconComponent('FullscreenExit', lucideLib.FullscreenExit);

// Sports & Fitness
export const Dumbbell = createIconComponent('Dumbbell', lucideLib.Dumbbell);
export const PersonStandingIcon = createIconComponent('PersonStanding', lucideLib.PersonStanding);
export const Footprints2 = createIconComponent('Footprints', lucideLib.Footprints);
export const Timer2 = createIconComponent('Timer', lucideLib.Timer);
export const Route = createIconComponent('Route', lucideLib.Route);
export const Signpost = createIconComponent('Signpost', lucideLib.Signpost);
export const SignpostBig = createIconComponent('SignpostBig', lucideLib.SignpostBig);

// Gaming & Entertainment  
export const Joystick2 = createIconComponent('Joystick', lucideLib.Joystick);
export const Dice1 = createIconComponent('Dice1', lucideLib.Dice1);
export const Dice2 = createIconComponent('Dice2', lucideLib.Dice2);
export const Dice3 = createIconComponent('Dice3', lucideLib.Dice3);
export const Dice4 = createIconComponent('Dice4', lucideLib.Dice4);
export const Dice5 = createIconComponent('Dice5', lucideLib.Dice5);
export const Dice6 = createIconComponent('Dice6', lucideLib.Dice6);
export const Spade = createIconComponent('Spade', lucideLib.Spade);
export const Club = createIconComponent('Club', lucideLib.Club);
export const Drama = createIconComponent('Drama', lucideLib.Drama);
export const Theater = createIconComponent('Theater', lucideLib.Theater);
export const Ticket = createIconComponent('Ticket', lucideLib.Ticket);
export const TicketCheck = createIconComponent('TicketCheck', lucideLib.TicketCheck);
export const TicketX = createIconComponent('TicketX', lucideLib.TicketX);
export const TicketSlash = createIconComponent('TicketSlash', lucideLib.TicketSlash);
export const TicketPercent = createIconComponent('TicketPercent', lucideLib.TicketPercent);
export const TicketPlus = createIconComponent('TicketPlus', lucideLib.TicketPlus);
export const TicketMinus = createIconComponent('TicketMinus', lucideLib.TicketMinus);
export const Clapperboard = createIconComponent('Clapperboard', lucideLib.Clapperboard);
export const Film = createIconComponent('Film', lucideLib.Film);
export const FilmIcon = createIconComponent('Film', lucideLib.Film);
export const Tv2 = createIconComponent('Tv2', lucideLib.Tv2);
export const MonitorPlay = createIconComponent('MonitorPlay', lucideLib.MonitorPlay);
export const MonitorSmartphone = createIconComponent('MonitorSmartphone', lucideLib.MonitorSmartphone);
export const MonitorSpeaker = createIconComponent('MonitorSpeaker', lucideLib.MonitorSpeaker);
export const MonitorCheck = createIconComponent('MonitorCheck', lucideLib.MonitorCheck);
export const MonitorX = createIconComponent('MonitorX', lucideLib.MonitorX);
export const MonitorDot = createIconComponent('MonitorDot', lucideLib.MonitorDot);
export const MonitorOff = createIconComponent('MonitorOff', lucideLib.MonitorOff);
export const MonitorUp = createIconComponent('MonitorUp', lucideLib.MonitorUp);
export const MonitorDown = createIconComponent('MonitorDown', lucideLib.MonitorDown);

// Tools & Construction
export const HardHat = createIconComponent('HardHat', lucideLib.HardHat);
export const Construction = createIconComponent('Construction', lucideLib.Construction);
export const PaintBucket = createIconComponent('PaintBucket', lucideLib.PaintBucket);
export const PaintRoller = createIconComponent('PaintRoller', lucideLib.PaintRoller);
export const PaintbrushIcon = createIconComponent('Paintbrush', lucideLib.Paintbrush);
export const Paintbrush = createIconComponent('Paintbrush', lucideLib.Paintbrush);
export const Paintbrush2 = createIconComponent('Paintbrush2', lucideLib.Paintbrush2);
export const Pipette = createIconComponent('Pipette', lucideLib.Pipette);
export const Ruler = createIconComponent('Ruler', lucideLib.Ruler);
export const RulerIcon = createIconComponent('Ruler', lucideLib.Ruler);
export const Scaling = createIconComponent('Scaling', lucideLib.Scaling);
export const Blend = createIconComponent('Blend', lucideLib.Blend);
export const Sparkle2 = createIconComponent('Sparkle', lucideLib.Sparkle);
export const GraduationCapIcon = createIconComponent('GraduationCap', lucideLib.GraduationCap);
export const BriefcaseIcon = createIconComponent('Briefcase', lucideLib.Briefcase);

// CRITICAL: Export the icons proxy for dynamic icon resolution
// This allows: import { icons } from 'lucide-react'; icons.SomeRareIcon
export const icons = iconsProxy;

// Also export createIconComponent for advanced usage
export { createIconComponent };

// Default export for compatibility
export default { icons: iconsProxy };
`;
}
