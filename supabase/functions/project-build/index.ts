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

    // Create a virtual file system plugin for esbuild
    const virtualFsPlugin: esbuild.Plugin = {
      name: "virtual-fs",
      setup(build) {
        // Resolve all imports
        build.onResolve({ filter: /.*/ }, (args) => {
          // External packages - mark as external (we'll shim them in browser)
          const externalPackages = [
            'react', 'react-dom', 'react-router-dom',
            'framer-motion', 'lucide-react', 
            'i18next', 'react-i18next',
            '@radix-ui', '@headlessui',
            'clsx', 'tailwind-merge', 'class-variance-authority'
          ];
          
          for (const pkg of externalPackages) {
            if (args.path === pkg || args.path.startsWith(pkg + '/')) {
              return { path: args.path, external: true };
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
            return { path: args.path, external: true };
          }

          // Entry point
          if (args.path === entryPoint || args.path === entryPoint.replace(/^\//, '')) {
            return { path: entryPoint, namespace: 'virtual' };
          }

          // Absolute paths in our virtual fs
          if (args.path.startsWith('/') && files[args.path]) {
            return { path: args.path, namespace: 'virtual' };
          }

          // Unknown - mark as external
          return { path: args.path, external: true };
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

    // Run esbuild
    const result = await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      write: false,
      format: 'iife',
      globalName: 'App',
      platform: 'browser',
      target: ['es2020'],
      jsx: 'transform',
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment',
      plugins: [virtualFsPlugin],
      external: [
        'react', 'react-dom', 'react-router-dom',
        'framer-motion', 'lucide-react',
        'i18next', 'react-i18next'
      ],
      minify: false, // Keep readable for debugging
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
  // Wrap the bundled code with React/library shims
  const shimmedJs = `
// ========== LIBRARY SHIMS ==========
// These provide browser-compatible versions of npm packages

// React is loaded from CDN, destructure hooks
const { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext, Fragment, forwardRef, memo, lazy, Suspense } = React;

// Framer Motion shim
const motion = new Proxy({}, {
  get: (_, tag) => {
    const Component = React.forwardRef((props, ref) => {
      const { initial, animate, exit, transition, whileHover, whileTap, whileInView, variants, ...rest } = props;
      return React.createElement(tag, { ...rest, ref });
    });
    return Component;
  }
});
const AnimatePresence = ({ children }) => children;

// i18next shim with translation support
const i18n = {
  language: 'en',
  languages: ['en', 'ar'],
  resources: {},
  use: function() { return this; },
  init: function(options) { 
    if (options?.lng) this.language = options.lng;
    if (options?.resources) this.resources = options.resources;
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

const useTranslation = (ns) => {
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const handler = () => forceUpdate(n => n + 1);
    window.addEventListener('languageChanged', handler);
    return () => window.removeEventListener('languageChanged', handler);
  }, []);
  return { t: (key, opts) => i18n.t(key, { ns, ...opts }), i18n };
};

const initReactI18next = { type: '3rdParty', init: () => {} };
const I18nextProvider = ({ children }) => children;

// Lucide icons shim
const createIcon = (name, paths) => (props) => React.createElement('svg', {
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
}, paths.map((d, i) => React.createElement('path', { key: i, d })));

// Common Lucide icons
const Heart = createIcon('Heart', ['M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z']);
const Sparkles = createIcon('Sparkles', ['M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z']);
const Gift = createIcon('Gift', ['M20 12v10H4V12', 'M2 7h20v5H2z', 'M12 22V7', 'M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z', 'M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z']);
const Smile = createIcon('Smile', ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M8 14s1.5 2 4 2 4-2 4-2']);
const BookOpen = createIcon('BookOpen', ['M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z', 'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z']);
const Languages = createIcon('Languages', ['M5 8l6 6', 'M4 14l6-6 2-3', 'M2 5h12', 'M7 2v3', 'M22 22l-5-10-5 10', 'M14 18h6']);
const Star = createIcon('Star', ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z']);
const Check = createIcon('Check', ['M20 6L9 17l-5-5']);
const X = createIcon('X', ['M18 6L6 18', 'M6 6l12 12']);
const Menu = createIcon('Menu', ['M3 12h18', 'M3 6h18', 'M3 18h18']);
const ChevronRight = createIcon('ChevronRight', ['M9 18l6-6-6-6']);
const ChevronLeft = createIcon('ChevronLeft', ['M15 18l-6-6 6-6']);
const ArrowRight = createIcon('ArrowRight', ['M5 12h14', 'M12 5l7 7-7 7']);
const Search = createIcon('Search', ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35']);
const User = createIcon('User', ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z']);
const Settings = createIcon('Settings', ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z']);
const Home = createIcon('Home', ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10']);
const Mail = createIcon('Mail', ['M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z', 'M22 6l-10 7L2 6']);
const Phone = createIcon('Phone', ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72']);
const MapPin = createIcon('MapPin', ['M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z', 'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z']);
const Clock = createIcon('Clock', ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M12 6v6l4 2']);
const Calendar = createIcon('Calendar', ['M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z', 'M16 2v4', 'M8 2v4', 'M3 10h18']);
const Plus = createIcon('Plus', ['M12 5v14', 'M5 12h14']);
const Minus = createIcon('Minus', ['M5 12h14']);
const Edit = createIcon('Edit', ['M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7']);
const Trash = createIcon('Trash', ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2']);
const Download = createIcon('Download', ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3']);
const Upload = createIcon('Upload', ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12']);
const Share = createIcon('Share', ['M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8', 'M16 6l-4-4-4 4', 'M12 2v13']);
const ExternalLink = createIcon('ExternalLink', ['M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6', 'M15 3h6v6', 'M10 14L21 3']);
const Copy = createIcon('Copy', ['M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1']);
const Info = createIcon('Info', ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M12 16v-4', 'M12 8h.01']);
const AlertCircle = createIcon('AlertCircle', ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M12 8v4', 'M12 16h.01']);
const CheckCircle = createIcon('CheckCircle', ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M9 12l2 2 4-4']);
const XCircle = createIcon('XCircle', ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M15 9l-6 6', 'M9 9l6 6']);
const Globe = createIcon('Globe', ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M2 12h20']);
const Lock = createIcon('Lock', ['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z', 'M7 11V7a5 5 0 0 1 10 0v4']);
const Eye = createIcon('Eye', ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z']);
const EyeOff = createIcon('EyeOff', ['M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94', 'M1 1l22 22']);
const Play = createIcon('Play', ['M5 3l14 9-14 9V3z']);
const Pause = createIcon('Pause', ['M6 4h4v16H6z', 'M14 4h4v16h-4z']);
const Image = createIcon('Image', ['M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z']);
const Video = createIcon('Video', ['M23 7l-7 5 7 5V7z', 'M14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z']);
const Music = createIcon('Music', ['M9 18V5l12-2v13']);
const Mic = createIcon('Mic', ['M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z']);
const Camera = createIcon('Camera', ['M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z']);
const Send = createIcon('Send', ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4 20-7z']);
const Bell = createIcon('Bell', ['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9']);
const MessageCircle = createIcon('MessageCircle', ['M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z']);
const RefreshCw = createIcon('RefreshCw', ['M23 4v6h-6', 'M1 20v-6h6']);
const Loader = createIcon('Loader', ['M12 2v4', 'M12 18v4', 'M4.93 4.93l2.83 2.83', 'M16.24 16.24l2.83 2.83']);
const Zap = createIcon('Zap', ['M13 2L3 14h9l-1 8 10-12h-9l1-8z']);
const Award = createIcon('Award', ['M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14z']);
const Target = createIcon('Target', ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z']);
const TrendingUp = createIcon('TrendingUp', ['M23 6l-9.5 9.5-5-5L1 18']);
const DollarSign = createIcon('DollarSign', ['M12 1v22', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6']);
const ShoppingCart = createIcon('ShoppingCart', ['M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M20 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z']);
const Bookmark = createIcon('Bookmark', ['M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z']);
const Tag = createIcon('Tag', ['M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z']);
const Folder = createIcon('Folder', ['M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z']);
const File = createIcon('File', ['M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z', 'M13 2v7h7']);
const FileText = createIcon('FileText', ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z']);
const Link = createIcon('Link', ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71']);
const Wifi = createIcon('Wifi', ['M5 12.55a11 11 0 0 1 14.08 0']);
const Sun = createIcon('Sun', ['M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z']);
const Moon = createIcon('Moon', ['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z']);
const Cloud = createIcon('Cloud', ['M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z']);
const Coffee = createIcon('Coffee', ['M18 8h1a4 4 0 0 1 0 8h-1']);
const Briefcase = createIcon('Briefcase', ['M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z']);
const Users = createIcon('Users', ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2']);
const ThumbsUp = createIcon('ThumbsUp', ['M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3']);
const ThumbsDown = createIcon('ThumbsDown', ['M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17']);
const MessageSquare = createIcon('MessageSquare', ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z']);
const HelpCircle = createIcon('HelpCircle', ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z']);
const AlertTriangle = createIcon('AlertTriangle', ['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z']);
const Shield = createIcon('Shield', ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z']);
const Key = createIcon('Key', ['M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4']);
const Power = createIcon('Power', ['M18.36 6.64a9 9 0 1 1-12.73 0', 'M12 2v10']);
const Terminal = createIcon('Terminal', ['M4 17l6-6-6-6', 'M12 19h8']);
const Code = createIcon('Code', ['M16 18l6-6-6-6', 'M8 6l-6 6 6 6']);
const Database = createIcon('Database', ['M12 2C6.48 2 2 4.02 2 6.5v11C2 19.98 6.48 22 12 22s10-2.02 10-4.5v-11C22 4.02 17.52 2 12 2z']);
const Server = createIcon('Server', ['M20 4H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z']);
const Cpu = createIcon('Cpu', ['M18 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z']);
const Activity = createIcon('Activity', ['M22 12h-4l-3 9L9 3l-3 9H2']);
const BarChart = createIcon('BarChart', ['M12 20V10', 'M18 20V4', 'M6 20v-4']);
const PieChart = createIcon('PieChart', ['M21.21 15.89A10 10 0 1 1 8 2.83']);
const Layers = createIcon('Layers', ['M12 2L2 7l10 5 10-5-10-5z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5']);
const Grid = createIcon('Grid', ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z']);
const List = createIcon('List', ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01']);
const Layout = createIcon('Layout', ['M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z']);
const Maximize = createIcon('Maximize', ['M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3']);
const Minimize = createIcon('Minimize', ['M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3']);
const Move = createIcon('Move', ['M5 9l-3 3 3 3', 'M9 5l3-3 3 3', 'M15 19l-3 3-3-3', 'M19 9l3 3-3 3', 'M2 12h20', 'M12 2v20']);
const MoreHorizontal = createIcon('MoreHorizontal', ['M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z']);
const MoreVertical = createIcon('MoreVertical', ['M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M12 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M12 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z']);
const Filter = createIcon('Filter', ['M22 3H2l8 9.46V19l4 2v-8.54L22 3z']);
const Save = createIcon('Save', ['M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z']);
const LogIn = createIcon('LogIn', ['M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4']);
const LogOut = createIcon('LogOut', ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4']);

// clsx/tailwind-merge shim
const clsx = (...args) => args.filter(Boolean).join(' ');
const cn = clsx;
const twMerge = (...args) => args.filter(Boolean).join(' ');

// ========== BUNDLED APP CODE ==========
${bundledJs}
`;

  return { js: shimmedJs, css };
}
