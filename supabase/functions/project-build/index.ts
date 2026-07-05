import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// @ts-ignore - esbuild WASM for Deno Edge (no cache directory needed)
import * as esbuild from "https://deno.land/x/esbuild@v0.20.1/wasm.js";

// Initialize esbuild WASM once (singleton pattern for edge runtime)
let esbuildInitialized = false;
const initializeEsbuild = async () => {
  if (esbuildInitialized) return;
  
  const wasmUrls = [
    "https://cdn.jsdelivr.net/npm/esbuild-wasm@0.20.1/esbuild.wasm",
    "https://unpkg.com/esbuild-wasm@0.20.1/esbuild.wasm",
    "https://cdnjs.cloudflare.com/ajax/libs/esbuild-wasm/0.20.1/esbuild.wasm"
  ];

  let lastError: Error | null = null;
  for (const url of wasmUrls) {
    try {
      console.log(`Attempting to initialize esbuild WASM from: ${url}`);
      await esbuild.initialize({
        wasmURL: url,
        worker: false, // Edge runtime doesn't support workers
      });
      esbuildInitialized = true;
      console.log(`esbuild WASM initialized successfully using: ${url}`);
      return;
    } catch (error) {
      console.warn(`Failed to initialize esbuild WASM from ${url}:`, error instanceof Error ? error.message : error);
      if (error instanceof Error && error.message.includes("initialized")) {
        esbuildInitialized = true;
        console.log("esbuild was already initialized");
        return;
      }
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  
  if (lastError) throw lastError;
  throw new Error("Failed to initialize esbuild with any of the CDN URLs");
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
    safelist: string[];
  };
  error?: string;
}

function transformLucideReactImports(code: string): string {
  if (!code.includes("lucide-react")) {
    return code;
  }

  let importIndex = 0;
  return code.replace(/^([ \t]*)import\s*\{([^}]*)\}\s*from\s*["']lucide-react["']\s*;?[ \t]*$/gm, (_, indentation: string, importList: string) => {
    const proxyName = `__waktiLucideIcons${importIndex += 1}`;
    const specifiers = String(importList)
      .split(",")
      .map((value) => value.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    const assignments = specifiers
      .map((specifier) => {
        if (specifier.startsWith("type ")) {
          return "";
        }

        const parts = specifier.split(/\s+as\s+/i);
        const importedName = parts[0]?.trim();
        const localName = (parts[1] || importedName || "").trim();

        if (!importedName || !localName) {
          return "";
        }

        if (importedName === "icons") {
          return `${indentation}const ${localName} = ${proxyName};`;
        }

        return `${indentation}const ${localName} = ${proxyName}.${importedName};`;
      })
      .filter(Boolean);

    if (assignments.length === 0) {
      return "";
    }

    return `${indentation}import { icons as ${proxyName} } from "lucide-react";\n${assignments.join("\n")}`;
  });
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

    // PHASE 1 FIX: Do NOT collect all CSS files blindly.
    // CSS will only be bundled when it's ACTUALLY IMPORTED by JS (matching Sandpack behavior).
    // esbuild handles this automatically when loader: 'css' is used for .css files.
    // We'll extract CSS from esbuild's outputFiles after the build.

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
      'react-router': getReactRouterShim(),
      'react-router-dom': getReactRouterShim(),
      'framer-motion': `
        // Self-contained motion implementation - never depends on a CDN-loaded
        // animation engine. Real framer-motion (loaded from a third-party CDN)
        // was observed to silently fail to complete its animations on some
        // mobile browsers, leaving whole sections stuck at their "initial"
        // (often invisible) state forever. This shim resolves every animation
        // instruction itself - any CSS property (width, color, size...), real
        // scroll-triggered reveals, and hover/tap feedback - and drives them
        // with plain CSS transitions, so content is guaranteed to become
        // visible everywhere while still looking and feeling like real motion.
        const __motionLastValue = (v) => Array.isArray(v) ? v[v.length - 1] : v;
        const __resolveMotionState = (value, variants) => {
          if (value && typeof value === 'object' && !Array.isArray(value)) return value;
          if (typeof value === 'string' && variants && variants[value]) return variants[value];
          return null;
        };
        const __motionEase = (ease) => {
          if (Array.isArray(ease) && ease.length === 4) return 'cubic-bezier(' + ease.join(',') + ')';
          const map = {
            linear: 'linear',
            easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
            easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
            easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
            circIn: 'cubic-bezier(0.55, 0, 1, 0.45)',
            circOut: 'cubic-bezier(0, 0.55, 0.45, 1)',
            circInOut: 'cubic-bezier(0.85, 0, 0.15, 1)',
            backIn: 'cubic-bezier(0.36, 0, 0.66, -0.56)',
            backOut: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            backInOut: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)',
            anticipate: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)'
          };
          return (typeof ease === 'string' && map[ease]) ? map[ease] : 'cubic-bezier(0.4, 0, 0.2, 1)';
        };
        const __applyMotionState = (state, base) => {
          const result = { ...base };
          if (!state) return result;
          const transforms = [];
          Object.keys(state).forEach((key) => {
            if (key === 'transition') return;
            const value = __motionLastValue(state[key]);
            if (value === undefined || value === null) return;
            const unit = typeof value === 'number' ? 'px' : '';
            const deg = typeof value === 'number' ? 'deg' : '';
            switch (key) {
              case 'x': transforms.push('translateX(' + value + unit + ')'); break;
              case 'y': transforms.push('translateY(' + value + unit + ')'); break;
              case 'z': transforms.push('translateZ(' + value + unit + ')'); break;
              case 'scale': transforms.push('scale(' + value + ')'); break;
              case 'scaleX': transforms.push('scaleX(' + value + ')'); break;
              case 'scaleY': transforms.push('scaleY(' + value + ')'); break;
              case 'rotate': transforms.push('rotate(' + value + deg + ')'); break;
              case 'rotateX': transforms.push('rotateX(' + value + deg + ')'); break;
              case 'rotateY': transforms.push('rotateY(' + value + deg + ')'); break;
              case 'rotateZ': transforms.push('rotateZ(' + value + deg + ')'); break;
              case 'skew': transforms.push('skew(' + value + deg + ')'); break;
              case 'skewX': transforms.push('skewX(' + value + deg + ')'); break;
              case 'skewY': transforms.push('skewY(' + value + deg + ')'); break;
              default: result[key] = value;
            }
          });
          if (transforms.length > 0) result.transform = transforms.join(' ');
          return result;
        };
        const motion = new Proxy({}, {
          get: (_, tag) => {
            return window.React.forwardRef((props, ref) => {
              const {
                initial, animate, exit, transition, whileHover, whileTap, whileInView,
                viewport, variants, style = {}, ...rest
              } = props;

              const initialState = __resolveMotionState(initial, variants);
              const animateState = __resolveMotionState(animate, variants);
              const inViewState = __resolveMotionState(whileInView, variants);
              const hoverState = __resolveMotionState(whileHover, variants);
              const tapState = __resolveMotionState(whileTap, variants);
              const targetState = animateState || inViewState;
              const usesInView = !animateState && !!whileInView;

              const nodeRef = window.React.useRef(null);
              const setRefs = window.React.useCallback((node) => {
                nodeRef.current = node;
                if (typeof ref === 'function') ref(node);
                else if (ref && typeof ref === 'object') ref.current = node;
              }, [ref]);

              const [mounted, setMounted] = window.React.useState(false);
              const [inView, setInView] = window.React.useState(false);
              const [hovered, setHovered] = window.React.useState(false);
              const [pressed, setPressed] = window.React.useState(false);

              window.React.useEffect(() => {
                const raf = requestAnimationFrame(() => setMounted(true));
                return () => cancelAnimationFrame(raf);
              }, []);

              window.React.useEffect(() => {
                if (!usesInView) return undefined;
                const el = nodeRef.current;
                const amount = (viewport && typeof viewport.amount === 'number') ? viewport.amount : 0.2;
                const fallback = setTimeout(() => setInView(true), 2500);
                if (!el || typeof IntersectionObserver === 'undefined') {
                  setInView(true);
                  return () => clearTimeout(fallback);
                }
                const observer = new IntersectionObserver((entries) => {
                  for (const entry of entries) {
                    if (entry.isIntersecting) {
                      setInView(true);
                      observer.disconnect();
                      clearTimeout(fallback);
                    }
                  }
                }, { threshold: Math.min(Math.max(amount, 0), 1) });
                observer.observe(el);
                return () => { observer.disconnect(); clearTimeout(fallback); };
              }, [usesInView]);

              const revealed = usesInView ? inView : mounted;
              let finalState = revealed ? (targetState || initialState) : (initialState || targetState);
              let interactive = false;
              if (pressed && tapState) { finalState = { ...finalState, ...tapState }; interactive = true; }
              else if (hovered && hoverState) { finalState = { ...finalState, ...hoverState }; interactive = true; }

              const effectiveTransition = transition || (targetState && targetState.transition) || {};
              const duration = typeof effectiveTransition.duration === 'number' ? effectiveTransition.duration : 0.5;
              const delay = typeof effectiveTransition.delay === 'number' ? effectiveTransition.delay : 0;
              const ease = __motionEase(effectiveTransition.ease);
              const computedStyle = __applyMotionState(finalState, style);
              if (targetState || hoverState || tapState) {
                computedStyle.transition = interactive
                  ? ('all 0.15s ' + ease + ' 0s')
                  : ('all ' + duration + 's ' + ease + ' ' + delay + 's');
              }

              const handlers = {};
              if (hoverState) {
                handlers.onMouseEnter = (e) => { setHovered(true); if (rest.onMouseEnter) rest.onMouseEnter(e); };
                handlers.onMouseLeave = (e) => { setHovered(false); if (rest.onMouseLeave) rest.onMouseLeave(e); };
              }
              if (tapState) {
                handlers.onMouseDown = (e) => { setPressed(true); if (rest.onMouseDown) rest.onMouseDown(e); };
                handlers.onMouseUp = (e) => { setPressed(false); if (rest.onMouseUp) rest.onMouseUp(e); };
                handlers.onTouchStart = (e) => { setPressed(true); if (rest.onTouchStart) rest.onTouchStart(e); };
                handlers.onTouchEnd = (e) => { setPressed(false); if (rest.onTouchEnd) rest.onTouchEnd(e); };
              }

              return window.React.createElement(String(tag) || 'div', { ...rest, ...handlers, ref: setRefs, style: computedStyle });
            });
          }
        });

        const AnimatePresence = ({ children }) => children;
        const useAnimation = () => ({ start: () => Promise.resolve(), stop: () => {}, set: () => {} });
        const useInView = (ref, opts) => {
          const [inView, setInView] = window.React.useState(false);
          window.React.useEffect(() => {
            const el = ref && ref.current;
            const amount = (opts && typeof opts.amount === 'number') ? opts.amount : 0.2;
            const fallback = setTimeout(() => setInView(true), 2500);
            if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return () => clearTimeout(fallback); }
            const observer = new IntersectionObserver((entries) => {
              for (const entry of entries) {
                if (entry.isIntersecting) { setInView(true); observer.disconnect(); clearTimeout(fallback); }
              }
            }, { threshold: Math.min(Math.max(amount, 0), 1) });
            observer.observe(el);
            return () => { observer.disconnect(); clearTimeout(fallback); };
          }, [ref && ref.current]);
          return inView;
        };
        const useScroll = () => ({
          scrollY: { get: () => 0, set: () => {}, onChange: () => () => {} },
          scrollYProgress: { get: () => 0, onChange: () => () => {} },
          scrollX: { get: () => 0, set: () => {} },
          scrollXProgress: { get: () => 0 }
        });
        const useTransform = (value, inputRange, outputRange) => {
          if (Array.isArray(outputRange) && outputRange.length > 0) return outputRange[0];
          return 0;
        };
        const useMotionValue = (init) => ({ get: () => init, set: () => {}, onChange: () => () => {} });
        const useSpring = (value) => value;
        const useMotionTemplate = (...args) => args.join('');
        const useReducedMotion = () => false;
        const useAnimate = () => [null, () => Promise.resolve()];
        const usePresence = () => [true, () => {}];
        const useIsPresent = () => true;

        // Motion components for legacy usage
        const m = motion;

        // Additional exports that some projects might use
        const domAnimation = {};
        const domMax = {};
        const LazyMotion = ({ children }) => children;
        const MotionConfig = ({ children }) => children;
        const LayoutGroup = ({ children }) => children;
        const Reorder = { Group: ({ children }) => children, Item: motion.div };

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
      `,
      '@emotion/is-prop-valid': `
        export default function isPropValid(prop) {
          const validProps = new Set([
            'children', 'className', 'style', 'id', 'onClick', 'onChange', 
            'onSubmit', 'onFocus', 'onBlur', 'disabled', 'type', 'value',
            'placeholder', 'href', 'src', 'alt', 'title', 'role', 'aria-label'
          ]);
          return validProps.has(prop) || 
                 prop.startsWith('data-') || 
                 prop.startsWith('aria-') ||
                 !prop.startsWith('$');
        }
      `,
      'date-fns': `
        export function format(date, formatStr) {
          const d = new Date(date);
          const tokens = {
            'yyyy': d.getFullYear(),
            'MM': String(d.getMonth() + 1).padStart(2, '0'),
            'dd': String(d.getDate()).padStart(2, '0'),
            'HH': String(d.getHours()).padStart(2, '0'),
            'mm': String(d.getMinutes()).padStart(2, '0'),
            'ss': String(d.getSeconds()).padStart(2, '0'),
            'MMMM': d.toLocaleString('default', { month: 'long' }),
            'MMM': d.toLocaleString('default', { month: 'short' }),
            'EEEE': d.toLocaleString('default', { weekday: 'long' }),
            'EEE': d.toLocaleString('default', { weekday: 'short' })
          };
          let result = formatStr;
          for (const [token, value] of Object.entries(tokens)) {
            result = result.replace(new RegExp(token, 'g'), value);
          }
          return result;
        }
        export function parseISO(str) { return new Date(str); }
        export function isValid(date) { return date instanceof Date && !isNaN(date); }
        export function addDays(date, days) { 
          const d = new Date(date); d.setDate(d.getDate() + days); return d; 
        }
        export function subDays(date, days) { return addDays(date, -days); }
        export function addMonths(date, months) { 
          const d = new Date(date); d.setMonth(d.getMonth() + months); return d; 
        }
        export function startOfDay(date) { 
          const d = new Date(date); d.setHours(0,0,0,0); return d; 
        }
        export function endOfDay(date) { 
          const d = new Date(date); d.setHours(23,59,59,999); return d; 
        }
        export function isBefore(date1, date2) { return new Date(date1) < new Date(date2); }
        export function isAfter(date1, date2) { return new Date(date1) > new Date(date2); }
        export function differenceInDays(date1, date2) {
          return Math.round((new Date(date1) - new Date(date2)) / (1000 * 60 * 60 * 24));
        }
        export function formatDistance(date, baseDate) {
          const diff = Math.abs(new Date(date) - new Date(baseDate));
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          if (days === 0) return 'today';
          if (days === 1) return '1 day ago';
          return days + ' days ago';
        }
      `,
      'recharts': `
        const RC = window.Recharts || {};
        export const LineChart = RC.LineChart || (({ children, ...props }) => 
          window.React.createElement('div', { 
            style: { width: props.width || '100%', height: props.height || 300, 
                     background: '#1a1a2e', borderRadius: 8, display: 'flex', 
                     alignItems: 'center', justifyContent: 'center', color: '#888' }
          }, 'Chart loading...'));
        export const BarChart = RC.BarChart || LineChart;
        export const AreaChart = RC.AreaChart || LineChart;
        export const PieChart = RC.PieChart || LineChart;
        export const ComposedChart = RC.ComposedChart || LineChart;
        export const RadarChart = RC.RadarChart || LineChart;
        export const RadialBarChart = RC.RadialBarChart || LineChart;
        export const ScatterChart = RC.ScatterChart || LineChart;
        export const Treemap = RC.Treemap || LineChart;
        export const Line = RC.Line || (() => null);
        export const Bar = RC.Bar || (() => null);
        export const Area = RC.Area || (() => null);
        export const Pie = RC.Pie || (() => null);
        export const Scatter = RC.Scatter || (() => null);
        export const Radar = RC.Radar || (() => null);
        export const RadialBar = RC.RadialBar || (() => null);
        export const XAxis = RC.XAxis || (() => null);
        export const YAxis = RC.YAxis || (() => null);
        export const ZAxis = RC.ZAxis || (() => null);
        export const CartesianGrid = RC.CartesianGrid || (() => null);
        export const PolarGrid = RC.PolarGrid || (() => null);
        export const PolarAngleAxis = RC.PolarAngleAxis || (() => null);
        export const PolarRadiusAxis = RC.PolarRadiusAxis || (() => null);
        export const Tooltip = RC.Tooltip || (() => null);
        export const Legend = RC.Legend || (() => null);
        export const ResponsiveContainer = RC.ResponsiveContainer || 
          (({ children }) => window.React.createElement('div', 
            { style: { width: '100%', height: '100%' }}, children));
        export const Cell = RC.Cell || (() => null);
        export const LabelList = RC.LabelList || (() => null);
        export const Brush = RC.Brush || (() => null);
        export const ReferenceLine = RC.ReferenceLine || (() => null);
        export const ReferenceArea = RC.ReferenceArea || (() => null);
        export const ReferenceDot = RC.ReferenceDot || (() => null);
      `,
      '@tanstack/react-query': `
        const QueryClientContext = window.React.createContext(null);
        
        export class QueryClient {
          constructor() { this.cache = new Map(); }
          getQueryData(key) { return this.cache.get(JSON.stringify(key)); }
          setQueryData(key, data) { this.cache.set(JSON.stringify(key), data); }
          invalidateQueries() { this.cache.clear(); return Promise.resolve(); }
          prefetchQuery() { return Promise.resolve(); }
        }
        
        export function QueryClientProvider({ client, children }) {
          return window.React.createElement(QueryClientContext.Provider, 
            { value: client }, children);
        }
        
        export function useQuery({ queryKey, queryFn, enabled = true }) {
          const [state, setState] = window.React.useState({ 
            data: undefined, isLoading: true, error: null, isError: false, isSuccess: false 
          });
          window.React.useEffect(() => {
            if (!enabled) { setState(s => ({ ...s, isLoading: false })); return; }
            let cancelled = false;
            queryFn().then(data => {
              if (!cancelled) setState({ data, isLoading: false, error: null, isError: false, isSuccess: true });
            }).catch(error => {
              if (!cancelled) setState({ data: undefined, isLoading: false, error, isError: true, isSuccess: false });
            });
            return () => { cancelled = true; };
          }, [JSON.stringify(queryKey), enabled]);
          return { ...state, refetch: () => queryFn().then(d => setState(s => ({ ...s, data: d }))) };
        }
        
        export function useMutation({ mutationFn, onSuccess, onError }) {
          const [state, setState] = window.React.useState({ 
            isLoading: false, error: null, data: undefined, isPending: false 
          });
          return {
            ...state,
            mutate: (vars) => {
              setState({ isLoading: true, isPending: true, error: null, data: undefined });
              mutationFn(vars)
                .then(data => { setState({ isLoading: false, isPending: false, error: null, data }); onSuccess?.(data); })
                .catch(error => { setState({ isLoading: false, isPending: false, error, data: undefined }); onError?.(error); });
            },
            mutateAsync: (vars) => mutationFn(vars)
          };
        }
        
        export function useQueryClient() {
          return window.React.useContext(QueryClientContext) || new QueryClient();
        }
      `,
      'react-hook-form': `
        const { useState, useRef, useCallback, createContext, useContext } = window.React;
        const RHFContext = createContext(null);

        export function useForm(options = {}) {
          const [values, setValues] = useState(options.defaultValues || {});
          const [errors, setErrors] = useState({});
          const [isSubmitting, setIsSubmitting] = useState(false);
          const [isDirty, setIsDirty] = useState(false);
          const touchedRef = useRef({});

          const setValue = useCallback((name, value, opts) => {
            setValues(prev => { const n = {...prev, [name]: value}; return n; });
            if (opts?.shouldDirty) setIsDirty(true);
          }, []);

          const getValues = useCallback((name) => name ? values[name] : {...values}, [values]);

          const watch = useCallback((name) => name ? values[name] : {...values}, [values]);

          const fieldRulesRef = useRef({});

          const register = useCallback((name, opts = {}) => {
            fieldRulesRef.current[name] = opts;
            return {
              name,
              onChange: (e) => {
                const v = e && e.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
                setValues(prev => ({...prev, [name]: v}));
                setIsDirty(true);
                if (errors[name]) setErrors(prev => { const n={...prev}; delete n[name]; return n; });
              },
              onBlur: () => { touchedRef.current[name] = true; },
              ref: () => {},
            };
          }, [errors]);

          const validateBuiltIn = useCallback((vals) => {
            const errs = {};
            Object.keys(fieldRulesRef.current).forEach((name) => {
              const rule = fieldRulesRef.current[name] || {};
              const value = vals[name];
              const isEmpty = value === undefined || value === null || value === '';
              if (rule.required && isEmpty) {
                errs[name] = { type: 'required', message: (rule.required && rule.required.message) || (typeof rule.required === 'string' ? rule.required : 'This field is required') };
                return;
              }
              if (isEmpty) return;
              if (rule.pattern) {
                const re = rule.pattern.value || rule.pattern;
                if (!re.test(value)) { errs[name] = { type: 'pattern', message: rule.pattern.message || 'Invalid format' }; return; }
              }
              if (rule.minLength) {
                const min = rule.minLength.value != null ? rule.minLength.value : rule.minLength;
                if (String(value).length < min) { errs[name] = { type: 'minLength', message: rule.minLength.message || ('Minimum length is ' + min) }; return; }
              }
              if (rule.maxLength) {
                const max = rule.maxLength.value != null ? rule.maxLength.value : rule.maxLength;
                if (String(value).length > max) { errs[name] = { type: 'maxLength', message: rule.maxLength.message || ('Maximum length is ' + max) }; return; }
              }
              if (rule.min != null) {
                const min = rule.min.value != null ? rule.min.value : rule.min;
                if (Number(value) < min) { errs[name] = { type: 'min', message: rule.min.message || ('Minimum value is ' + min) }; return; }
              }
              if (rule.max != null) {
                const max = rule.max.value != null ? rule.max.value : rule.max;
                if (Number(value) > max) { errs[name] = { type: 'max', message: rule.max.message || ('Maximum value is ' + max) }; return; }
              }
            });
            return errs;
          }, []);

          const handleSubmit = useCallback((onValid, onInvalid) => async (e) => {
            if (e && e.preventDefault) e.preventDefault();
            if (e && e.stopPropagation) e.stopPropagation();
            setIsSubmitting(true);
            try {
              let fieldErrors = {};
              let dataToSubmit = {...values};
              if (typeof options.resolver === 'function') {
                const result = await options.resolver({...values});
                fieldErrors = result.errors || {};
                if (result.values && Object.keys(result.values).length > 0) dataToSubmit = result.values;
              } else {
                fieldErrors = validateBuiltIn(values);
              }
              if (Object.keys(fieldErrors).length > 0) {
                setErrors(fieldErrors);
                if (onInvalid) onInvalid(fieldErrors);
              } else {
                setErrors({});
                await onValid(dataToSubmit);
              }
            }
            catch(err) { if (onInvalid) onInvalid(err); }
            finally { setIsSubmitting(false); }
          }, [values, validateBuiltIn]);

          const setError = useCallback((name, error) => setErrors(prev => ({...prev, [name]: error})), []);
          const clearErrors = useCallback((name) => {
            if (name) setErrors(prev => { const n={...prev}; delete n[name]; return n; });
            else setErrors({});
          }, []);
          const reset = useCallback((vals) => {
            setValues(vals || options.defaultValues || {});
            setErrors({});
            setIsDirty(false);
          }, []);
          const trigger = useCallback(async () => true, []);

          const formState = { errors, isSubmitting, isDirty, isValid: Object.keys(errors).length === 0, touchedFields: touchedRef.current, dirtyFields: {} };
          const control = { register, setValue, getValues, watch, formState, _defaultValues: options.defaultValues || {} };

          return { register, handleSubmit, formState, setValue, getValues, watch, reset, setError, clearErrors, trigger, control };
        }

        export function Controller({ control, name, render, defaultValue }) {
          const field = control.register(name);
          const value = control.getValues(name) ?? defaultValue ?? '';
          return render({ field: { ...field, value }, fieldState: { error: control.formState.errors[name] } });
        }

        const FormCtx = createContext(null);
        export function FormProvider({ children, ...methods }) {
          return window.React.createElement(FormCtx.Provider, { value: methods }, children);
        }
        export function useFormContext() {
          return useContext(FormCtx) || {};
        }
        export function useWatch({ control, name }) {
          return control ? control.getValues(name) : undefined;
        }
        export function useController({ control, name, defaultValue }) {
          const field = control.register(name);
          const value = control.getValues(name) ?? defaultValue ?? '';
          return { field: { ...field, value }, fieldState: { error: control.formState.errors[name] } };
        }
        export function useFieldArray({ control, name }) {
          const [fields, setFields] = useState(
            (control.getValues(name) || []).map((v, i) => ({ ...v, id: String(i) }))
          );
          return {
            fields,
            append: (v) => setFields(f => [...f, { ...v, id: String(Date.now()) }]),
            prepend: (v) => setFields(f => [{ ...v, id: String(Date.now()) }, ...f]),
            remove: (i) => setFields(f => f.filter((_, idx) => idx !== i)),
            insert: (i, v) => setFields(f => { const n=[...f]; n.splice(i,0,{...v, id:String(Date.now())}); return n; }),
            swap: (a, b) => setFields(f => { const n=[...f]; [n[a],n[b]]=[n[b],n[a]]; return n; }),
            move: (from, to) => setFields(f => { const n=[...f]; n.splice(to,0,n.splice(from,1)[0]); return n; }),
            update: (i, v) => setFields(f => f.map((x,idx) => idx===i ? {...v,id:x.id} : x)),
            replace: (v) => setFields(v.map((x,i) => ({...x, id:String(i)})))
          };
        }
        export function useFormState({ control }) {
          return control ? control.formState : {};
        }
        export default { useForm, Controller, FormProvider, useFormContext, useWatch, useController, useFieldArray, useFormState };
      `,
      '__waktiToastCore': `
        let container = null;
        let idCounter = 0;
        let toasts = [];
        let currentPosition = 'bottom-right';
        const listeners = new Set();

        function ensureContainer() {
          if (!container) {
            container = document.createElement('div');
            container.id = 'wakti-toast-container';
            document.body.appendChild(container);
          }
          const posStyles = {
            'top-left': { top: '16px', left: '16px', right: '', bottom: '', transform: '' },
            'top-center': { top: '16px', left: '50%', right: '', bottom: '', transform: 'translateX(-50%)' },
            'top-right': { top: '16px', right: '16px', left: '', bottom: '', transform: '' },
            'bottom-left': { bottom: '16px', left: '16px', right: '', top: '', transform: '' },
            'bottom-center': { bottom: '16px', left: '50%', right: '', top: '', transform: 'translateX(-50%)' },
            'bottom-right': { bottom: '16px', right: '16px', left: '', top: '', transform: '' },
          };
          const chosen = posStyles[currentPosition] || posStyles['bottom-right'];
          Object.assign(container.style, {
            position: 'fixed', zIndex: '999999', display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none',
          }, chosen);
          return container;
        }

        function colorFor(type) {
          if (type === 'success') return { bg: '#065f46', border: '#10b981' };
          if (type === 'error') return { bg: '#7f1d1d', border: '#ef4444' };
          if (type === 'warning') return { bg: '#78350f', border: '#f59e0b' };
          if (type === 'loading') return { bg: '#1e293b', border: '#64748b' };
          return { bg: '#1f2937', border: '#374151' };
        }

        function render() {
          const el = ensureContainer();
          el.innerHTML = '';
          toasts.forEach(function(t) {
            const item = document.createElement('div');
            const colors = colorFor(t.type);
            Object.assign(item.style, {
              background: colors.bg, border: '1px solid ' + colors.border, color: '#f9fafb',
              padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, system-ui, sans-serif',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)', pointerEvents: 'auto', minWidth: '220px', maxWidth: '360px', cursor: 'pointer',
            });
            const title = document.createElement('div');
            title.style.fontWeight = '600';
            title.textContent = String(t.message);
            item.appendChild(title);
            if (t.description) {
              const desc = document.createElement('div');
              desc.style.opacity = '0.85';
              desc.style.marginTop = '2px';
              desc.textContent = String(t.description);
              item.appendChild(desc);
            }
            item.addEventListener('click', function() { dismiss(t.id); });
            el.appendChild(item);
          });
        }

        function dismiss(id) {
          if (id === undefined) { toasts = []; render(); return; }
          toasts = toasts.filter(function(t) { return t.id !== id; });
          render();
        }

        function push(message, options) {
          options = options || {};
          const id = options.id || ++idCounter;
          const toast = {
            id: id, message: message, type: options.type || 'default',
            description: options.description,
            duration: options.duration != null ? options.duration : 4000,
          };
          toasts = toasts.filter(function(t) { return t.id !== id; }).concat([toast]);
          render();
          if (toast.duration !== Infinity && toast.duration > 0) {
            setTimeout(function() { dismiss(id); }, toast.duration);
          }
          return id;
        }

        function setPosition(pos) {
          if (pos) currentPosition = pos;
          render();
        }

        export const toastCore = { push: push, dismiss: dismiss, setPosition: setPosition };
      `,
      '__waktiRadixCore': `
        const useControllableState = (value, defaultValue, onChange) => {
          const [internal, setInternal] = window.React.useState(defaultValue);
          const isControlled = value !== undefined;
          const current = isControlled ? value : internal;
          const setValue = (next) => {
            const resolved = typeof next === 'function' ? next(current) : next;
            if (!isControlled) setInternal(resolved);
            if (typeof onChange === 'function') onChange(resolved);
          };
          return [current, setValue];
        };

        const useClickOutside = (ref, handler, active) => {
          window.React.useEffect(() => {
            if (!active) return;
            const listener = (event) => {
              if (ref.current && !ref.current.contains(event.target)) handler(event);
            };
            document.addEventListener('mousedown', listener, true);
            document.addEventListener('touchstart', listener, true);
            return () => {
              document.removeEventListener('mousedown', listener, true);
              document.removeEventListener('touchstart', listener, true);
            };
          }, [active, handler]);
        };

        const useEscapeKey = (handler, active) => {
          window.React.useEffect(() => {
            if (!active) return;
            const listener = (event) => { if (event.key === 'Escape') handler(event); };
            document.addEventListener('keydown', listener, true);
            return () => document.removeEventListener('keydown', listener, true);
          }, [active, handler]);
        };

        const mergeRefs = (...refs) => (node) => {
          refs.forEach((ref) => {
            if (!ref) return;
            if (typeof ref === 'function') ref(node);
            else ref.current = node;
          });
        };

        const mergeProps = (slotProps, childProps) => {
          const merged = Object.assign({}, slotProps, childProps);
          if (slotProps.className || childProps.className) {
            merged.className = [slotProps.className, childProps.className].filter(Boolean).join(' ');
          }
          if (slotProps.style || childProps.style) {
            merged.style = Object.assign({}, slotProps.style, childProps.style);
          }
          ['onClick', 'onChange', 'onKeyDown', 'onMouseEnter', 'onMouseLeave', 'onFocus', 'onBlur'].forEach((handlerName) => {
            const a = slotProps[handlerName];
            const b = childProps[handlerName];
            if (a && b) merged[handlerName] = (...args) => { a(...args); b(...args); };
          });
          return merged;
        };

        const Slot = window.React.forwardRef((props, ref) => {
          const rest = {};
          Object.keys(props).forEach((key) => { if (key !== 'children') rest[key] = props[key]; });
          const children = props.children;
          if (window.React.isValidElement(children)) {
            const merged = mergeProps(rest, children.props || {});
            merged.ref = mergeRefs(ref, children.ref);
            return window.React.cloneElement(children, merged);
          }
          return children || null;
        });

        export { useControllableState, useClickOutside, useEscapeKey, mergeRefs, mergeProps, Slot };
      `,
      'uuid': `
        function randomUUID() {
          if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
          const bytes = new Uint8Array(16);
          if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
          else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
          bytes[6] = (bytes[6] & 0x0f) | 0x40;
          bytes[8] = (bytes[8] & 0x3f) | 0x80;
          const hex = Array.prototype.map.call(bytes, function(b) { return b.toString(16).padStart(2, '0'); });
          return hex.slice(0,4).join('') + '-' + hex.slice(4,6).join('') + '-' + hex.slice(6,8).join('') + '-' + hex.slice(8,10).join('') + '-' + hex.slice(10,16).join('');
        }
        export function v4() { return randomUUID(); }
        export function v1() { return randomUUID(); }
        export function v3() { return randomUUID(); }
        export function v5() { return randomUUID(); }
        export const NIL = '00000000-0000-0000-0000-000000000000';
        export function validate(id) { return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id); }
        export function version(id) { return parseInt(String(id || '').charAt(14), 16) || 0; }
        export default { v4: v4, v1: v1, v3: v3, v5: v5, NIL: NIL, validate: validate, version: version };
      `,
      'dayjs': `
        const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        function pad(n) { return (n < 10 ? '0' : '') + n; }
        function dayjsAddSubtract(instance, value, unit, sign) {
          const d = new Date(instance._d.getTime());
          const amount = value * sign;
          if (unit === 'day' || unit === 'days' || unit === 'd') d.setDate(d.getDate() + amount);
          else if (unit === 'month' || unit === 'months' || unit === 'M') d.setMonth(d.getMonth() + amount);
          else if (unit === 'year' || unit === 'years' || unit === 'y') d.setFullYear(d.getFullYear() + amount);
          else if (unit === 'hour' || unit === 'hours' || unit === 'h') d.setHours(d.getHours() + amount);
          else if (unit === 'minute' || unit === 'minutes' || unit === 'm') d.setMinutes(d.getMinutes() + amount);
          else if (unit === 'second' || unit === 'seconds' || unit === 's') d.setSeconds(d.getSeconds() + amount);
          else if (unit === 'week' || unit === 'weeks' || unit === 'w') d.setDate(d.getDate() + amount * 7);
          return new Dayjs(d);
        }
        class Dayjs {
          constructor(input) {
            this._d = input === undefined ? new Date() : (input instanceof Date ? new Date(input.getTime()) : new Date(input));
          }
          format(tpl) {
            if (!tpl) return this._d.toISOString();
            const d = this._d;
            const map = {
              'YYYY': String(d.getFullYear()), 'YY': String(d.getFullYear()).slice(-2),
              'MMMM': MONTH_NAMES[d.getMonth()], 'MMM': MONTH_NAMES[d.getMonth()].slice(0,3),
              'MM': pad(d.getMonth() + 1), 'M': String(d.getMonth() + 1),
              'DD': pad(d.getDate()), 'D': String(d.getDate()),
              'dddd': DAY_NAMES[d.getDay()], 'ddd': DAY_NAMES[d.getDay()].slice(0,3),
              'HH': pad(d.getHours()), 'H': String(d.getHours()),
              'hh': pad((d.getHours() % 12) || 12), 'h': String((d.getHours() % 12) || 12),
              'mm': pad(d.getMinutes()), 'm': String(d.getMinutes()),
              'ss': pad(d.getSeconds()), 's': String(d.getSeconds()),
              'A': d.getHours() < 12 ? 'AM' : 'PM', 'a': d.getHours() < 12 ? 'am' : 'pm'
            };
            const keys = Object.keys(map).sort(function(a, b) { return b.length - a.length; });
            const placeholders = [];
            let result = tpl;
            keys.forEach(function(key) {
              while (result.indexOf(key) !== -1) {
                placeholders.push(map[key]);
                result = result.replace(key, '\\u0000' + (placeholders.length - 1) + '\\u0000');
              }
            });
            result = result.replace(/\\u0000(\\d+)\\u0000/g, function(_, idx) { return String(placeholders[Number(idx)]); });
            return result;
          }
          add(value, unit) { return dayjsAddSubtract(this, value, unit, 1); }
          subtract(value, unit) { return dayjsAddSubtract(this, value, unit, -1); }
          diff(other, unit) {
            const otherMs = other && other._d ? other._d.getTime() : new Date(other).getTime();
            const ms = this._d.getTime() - otherMs;
            const divisors = { day: 86400000, hour: 3600000, minute: 60000, second: 1000, month: 2629800000, year: 31557600000 };
            return Math.floor(ms / (divisors[unit] || 1));
          }
          isBefore(other) { return this._d.getTime() < (other && other._d ? other._d.getTime() : new Date(other).getTime()); }
          isAfter(other) { return this._d.getTime() > (other && other._d ? other._d.getTime() : new Date(other).getTime()); }
          isSame(other) { return this._d.getTime() === (other && other._d ? other._d.getTime() : new Date(other).getTime()); }
          toDate() { return new Date(this._d.getTime()); }
          valueOf() { return this._d.getTime(); }
          unix() { return Math.floor(this._d.getTime() / 1000); }
          year() { return this._d.getFullYear(); }
          month() { return this._d.getMonth(); }
          date() { return this._d.getDate(); }
          day() { return this._d.getDay(); }
          hour() { return this._d.getHours(); }
          minute() { return this._d.getMinutes(); }
          second() { return this._d.getSeconds(); }
          clone() { return new Dayjs(this._d); }
        }
        function dayjs(input) { return new Dayjs(input); }
        dayjs.extend = function() {};
        export default dayjs;
      `,
      'moment': `
        import dayjsFactory from 'dayjs';
        function moment(input) {
          const instance = dayjsFactory(input);
          instance.fromNow = function() {
            const diffMs = Date.now() - instance.toDate().getTime();
            const seconds = Math.round(diffMs / 1000);
            const abs = Math.abs(seconds);
            const suffix = seconds >= 0 ? ' ago' : ' from now';
            if (abs < 60) return 'a few seconds' + suffix;
            if (abs < 3600) return Math.round(abs / 60) + ' minutes' + suffix;
            if (abs < 86400) return Math.round(abs / 3600) + ' hours' + suffix;
            if (abs < 2629800) return Math.round(abs / 86400) + ' days' + suffix;
            if (abs < 31557600) return Math.round(abs / 2629800) + ' months' + suffix;
            return Math.round(abs / 31557600) + ' years' + suffix;
          };
          instance.startOf = function(unit) {
            const d = instance.toDate();
            if (unit === 'day') d.setHours(0,0,0,0);
            else if (unit === 'month') { d.setDate(1); d.setHours(0,0,0,0); }
            else if (unit === 'year') { d.setMonth(0,1); d.setHours(0,0,0,0); }
            else if (unit === 'hour') d.setMinutes(0,0,0);
            return dayjsFactory(d);
          };
          instance.isValid = function() { return !isNaN(instance.toDate().getTime()); };
          return instance;
        }
        moment.utc = moment;
        export default moment;
      `,
      'canvas-confetti': `
        function confetti(opts) {
          opts = opts || {};
          const particleCount = opts.particleCount || 50;
          const spread = opts.spread || 70;
          const originX = (opts.origin && opts.origin.x != null) ? opts.origin.x : 0.5;
          const originY = (opts.origin && opts.origin.y != null) ? opts.origin.y : 0.5;
          const colors = opts.colors || ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff'];

          const canvas = document.createElement('canvas');
          canvas.style.position = 'fixed';
          canvas.style.top = '0'; canvas.style.left = '0';
          canvas.style.width = '100vw'; canvas.style.height = '100vh';
          canvas.style.pointerEvents = 'none'; canvas.style.zIndex = '999999';
          canvas.width = window.innerWidth; canvas.height = window.innerHeight;
          document.body.appendChild(canvas);
          const ctx = canvas.getContext('2d');

          const particles = [];
          for (let i = 0; i < particleCount; i++) {
            const angle = (Math.random() * spread - spread / 2) * (Math.PI / 180) - Math.PI / 2;
            const speed = 4 + Math.random() * 6;
            particles.push({
              x: originX * canvas.width, y: originY * canvas.height,
              vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
              color: colors[Math.floor(Math.random() * colors.length)],
              size: 4 + Math.random() * 4, rotation: Math.random() * 360,
              rotationSpeed: (Math.random() - 0.5) * 20, gravity: 0.15 + Math.random() * 0.1, opacity: 1
            });
          }

          let frame = 0;
          const maxFrames = 120;
          function tick() {
            frame++;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let alive = false;
            particles.forEach(function(p) {
              p.x += p.vx; p.y += p.vy; p.vy += p.gravity; p.rotation += p.rotationSpeed;
              p.opacity = Math.max(0, 1 - frame / maxFrames);
              if (p.opacity > 0) {
                alive = true;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.globalAlpha = p.opacity;
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();
              }
            });
            if (alive && frame < maxFrames) window.requestAnimationFrame(tick);
            else canvas.remove();
          }
          window.requestAnimationFrame(tick);
          return Promise.resolve();
        }
        confetti.reset = function() {};
        confetti.create = function() { return confetti; };
        export default confetti;
      `,
      'react-copy-to-clipboard': `
        const CopyToClipboard = (props) => {
          const handleClick = (e) => {
            const text = props.text != null ? String(props.text) : '';
            const doCopy = function() { if (typeof props.onCopy === 'function') props.onCopy(text, true); };
            if (window.navigator && window.navigator.clipboard && window.navigator.clipboard.writeText) {
              window.navigator.clipboard.writeText(text).then(doCopy).catch(doCopy);
            } else {
              const el = document.createElement('textarea');
              el.value = text;
              el.style.position = 'fixed';
              el.style.opacity = '0';
              document.body.appendChild(el);
              el.select();
              try { document.execCommand('copy'); } catch (err) {}
              document.body.removeChild(el);
              doCopy();
            }
            const child = props.children;
            if (child && child.props && typeof child.props.onClick === 'function') child.props.onClick(e);
          };
          const child = props.children;
          if (!child) return null;
          return window.React.cloneElement(child, { onClick: handleClick });
        };
        export { CopyToClipboard };
        export default CopyToClipboard;
      `,
      'react-intersection-observer': `
        const useInView = (options) => {
          options = options || {};
          const [ref, setRef] = window.React.useState(null);
          const [entryState, setEntryState] = window.React.useState({ inView: !!options.initialInView, entry: undefined });
          window.React.useEffect(() => {
            if (!ref) return;
            if (typeof window.IntersectionObserver === 'undefined') { setEntryState({ inView: true, entry: undefined }); return; }
            const observer = new window.IntersectionObserver((entries) => {
              const entry = entries[0];
              if (!entry) return;
              const inView = entry.isIntersecting;
              setEntryState({ inView: inView, entry: entry });
              if (inView && options.triggerOnce) observer.disconnect();
            }, { threshold: options.threshold || 0, root: options.root || null, rootMargin: options.rootMargin || '0px' });
            observer.observe(ref);
            return () => observer.disconnect();
          }, [ref, options.threshold, options.triggerOnce, options.rootMargin]);
          return { ref: setRef, inView: entryState.inView, entry: entryState.entry };
        };
        export { useInView };
        const InView = (props) => {
          const state = useInView({ threshold: props.threshold, triggerOnce: props.triggerOnce, initialInView: props.initialInView, rootMargin: props.rootMargin, root: props.root });
          window.React.useEffect(() => { if (typeof props.onChange === 'function') props.onChange(state.inView); }, [state.inView]);
          if (typeof props.children === 'function') return props.children({ inView: state.inView, ref: state.ref });
          return window.React.createElement('div', { ref: state.ref }, props.children);
        };
        export { InView };
        export default InView;
      `,
      'react-loading-skeleton': `
        const Skeleton = (props) => {
          const count = props.count || 1;
          const circle = props.circle;
          const style = Object.assign({
            display: 'block',
            width: props.width != null ? (typeof props.width === 'number' ? props.width + 'px' : props.width) : '100%',
            height: props.height != null ? (typeof props.height === 'number' ? props.height + 'px' : props.height) : '1em',
            borderRadius: circle ? '50%' : (props.borderRadius != null ? props.borderRadius : '0.25rem'),
            background: 'linear-gradient(90deg, rgba(120,120,120,0.15) 25%, rgba(120,120,120,0.3) 37%, rgba(120,120,120,0.15) 63%)',
            backgroundSize: '400% 100%', animation: 'wakti-skeleton-pulse 1.4s ease infinite', lineHeight: 1,
          }, props.style || {});
          if (!document.getElementById('wakti-skeleton-keyframes')) {
            const styleEl = document.createElement('style');
            styleEl.id = 'wakti-skeleton-keyframes';
            styleEl.textContent = '@keyframes wakti-skeleton-pulse { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }';
            document.head.appendChild(styleEl);
          }
          const items = [];
          for (let i = 0; i < count; i++) {
            items.push(window.React.createElement('span', { key: i, style: Object.assign({}, style, { marginBottom: count > 1 ? '0.4em' : 0 }) }));
          }
          return window.React.createElement(window.React.Fragment, null, items);
        };
        export { Skeleton };
        export default Skeleton;
      `,
      'react-masonry-css': `
        const Masonry = (props) => {
          const breakpointCols = props.breakpointCols;
          const [columnCount, setColumnCount] = window.React.useState(3);
          window.React.useEffect(() => {
            const compute = function() {
              let cols = 3;
              if (typeof breakpointCols === 'number') cols = breakpointCols;
              else if (breakpointCols && typeof breakpointCols === 'object') {
                const width = window.innerWidth;
                cols = breakpointCols.default || 3;
                Object.keys(breakpointCols).forEach(function(key) {
                  if (key !== 'default' && width <= parseInt(key, 10)) cols = Math.min(cols, breakpointCols[key]);
                });
              }
              setColumnCount(Math.max(1, cols));
            };
            compute();
            window.addEventListener('resize', compute);
            return () => window.removeEventListener('resize', compute);
          }, [JSON.stringify(breakpointCols)]);

          const children = window.React.Children.toArray(props.children);
          const columns = [];
          for (let i = 0; i < columnCount; i++) columns.push([]);
          children.forEach((child, i) => { columns[i % columnCount].push(child); });

          return window.React.createElement(
            'div',
            { className: props.className, style: { display: 'flex', gap: '1rem', alignItems: 'flex-start' } },
            columns.map((col, i) => window.React.createElement(
              'div',
              { key: i, className: props.columnClassName || '', style: { display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, minWidth: 0 } },
              col
            ))
          );
        };
        export default Masonry;
      `,
      'react-infinite-scroll-component': `
        const InfiniteScroll = (props) => {
          const sentinelRef = window.React.useRef(null);
          const loadingRef = window.React.useRef(false);
          window.React.useEffect(() => {
            const node = sentinelRef.current;
            if (!node || !props.hasMore) return;
            if (typeof window.IntersectionObserver === 'undefined') return;
            const observer = new window.IntersectionObserver((entries) => {
              if (entries[0] && entries[0].isIntersecting && !loadingRef.current && props.hasMore) {
                loadingRef.current = true;
                const result = props.next && props.next();
                if (result && typeof result.then === 'function') result.then(() => { loadingRef.current = false; });
                else setTimeout(() => { loadingRef.current = false; }, 200);
              }
            }, { threshold: 0 });
            observer.observe(node);
            return () => observer.disconnect();
          }, [props.hasMore, props.dataLength]);

          return window.React.createElement(
            'div',
            { id: props.id, className: props.className, style: props.height ? { height: props.height, overflow: 'auto' } : undefined },
            props.children,
            window.React.createElement('div', { ref: sentinelRef, style: { height: 1 } }),
            props.hasMore ? (props.loader || null) : (props.endMessage || null)
          );
        };
        export default InfiniteScroll;
      `,
      'zod': `
        class ZodError extends Error {
          constructor(errors) {
            super('Validation failed');
            this.errors = errors;
            this.issues = errors;
          }
        }

        class ZodType {
          constructor() {
            this._isOptional = false;
            this._isNullable = false;
            this._hasDefault = false;
            this._defaultValue = undefined;
            this._refinements = [];
          }
          optional() { const c = this._clone(); c._isOptional = true; return c; }
          nullable() { const c = this._clone(); c._isNullable = true; return c; }
          nullish() { const c = this._clone(); c._isOptional = true; c._isNullable = true; return c; }
          default(value) { const c = this._clone(); c._hasDefault = true; c._defaultValue = value; return c; }
          refine(fn, message) {
            const c = this._clone();
            c._refinements = c._refinements.concat([{ fn: fn, message: (message && message.message) || message || 'Invalid value' }]);
            return c;
          }
          _clone() {
            const c = Object.create(Object.getPrototypeOf(this));
            Object.assign(c, this);
            c._refinements = this._refinements.slice();
            return c;
          }
          _checkBase(value, path, errors) {
            if (value === undefined) {
              if (this._hasDefault) return this._defaultValue;
              if (this._isOptional) return undefined;
              errors.push({ path: path, message: 'Required' });
              return undefined;
            }
            if (value === null) {
              if (this._isNullable) return null;
              errors.push({ path: path, message: 'Expected value, received null' });
              return undefined;
            }
            return value;
          }
          _runRefinements(value, path, errors) {
            this._refinements.forEach(function(r) {
              try { if (!r.fn(value)) errors.push({ path: path, message: r.message }); }
              catch (e) { errors.push({ path: path, message: r.message }); }
            });
          }
          parse(value) {
            const errors = [];
            const result = this._check(value, [], errors);
            if (errors.length > 0) throw new ZodError(errors);
            return result;
          }
          safeParse(value) {
            const errors = [];
            const result = this._check(value, [], errors);
            if (errors.length > 0) return { success: false, error: new ZodError(errors) };
            return { success: true, data: result };
          }
        }

        class ZodString extends ZodType {
          constructor() { super(); this._checks = []; }
          _clone() { const c = super._clone(); c._checks = this._checks.slice(); return c; }
          min(len, msg) { const c = this._clone(); c._checks.push({ type: 'min', value: len, message: (msg && msg.message) || msg || ('String must contain at least ' + len + ' character(s)') }); return c; }
          max(len, msg) { const c = this._clone(); c._checks.push({ type: 'max', value: len, message: (msg && msg.message) || msg || ('String must contain at most ' + len + ' character(s)') }); return c; }
          length(len, msg) { const c = this._clone(); c._checks.push({ type: 'length', value: len, message: (msg && msg.message) || msg || ('String must be exactly ' + len + ' character(s)') }); return c; }
          email(msg) { const c = this._clone(); c._checks.push({ type: 'email', message: (msg && msg.message) || msg || 'Invalid email' }); return c; }
          url(msg) { const c = this._clone(); c._checks.push({ type: 'url', message: (msg && msg.message) || msg || 'Invalid url' }); return c; }
          regex(re, msg) { const c = this._clone(); c._checks.push({ type: 'regex', value: re, message: (msg && msg.message) || msg || 'Invalid format' }); return c; }
          trim() { const c = this._clone(); c._checks.push({ type: 'trim' }); return c; }
          nonempty(msg) { return this.min(1, msg); }
          _check(value, path, errors) {
            const v = this._checkBase(value, path, errors);
            if (v === undefined || v === null) return v;
            if (typeof v !== 'string') { errors.push({ path: path, message: 'Expected string' }); return v; }
            let result = v;
            for (const check of this._checks) {
              if (check.type === 'trim') { result = result.trim(); continue; }
              if (check.type === 'min' && result.length < check.value) errors.push({ path: path, message: check.message });
              if (check.type === 'max' && result.length > check.value) errors.push({ path: path, message: check.message });
              if (check.type === 'length' && result.length !== check.value) errors.push({ path: path, message: check.message });
              if (check.type === 'email' && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(result)) errors.push({ path: path, message: check.message });
              if (check.type === 'url') { try { new URL(result); } catch (e) { errors.push({ path: path, message: check.message }); } }
              if (check.type === 'regex' && !check.value.test(result)) errors.push({ path: path, message: check.message });
            }
            this._runRefinements(result, path, errors);
            return result;
          }
        }

        class ZodNumber extends ZodType {
          constructor() { super(); this._checks = []; }
          _clone() { const c = super._clone(); c._checks = this._checks.slice(); return c; }
          min(n, msg) { const c = this._clone(); c._checks.push({ type: 'min', value: n, message: (msg && msg.message) || msg || ('Number must be greater than or equal to ' + n) }); return c; }
          max(n, msg) { const c = this._clone(); c._checks.push({ type: 'max', value: n, message: (msg && msg.message) || msg || ('Number must be less than or equal to ' + n) }); return c; }
          int(msg) { const c = this._clone(); c._checks.push({ type: 'int', message: (msg && msg.message) || msg || 'Expected integer' }); return c; }
          positive(msg) { return this.min(0.0000001, msg); }
          nonnegative(msg) { return this.min(0, msg); }
          negative(msg) { const c = this._clone(); c._checks.push({ type: 'max', value: -0.0000001, message: (msg && msg.message) || msg || 'Number must be negative' }); return c; }
          _check(value, path, errors) {
            let v = this._checkBase(value, path, errors);
            if (v === undefined || v === null) return v;
            if (typeof v === 'string' && v !== '' && !isNaN(Number(v))) v = Number(v);
            if (typeof v !== 'number' || isNaN(v)) { errors.push({ path: path, message: 'Expected number' }); return v; }
            for (const check of this._checks) {
              if (check.type === 'min' && v < check.value) errors.push({ path: path, message: check.message });
              if (check.type === 'max' && v > check.value) errors.push({ path: path, message: check.message });
              if (check.type === 'int' && !Number.isInteger(v)) errors.push({ path: path, message: check.message });
            }
            this._runRefinements(v, path, errors);
            return v;
          }
        }

        class ZodBoolean extends ZodType {
          _check(value, path, errors) {
            const v = this._checkBase(value, path, errors);
            if (v === undefined || v === null) return v;
            if (typeof v !== 'boolean') { errors.push({ path: path, message: 'Expected boolean' }); return v; }
            this._runRefinements(v, path, errors);
            return v;
          }
        }

        class ZodDate extends ZodType {
          _check(value, path, errors) {
            const v = this._checkBase(value, path, errors);
            if (v === undefined || v === null) return v;
            const d = v instanceof Date ? v : new Date(v);
            if (isNaN(d.getTime())) { errors.push({ path: path, message: 'Expected date' }); return v; }
            this._runRefinements(d, path, errors);
            return d;
          }
        }

        class ZodLiteral extends ZodType {
          constructor(literalValue) { super(); this._literal = literalValue; }
          _check(value, path, errors) {
            const v = this._checkBase(value, path, errors);
            if (v === undefined || v === null) return v;
            if (v !== this._literal) errors.push({ path: path, message: 'Invalid literal value' });
            return v;
          }
        }

        class ZodEnum extends ZodType {
          constructor(values) { super(); this._values = values; }
          _check(value, path, errors) {
            const v = this._checkBase(value, path, errors);
            if (v === undefined || v === null) return v;
            if (this._values.indexOf(v) === -1) errors.push({ path: path, message: 'Invalid enum value. Expected ' + this._values.join(' | ') });
            return v;
          }
        }

        class ZodArray extends ZodType {
          constructor(itemSchema) { super(); this._item = itemSchema; this._checks = []; }
          _clone() { const c = super._clone(); c._checks = this._checks.slice(); return c; }
          min(n, msg) { const c = this._clone(); c._checks.push({ type: 'min', value: n, message: (msg && msg.message) || msg || ('Array must contain at least ' + n + ' element(s)') }); return c; }
          max(n, msg) { const c = this._clone(); c._checks.push({ type: 'max', value: n, message: (msg && msg.message) || msg || ('Array must contain at most ' + n + ' element(s)') }); return c; }
          nonempty(msg) { return this.min(1, msg); }
          _check(value, path, errors) {
            const v = this._checkBase(value, path, errors);
            if (v === undefined || v === null) return v;
            if (!Array.isArray(v)) { errors.push({ path: path, message: 'Expected array' }); return v; }
            for (const check of this._checks) {
              if (check.type === 'min' && v.length < check.value) errors.push({ path: path, message: check.message });
              if (check.type === 'max' && v.length > check.value) errors.push({ path: path, message: check.message });
            }
            const item = this._item;
            const result = v.map(function(entry, i) { return item._check(entry, path.concat([i]), errors); });
            this._runRefinements(result, path, errors);
            return result;
          }
        }

        class ZodObject extends ZodType {
          constructor(shape) { super(); this._shape = shape; }
          partial() {
            const c = this._clone();
            const newShape = {};
            Object.keys(c._shape).forEach(function(key) { newShape[key] = c._shape[key].optional(); });
            c._shape = newShape;
            return c;
          }
          extend(shape) {
            const c = this._clone();
            c._shape = Object.assign({}, c._shape, shape);
            return c;
          }
          _check(value, path, errors) {
            const v = this._checkBase(value, path, errors);
            if (v === undefined || v === null) return v;
            if (typeof v !== 'object' || Array.isArray(v)) { errors.push({ path: path, message: 'Expected object' }); return v; }
            const result = {};
            const shape = this._shape;
            Object.keys(shape).forEach(function(key) {
              const fieldResult = shape[key]._check(v[key], path.concat([key]), errors);
              if (fieldResult !== undefined) result[key] = fieldResult;
            });
            this._runRefinements(result, path, errors);
            return result;
          }
        }

        class ZodUnion extends ZodType {
          constructor(options) { super(); this._options = options; }
          _check(value, path, errors) {
            const v = this._checkBase(value, path, errors);
            if (v === undefined || v === null) return v;
            for (const option of this._options) {
              const localErrors = [];
              const result = option._check(v, path, localErrors);
              if (localErrors.length === 0) return result;
            }
            errors.push({ path: path, message: 'Invalid input' });
            return v;
          }
        }

        const z = {
          string: function() { return new ZodString(); },
          number: function() { return new ZodNumber(); },
          boolean: function() { return new ZodBoolean(); },
          date: function() { return new ZodDate(); },
          literal: function(v) { return new ZodLiteral(v); },
          enum: function(values) { return new ZodEnum(values); },
          array: function(item) { return new ZodArray(item); },
          object: function(shape) { return new ZodObject(shape); },
          union: function(options) { return new ZodUnion(options); },
          any: function() {
            const t = new ZodType();
            t._check = function(value, path, errors) { return t._checkBase(value, path, errors); };
            return t;
          },
        };
        z.unknown = z.any;

        export { z, ZodError };
        export default { z: z, ZodError: ZodError };
      `,
      '@hookform/resolvers': `
        import { z } from 'zod';
        export function zodResolver(schema) {
          return function(values) {
            const result = schema.safeParse(values);
            if (result.success) return { values: result.data, errors: {} };
            const errors = {};
            (result.error && result.error.errors || []).forEach(function(e) {
              const key = e.path && e.path.length ? e.path.join('.') : 'root';
              if (!errors[key]) errors[key] = { type: 'validation', message: e.message };
            });
            return { values: {}, errors: errors };
          };
        }
      `,
      'axios': `
        function buildURL(url, params) {
          if (!params) return url;
          const query = Object.keys(params)
            .filter(function(k) { return params[k] !== undefined && params[k] !== null; })
            .map(function(k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
            .join('&');
          if (!query) return url;
          return url + (url.indexOf('?') === -1 ? '?' : '&') + query;
        }

        function mergeConfig(base, config) {
          return Object.assign({}, base, config, {
            headers: Object.assign({}, base && base.headers, config && config.headers),
          });
        }

        function createInstance(defaults) {
          defaults = defaults || {};

          async function request(config) {
            config = mergeConfig(defaults, config);
            const baseURL = config.baseURL || '';
            const url = (config.url || '').indexOf('http') === 0 ? config.url : baseURL + (config.url || '');
            const fullUrl = buildURL(url, config.params);
            const fetchOpts = {
              method: (config.method || 'get').toUpperCase(),
              headers: Object.assign({}, config.headers),
            };
            if (config.data !== undefined) {
              if (typeof config.data === 'object' && !(config.data instanceof FormData)) {
                fetchOpts.headers['Content-Type'] = fetchOpts.headers['Content-Type'] || 'application/json';
                fetchOpts.body = JSON.stringify(config.data);
              } else {
                fetchOpts.body = config.data;
              }
            }
            let response;
            try {
              response = await fetch(fullUrl, fetchOpts);
            } catch (networkErr) {
              const err = new Error(networkErr && networkErr.message ? networkErr.message : 'Network Error');
              err.isAxiosError = true;
              err.config = config;
              throw err;
            }
            const contentType = response.headers.get('content-type') || '';
            let data;
            try {
              data = contentType.indexOf('application/json') !== -1 ? await response.json() : await response.text();
            } catch (e) {
              data = null;
            }
            const axiosResponse = {
              data: data, status: response.status, statusText: response.statusText,
              headers: response.headers, config: config,
            };
            if (!response.ok) {
              const err = new Error('Request failed with status code ' + response.status);
              err.isAxiosError = true;
              err.response = axiosResponse;
              err.config = config;
              throw err;
            }
            return axiosResponse;
          }

          const instance = function(config) { return request(typeof config === 'string' ? { url: config, method: 'get' } : config); };
          instance.request = request;
          instance.get = function(url, config) { return request(Object.assign({}, config, { url: url, method: 'get' })); };
          instance.delete = function(url, config) { return request(Object.assign({}, config, { url: url, method: 'delete' })); };
          instance.head = function(url, config) { return request(Object.assign({}, config, { url: url, method: 'head' })); };
          instance.post = function(url, data, config) { return request(Object.assign({}, config, { url: url, method: 'post', data: data })); };
          instance.put = function(url, data, config) { return request(Object.assign({}, config, { url: url, method: 'put', data: data })); };
          instance.patch = function(url, data, config) { return request(Object.assign({}, config, { url: url, method: 'patch', data: data })); };
          instance.defaults = defaults;
          instance.interceptors = {
            request: { use: function() { return 0; }, eject: function() {} },
            response: { use: function() { return 0; }, eject: function() {} },
          };
          instance.create = function(config) { return createInstance(Object.assign({}, defaults, config)); };
          instance.isAxiosError = function(payload) { return !!(payload && payload.isAxiosError); };
          instance.CancelToken = { source: function() { return { token: {}, cancel: function() {} }; } };
          return instance;
        }

        const axios = createInstance({});
        export default axios;
      `,
      'swr': `
        const cache = new Map();
        const listenersMap = new Map();

        function notify(key) {
          const listeners = listenersMap.get(key);
          if (listeners) listeners.forEach(function(fn) { fn(); });
        }

        function useSWR(key, fetcher, options) {
          options = options || {};
          const keyStr = Array.isArray(key) ? JSON.stringify(key) : key;
          const [, forceRender] = window.React.useState(0);

          window.React.useEffect(() => {
            if (!keyStr) return undefined;
            const listeners = listenersMap.get(keyStr) || new Set();
            const rerender = () => forceRender((n) => n + 1);
            listeners.add(rerender);
            listenersMap.set(keyStr, listeners);
            return () => { listeners.delete(rerender); };
          }, [keyStr]);

          window.React.useEffect(() => {
            if (!keyStr || typeof fetcher !== 'function') return undefined;
            let cancelled = false;
            const existing = cache.get(keyStr);
            if (!existing || options.revalidateOnMount !== false) {
              const entry = cache.get(keyStr) || {};
              cache.set(keyStr, Object.assign({}, entry, { isLoading: true }));
              notify(keyStr);
              Promise.resolve(fetcher(key))
                .then((data) => {
                  if (cancelled) return;
                  cache.set(keyStr, { data: data, error: undefined, isLoading: false });
                  notify(keyStr);
                })
                .catch((error) => {
                  if (cancelled) return;
                  cache.set(keyStr, { data: undefined, error: error, isLoading: false });
                  notify(keyStr);
                  if (typeof options.onError === 'function') options.onError(error);
                });
            }
            return () => { cancelled = true; };
          }, [keyStr]);

          const entry = cache.get(keyStr) || { data: options.fallbackData, error: undefined, isLoading: keyStr != null };
          const mutate = (newData) => {
            if (typeof newData === 'function') {
              const current = (cache.get(keyStr) || {}).data;
              cache.set(keyStr, Object.assign({}, cache.get(keyStr), { data: newData(current) }));
            } else if (newData !== undefined) {
              cache.set(keyStr, Object.assign({}, cache.get(keyStr), { data: newData }));
            }
            notify(keyStr);
          };

          return { data: entry.data, error: entry.error, isLoading: !!entry.isLoading, isValidating: !!entry.isLoading, mutate: mutate };
        }

        export default useSWR;
        export { useSWR };
        export function useSWRConfig() { return { cache: cache, mutate: function() {} }; }
      `,
      'sonner': `
        import { toastCore } from '__waktiToastCore';

        function toast(message, options) { return toastCore.push(message, options); }
        toast.success = function(message, options) { return toastCore.push(message, Object.assign({}, options, { type: 'success' })); };
        toast.error = function(message, options) { return toastCore.push(message, Object.assign({}, options, { type: 'error' })); };
        toast.warning = function(message, options) { return toastCore.push(message, Object.assign({}, options, { type: 'warning' })); };
        toast.info = function(message, options) { return toastCore.push(message, Object.assign({}, options, { type: 'default' })); };
        toast.loading = function(message, options) { return toastCore.push(message, Object.assign({}, options, { type: 'loading', duration: Infinity })); };
        toast.dismiss = function(id) { return toastCore.dismiss(id); };
        toast.promise = function(promise, msgs) {
          const id = toast.loading((msgs && msgs.loading) || 'Loading...');
          return Promise.resolve(promise).then(function(result) {
            toastCore.dismiss(id);
            toast.success(typeof (msgs && msgs.success) === 'function' ? msgs.success(result) : ((msgs && msgs.success) || 'Success'));
            return result;
          }).catch(function(err) {
            toastCore.dismiss(id);
            toast.error(typeof (msgs && msgs.error) === 'function' ? msgs.error(err) : ((msgs && msgs.error) || 'Error'));
            throw err;
          });
        };
        export { toast };

        export const Toaster = (props) => {
          window.React.useEffect(() => { toastCore.setPosition(props.position); }, [props.position]);
          return null;
        };

        export default toast;
      `,
      'react-toastify': `
        import { toastCore } from '__waktiToastCore';

        function toast(message, options) { return toastCore.push(message, options); }
        toast.success = function(message, options) { return toastCore.push(message, Object.assign({}, options, { type: 'success' })); };
        toast.error = function(message, options) { return toastCore.push(message, Object.assign({}, options, { type: 'error' })); };
        toast.warning = function(message, options) { return toastCore.push(message, Object.assign({}, options, { type: 'warning' })); };
        toast.warn = toast.warning;
        toast.info = function(message, options) { return toastCore.push(message, Object.assign({}, options, { type: 'default' })); };
        toast.loading = function(message, options) { return toastCore.push(message, Object.assign({}, options, { type: 'loading', duration: Infinity })); };
        toast.dismiss = function(id) { return toastCore.dismiss(id); };
        toast.isActive = function() { return false; };
        export { toast };

        export const ToastContainer = (props) => {
          window.React.useEffect(() => { toastCore.setPosition(props.position); }, [props.position]);
          return null;
        };

        export const Slide = 'slide';
        export const Bounce = 'bounce';
        export const Zoom = 'zoom';
        export const Flip = 'flip';

        export default toast;
      `,
      'react-hot-toast': `
        import { toastCore } from '__waktiToastCore';

        function toast(message, options) { return toastCore.push(message, options); }
        toast.success = function(message, options) { return toastCore.push(message, Object.assign({}, options, { type: 'success' })); };
        toast.error = function(message, options) { return toastCore.push(message, Object.assign({}, options, { type: 'error' })); };
        toast.loading = function(message, options) { return toastCore.push(message, Object.assign({}, options, { type: 'loading', duration: Infinity })); };
        toast.dismiss = function(id) { return toastCore.dismiss(id); };
        toast.remove = function(id) { return toastCore.dismiss(id); };
        toast.promise = function(promise, msgs) {
          const id = toast.loading((msgs && msgs.loading) || 'Loading...');
          return Promise.resolve(promise).then(function(result) {
            toastCore.dismiss(id);
            toast.success(typeof (msgs && msgs.success) === 'function' ? msgs.success(result) : ((msgs && msgs.success) || 'Success'));
            return result;
          }).catch(function(err) {
            toastCore.dismiss(id);
            toast.error(typeof (msgs && msgs.error) === 'function' ? msgs.error(err) : ((msgs && msgs.error) || 'Error'));
            throw err;
          });
        };

        export const Toaster = (props) => {
          window.React.useEffect(() => { toastCore.setPosition(props.position); }, [props.position]);
          return null;
        };

        export default toast;
      `,
      '@radix-ui/react-slot': `
        import { Slot } from '__waktiRadixCore';
        export { Slot };
        export default Slot;
      `,
      '@radix-ui/react-dialog': `
        import { useControllableState, useClickOutside, useEscapeKey, Slot } from '__waktiRadixCore';

        const DialogContext = window.React.createContext(null);

        export const Root = (props) => {
          const [open, setOpen] = useControllableState(props.open, !!props.defaultOpen, props.onOpenChange);
          return window.React.createElement(DialogContext.Provider, { value: { open: open, setOpen: setOpen } }, props.children);
        };

        export const Trigger = window.React.forwardRef((props, ref) => {
          const ctx = window.React.useContext(DialogContext);
          const handleClick = (e) => { if (ctx) ctx.setOpen(true); if (props.onClick) props.onClick(e); };
          if (props.asChild) return window.React.createElement(Slot, Object.assign({}, props, { ref: ref, onClick: handleClick }));
          return window.React.createElement('button', Object.assign({}, props, { ref: ref, onClick: handleClick, type: props.type || 'button' }));
        });

        export const Close = window.React.forwardRef((props, ref) => {
          const ctx = window.React.useContext(DialogContext);
          const handleClick = (e) => { if (ctx) ctx.setOpen(false); if (props.onClick) props.onClick(e); };
          if (props.asChild) return window.React.createElement(Slot, Object.assign({}, props, { ref: ref, onClick: handleClick }));
          return window.React.createElement('button', Object.assign({}, props, { ref: ref, onClick: handleClick, type: props.type || 'button' }));
        });

        export const Portal = (props) => props.children;

        export const Overlay = window.React.forwardRef((props, ref) => {
          const ctx = window.React.useContext(DialogContext);
          if (!ctx || !ctx.open) return null;
          return window.React.createElement('div', Object.assign({}, props, {
            ref: ref, style: Object.assign({ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }, props.style),
          }));
        });

        export const Content = window.React.forwardRef((props, ref) => {
          const ctx = window.React.useContext(DialogContext);
          const localRef = window.React.useRef(null);
          useClickOutside(localRef, () => { if (ctx) ctx.setOpen(false); }, !!(ctx && ctx.open));
          useEscapeKey(() => { if (ctx) ctx.setOpen(false); }, !!(ctx && ctx.open));
          if (!ctx || !ctx.open) return null;
          return window.React.createElement('div', Object.assign({}, props, {
            ref: (node) => { localRef.current = node; if (typeof ref === 'function') ref(node); else if (ref) ref.current = node; },
            role: 'dialog', 'aria-modal': 'true',
            style: Object.assign({ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 51 }, props.style),
          }));
        });

        export const Title = (props) => window.React.createElement('h2', props);
        export const Description = (props) => window.React.createElement('p', props);
      `,
      '@radix-ui/react-popover': `
        import { useControllableState, useClickOutside, useEscapeKey, Slot } from '__waktiRadixCore';

        const PopoverContext = window.React.createContext(null);

        export const Root = (props) => {
          const [open, setOpen] = useControllableState(props.open, !!props.defaultOpen, props.onOpenChange);
          const triggerRef = window.React.useRef(null);
          return window.React.createElement(PopoverContext.Provider, { value: { open: open, setOpen: setOpen, triggerRef: triggerRef } }, props.children);
        };

        export const Trigger = window.React.forwardRef((props, ref) => {
          const ctx = window.React.useContext(PopoverContext);
          const handleClick = (e) => { if (ctx) ctx.setOpen(!ctx.open); if (props.onClick) props.onClick(e); };
          const setRefs = (node) => {
            if (ctx) ctx.triggerRef.current = node;
            if (typeof ref === 'function') ref(node); else if (ref) ref.current = node;
          };
          if (props.asChild) return window.React.createElement(Slot, Object.assign({}, props, { ref: setRefs, onClick: handleClick }));
          return window.React.createElement('button', Object.assign({}, props, { ref: setRefs, onClick: handleClick, type: props.type || 'button' }));
        });

        export const Anchor = Trigger;
        export const Portal = (props) => props.children;

        export const Content = window.React.forwardRef((props, ref) => {
          const ctx = window.React.useContext(PopoverContext);
          const localRef = window.React.useRef(null);
          const [pos, setPos] = window.React.useState({ top: 0, left: 0 });
          useClickOutside(localRef, () => { if (ctx) ctx.setOpen(false); }, !!(ctx && ctx.open));
          useEscapeKey(() => { if (ctx) ctx.setOpen(false); }, !!(ctx && ctx.open));
          window.React.useEffect(() => {
            if (ctx && ctx.open && ctx.triggerRef.current) {
              const rect = ctx.triggerRef.current.getBoundingClientRect();
              setPos({ top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX });
            }
          }, [ctx && ctx.open]);
          if (!ctx || !ctx.open) return null;
          return window.React.createElement('div', Object.assign({}, props, {
            ref: (node) => { localRef.current = node; if (typeof ref === 'function') ref(node); else if (ref) ref.current = node; },
            style: Object.assign({ position: 'absolute', top: pos.top + 'px', left: pos.left + 'px', zIndex: 50 }, props.style),
          }));
        });

        export const Close = window.React.forwardRef((props, ref) => {
          const ctx = window.React.useContext(PopoverContext);
          const handleClick = (e) => { if (ctx) ctx.setOpen(false); if (props.onClick) props.onClick(e); };
          return window.React.createElement('button', Object.assign({}, props, { ref: ref, onClick: handleClick, type: props.type || 'button' }));
        });

        export const Arrow = () => null;
      `,
      '@radix-ui/react-dropdown-menu': `
        import { useControllableState, useClickOutside, useEscapeKey, Slot } from '__waktiRadixCore';

        const MenuContext = window.React.createContext(null);

        export const Root = (props) => {
          const [open, setOpen] = useControllableState(props.open, !!props.defaultOpen, props.onOpenChange);
          const triggerRef = window.React.useRef(null);
          return window.React.createElement(MenuContext.Provider, { value: { open: open, setOpen: setOpen, triggerRef: triggerRef } }, props.children);
        };

        export const Trigger = window.React.forwardRef((props, ref) => {
          const ctx = window.React.useContext(MenuContext);
          const handleClick = (e) => { if (ctx) ctx.setOpen(!ctx.open); if (props.onClick) props.onClick(e); };
          const setRefs = (node) => {
            if (ctx) ctx.triggerRef.current = node;
            if (typeof ref === 'function') ref(node); else if (ref) ref.current = node;
          };
          if (props.asChild) return window.React.createElement(Slot, Object.assign({}, props, { ref: setRefs, onClick: handleClick }));
          return window.React.createElement('button', Object.assign({}, props, { ref: setRefs, onClick: handleClick, type: props.type || 'button' }));
        });

        export const Portal = (props) => props.children;
        export const Group = (props) => window.React.createElement('div', { role: 'group' }, props.children);
        export const Label = (props) => window.React.createElement('div', props);
        export const Separator = (props) => window.React.createElement('div', Object.assign({}, props, { style: Object.assign({ height: 1, background: 'currentColor', opacity: 0.15, margin: '4px 0' }, props.style) }));
        export const Sub = (props) => window.React.createElement(window.React.Fragment, null, props.children);
        export const SubTrigger = Trigger;
        export const SubContent = (props) => window.React.createElement('div', props);

        export const Content = window.React.forwardRef((props, ref) => {
          const ctx = window.React.useContext(MenuContext);
          const localRef = window.React.useRef(null);
          const [pos, setPos] = window.React.useState({ top: 0, left: 0 });
          useClickOutside(localRef, () => { if (ctx) ctx.setOpen(false); }, !!(ctx && ctx.open));
          useEscapeKey(() => { if (ctx) ctx.setOpen(false); }, !!(ctx && ctx.open));
          window.React.useEffect(() => {
            if (ctx && ctx.open && ctx.triggerRef.current) {
              const rect = ctx.triggerRef.current.getBoundingClientRect();
              setPos({ top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX });
            }
          }, [ctx && ctx.open]);
          if (!ctx || !ctx.open) return null;
          return window.React.createElement('div', Object.assign({}, props, {
            ref: (node) => { localRef.current = node; if (typeof ref === 'function') ref(node); else if (ref) ref.current = node; },
            role: 'menu',
            style: Object.assign({ position: 'absolute', top: pos.top + 'px', left: pos.left + 'px', zIndex: 50 }, props.style),
          }));
        });

        export const Item = window.React.forwardRef((props, ref) => {
          const ctx = window.React.useContext(MenuContext);
          const handleClick = (e) => {
            if (props.disabled) return;
            if (props.onSelect) props.onSelect(e);
            if (props.onClick) props.onClick(e);
            if (ctx) ctx.setOpen(false);
          };
          return window.React.createElement('div', Object.assign({}, props, { ref: ref, role: 'menuitem', onClick: handleClick, style: Object.assign({ cursor: props.disabled ? 'default' : 'pointer' }, props.style) }));
        });

        export const CheckboxItem = window.React.forwardRef((props, ref) => {
          const handleClick = (e) => { if (props.onCheckedChange) props.onCheckedChange(!props.checked); if (props.onClick) props.onClick(e); };
          return window.React.createElement('div', Object.assign({}, props, { ref: ref, role: 'menuitemcheckbox', 'aria-checked': !!props.checked, onClick: handleClick, style: Object.assign({ cursor: 'pointer' }, props.style) }));
        });

        export const RadioGroup = (props) => window.React.createElement('div', { role: 'group' }, props.children);
        export const RadioItem = window.React.forwardRef((props, ref) => {
          const handleClick = (e) => { if (props.onSelect) props.onSelect(e); if (props.onClick) props.onClick(e); };
          return window.React.createElement('div', Object.assign({}, props, { ref: ref, role: 'menuitemradio', onClick: handleClick, style: Object.assign({ cursor: 'pointer' }, props.style) }));
        });

        export const ItemIndicator = (props) => window.React.createElement(window.React.Fragment, null, props.children);
      `,
      '@radix-ui/react-tooltip': `
        export const Provider = (props) => props.children;

        const TooltipContext = window.React.createContext(null);

        export const Root = (props) => {
          const [open, setOpen] = window.React.useState(!!props.defaultOpen);
          const triggerRef = window.React.useRef(null);
          return window.React.createElement(TooltipContext.Provider, { value: { open: open, setOpen: setOpen, triggerRef: triggerRef } }, props.children);
        };

        export const Trigger = window.React.forwardRef((props, ref) => {
          const ctx = window.React.useContext(TooltipContext);
          const setRefs = (node) => {
            if (ctx) ctx.triggerRef.current = node;
            if (typeof ref === 'function') ref(node); else if (ref) ref.current = node;
          };
          const handleEnter = (e) => { if (ctx) ctx.setOpen(true); if (props.onMouseEnter) props.onMouseEnter(e); };
          const handleLeave = (e) => { if (ctx) ctx.setOpen(false); if (props.onMouseLeave) props.onMouseLeave(e); };
          if (props.asChild && window.React.isValidElement(props.children)) {
            return window.React.cloneElement(props.children, { ref: setRefs, onMouseEnter: handleEnter, onMouseLeave: handleLeave });
          }
          return window.React.createElement('span', Object.assign({}, props, { ref: setRefs, onMouseEnter: handleEnter, onMouseLeave: handleLeave }));
        });

        export const Portal = (props) => props.children;

        export const Content = window.React.forwardRef((props, ref) => {
          const ctx = window.React.useContext(TooltipContext);
          const [pos, setPos] = window.React.useState({ top: 0, left: 0 });
          window.React.useEffect(() => {
            if (ctx && ctx.open && ctx.triggerRef.current) {
              const rect = ctx.triggerRef.current.getBoundingClientRect();
              setPos({ top: rect.top + window.scrollY - 36, left: rect.left + window.scrollX });
            }
          }, [ctx && ctx.open]);
          if (!ctx || !ctx.open) return null;
          return window.React.createElement('div', Object.assign({}, props, {
            ref: ref, role: 'tooltip',
            style: Object.assign({ position: 'absolute', top: pos.top + 'px', left: pos.left + 'px', zIndex: 50, pointerEvents: 'none' }, props.style),
          }));
        });

        export const Arrow = () => null;
      `,
      '@radix-ui/react-select': `
        import { useControllableState, useClickOutside } from '__waktiRadixCore';

        const SelectContext = window.React.createContext(null);

        export const Root = (props) => {
          const [value, setValue] = useControllableState(props.value, props.defaultValue || '', props.onValueChange);
          const [open, setOpen] = window.React.useState(false);
          const triggerRef = window.React.useRef(null);
          const itemLabelsRef = window.React.useRef({});
          return window.React.createElement(SelectContext.Provider, { value: { value: value, setValue: setValue, open: open, setOpen: setOpen, triggerRef: triggerRef, itemLabelsRef: itemLabelsRef } }, props.children);
        };

        export const Trigger = window.React.forwardRef((props, ref) => {
          const ctx = window.React.useContext(SelectContext);
          const setRefs = (node) => {
            if (ctx) ctx.triggerRef.current = node;
            if (typeof ref === 'function') ref(node); else if (ref) ref.current = node;
          };
          const handleClick = (e) => { if (ctx) ctx.setOpen(!ctx.open); if (props.onClick) props.onClick(e); };
          return window.React.createElement('button', Object.assign({}, props, { ref: setRefs, onClick: handleClick, type: 'button' }));
        });

        export const Value = (props) => {
          const ctx = window.React.useContext(SelectContext);
          const label = ctx && ctx.itemLabelsRef.current[ctx.value];
          return window.React.createElement('span', null, label || props.placeholder || (ctx && ctx.value) || '');
        };

        export const Icon = (props) => window.React.createElement('span', null, props.children);
        export const Portal = (props) => props.children;

        export const Content = window.React.forwardRef((props, ref) => {
          const ctx = window.React.useContext(SelectContext);
          const localRef = window.React.useRef(null);
          const [pos, setPos] = window.React.useState({ top: 0, left: 0, width: 0 });
          useClickOutside(localRef, () => { if (ctx) ctx.setOpen(false); }, !!(ctx && ctx.open));
          window.React.useEffect(() => {
            if (ctx && ctx.open && ctx.triggerRef.current) {
              const rect = ctx.triggerRef.current.getBoundingClientRect();
              setPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width });
            }
          }, [ctx && ctx.open]);
          if (!ctx || !ctx.open) return null;
          return window.React.createElement('div', Object.assign({}, props, {
            ref: (node) => { localRef.current = node; if (typeof ref === 'function') ref(node); else if (ref) ref.current = node; },
            style: Object.assign({ position: 'absolute', top: pos.top + 'px', left: pos.left + 'px', minWidth: pos.width + 'px', zIndex: 50 }, props.style),
          }));
        });

        export const Viewport = (props) => window.React.createElement('div', null, props.children);
        export const Group = (props) => window.React.createElement('div', { role: 'group' }, props.children);
        export const Label = (props) => window.React.createElement('div', props);
        export const Separator = (props) => window.React.createElement('div', Object.assign({}, props, { style: Object.assign({ height: 1, background: 'currentColor', opacity: 0.15, margin: '4px 0' }, props.style) }));

        export const Item = window.React.forwardRef((props, ref) => {
          const ctx = window.React.useContext(SelectContext);
          window.React.useEffect(() => {
            if (ctx && props.value !== undefined) {
              const text = props.textValue || (typeof props.children === 'string' ? props.children : props.value);
              ctx.itemLabelsRef.current[props.value] = text;
            }
          }, [props.value, props.textValue]);
          const handleClick = (e) => {
            if (props.disabled) return;
            if (ctx) { ctx.setValue(props.value); ctx.setOpen(false); }
            if (props.onClick) props.onClick(e);
          };
          return window.React.createElement('div', Object.assign({}, props, { ref: ref, role: 'option', onClick: handleClick, 'aria-selected': !!(ctx && ctx.value === props.value), style: Object.assign({ cursor: props.disabled ? 'default' : 'pointer' }, props.style) }));
        });

        export const ItemText = (props) => window.React.createElement('span', null, props.children);
        export const ItemIndicator = (props) => window.React.createElement(window.React.Fragment, null, props.children);
        export const ScrollUpButton = () => null;
        export const ScrollDownButton = () => null;
      `,
      '@radix-ui/react-tabs': `
        import { useControllableState } from '__waktiRadixCore';

        const TabsContext = window.React.createContext(null);

        export const Root = (props) => {
          const [value, setValue] = useControllableState(props.value, props.defaultValue || '', props.onValueChange);
          return window.React.createElement('div', { className: props.className, style: props.style, dir: props.dir },
            window.React.createElement(TabsContext.Provider, { value: { value: value, setValue: setValue } }, props.children)
          );
        };

        export const List = window.React.forwardRef((props, ref) => window.React.createElement('div', Object.assign({}, props, { ref: ref, role: 'tablist' })));

        export const Trigger = window.React.forwardRef((props, ref) => {
          const ctx = window.React.useContext(TabsContext);
          const active = !!(ctx && ctx.value === props.value);
          const handleClick = (e) => { if (!props.disabled && ctx) ctx.setValue(props.value); if (props.onClick) props.onClick(e); };
          return window.React.createElement('button', Object.assign({}, props, {
            ref: ref, type: 'button', role: 'tab', 'aria-selected': active, 'data-state': active ? 'active' : 'inactive',
            onClick: handleClick,
          }));
        });

        export const Content = window.React.forwardRef((props, ref) => {
          const ctx = window.React.useContext(TabsContext);
          if (!ctx || ctx.value !== props.value) return null;
          return window.React.createElement('div', Object.assign({}, props, { ref: ref, role: 'tabpanel' }));
        });
      `,
      '@radix-ui/react-checkbox': `
        import { useControllableState } from '__waktiRadixCore';

        const CheckboxContext = window.React.createContext(false);

        export const Root = window.React.forwardRef((props, ref) => {
          const [checked, setChecked] = useControllableState(props.checked, !!props.defaultChecked, props.onCheckedChange);
          const handleClick = (e) => {
            if (props.disabled) return;
            const next = checked === 'indeterminate' ? true : !checked;
            setChecked(next);
            if (props.onClick) props.onClick(e);
          };
          return window.React.createElement('button', Object.assign({}, props, {
            ref: ref, type: 'button', role: 'checkbox', 'aria-checked': checked === 'indeterminate' ? 'mixed' : !!checked,
            'data-state': checked === 'indeterminate' ? 'indeterminate' : (checked ? 'checked' : 'unchecked'),
            onClick: handleClick,
          }), window.React.createElement(CheckboxContext.Provider, { value: checked }, props.children));
        });

        export const Indicator = (props) => {
          const checked = window.React.useContext(CheckboxContext);
          if (!checked) return null;
          return window.React.createElement('span', props, props.children);
        };
      `,
      '@radix-ui/react-switch': `
        import { useControllableState } from '__waktiRadixCore';

        export const Root = window.React.forwardRef((props, ref) => {
          const [checked, setChecked] = useControllableState(props.checked, !!props.defaultChecked, props.onCheckedChange);
          const handleClick = (e) => {
            if (props.disabled) return;
            setChecked(!checked);
            if (props.onClick) props.onClick(e);
          };
          return window.React.createElement('button', Object.assign({}, props, {
            ref: ref, type: 'button', role: 'switch', 'aria-checked': !!checked,
            'data-state': checked ? 'checked' : 'unchecked',
            onClick: handleClick,
          }), props.children);
        });

        export const Thumb = (props) => window.React.createElement('span', props);
      `,
      '@radix-ui/react-slider': `
        import { useControllableState } from '__waktiRadixCore';

        export const Root = window.React.forwardRef((props, ref) => {
          const [value, setValue] = useControllableState(
            props.value ? props.value[0] : undefined,
            props.defaultValue ? props.defaultValue[0] : (props.min || 0),
            (v) => { if (props.onValueChange) props.onValueChange([v]); }
          );
          const min = props.min != null ? props.min : 0;
          const max = props.max != null ? props.max : 100;
          const step = props.step != null ? props.step : 1;
          const handleChange = (e) => {
            const v = Number(e.target.value);
            setValue(v);
            if (props.onValueCommit) props.onValueCommit([v]);
          };
          return window.React.createElement('div', { className: props.className, style: Object.assign({ position: 'relative', display: 'flex', alignItems: 'center' }, props.style) },
            window.React.createElement('input', {
              ref: ref, type: 'range', min: min, max: max, step: step, value: value,
              disabled: props.disabled, onChange: handleChange,
              style: { width: '100%' },
            })
          );
        });

        export const Track = (props) => window.React.createElement('div', props, props.children);
        export const Range = (props) => window.React.createElement('div', props);
        export const Thumb = (props) => window.React.createElement('div', props);
      `,
      '@radix-ui/react-progress': `
        const ProgressContext = window.React.createContext(null);

        export const Root = window.React.forwardRef((props, ref) => {
          const value = props.value != null ? props.value : 0;
          const max = props.max != null ? props.max : 100;
          return window.React.createElement('div', Object.assign({}, props, {
            ref: ref, role: 'progressbar', 'aria-valuenow': value, 'aria-valuemax': max,
          }), window.React.createElement(ProgressContext.Provider, { value: { value: value, max: max } }, props.children));
        });

        export const Indicator = (props) => {
          const ctx = window.React.useContext(ProgressContext);
          const pct = ctx && ctx.max ? (ctx.value / ctx.max) * 100 : 0;
          return window.React.createElement('div', Object.assign({}, props, {
            style: Object.assign({ transform: 'translateX(-' + (100 - pct) + '%)', transition: 'transform 0.3s ease' }, props.style),
          }));
        };
      `,
      '@radix-ui/react-avatar': `
        export const Root = (props) => window.React.createElement('span', Object.assign({}, props, { style: Object.assign({ display: 'inline-flex', overflow: 'hidden', borderRadius: '50%' }, props.style) }));

        export const Image = window.React.forwardRef((props, ref) => {
          const [errored, setErrored] = window.React.useState(false);
          if (errored) return null;
          return window.React.createElement('img', Object.assign({}, props, {
            ref: ref, onError: (e) => { setErrored(true); if (props.onError) props.onError(e); },
            style: Object.assign({ width: '100%', height: '100%', objectFit: 'cover' }, props.style),
          }));
        });

        export const Fallback = (props) => window.React.createElement('span', props, props.children);
      `,
      '@radix-ui/react-accordion': `
        import { useControllableState } from '__waktiRadixCore';

        const AccordionContext = window.React.createContext(null);
        const AccordionItemContext = window.React.createContext(null);

        export const Root = (props) => {
          const isMultiple = props.type === 'multiple';
          const [value, setValue] = useControllableState(props.value, props.defaultValue || (isMultiple ? [] : ''), props.onValueChange);
          const toggle = (itemValue) => {
            if (isMultiple) {
              const arr = Array.isArray(value) ? value : [];
              setValue(arr.indexOf(itemValue) === -1 ? arr.concat([itemValue]) : arr.filter((v) => v !== itemValue));
            } else {
              setValue(value === itemValue ? (props.collapsible ? '' : value) : itemValue);
            }
          };
          const isOpen = (itemValue) => isMultiple ? (Array.isArray(value) && value.indexOf(itemValue) !== -1) : value === itemValue;
          return window.React.createElement('div', { className: props.className, style: props.style },
            window.React.createElement(AccordionContext.Provider, { value: { toggle: toggle, isOpen: isOpen } }, props.children)
          );
        };

        export const Item = (props) => window.React.createElement(AccordionItemContext.Provider, { value: props.value },
          window.React.createElement('div', { className: props.className, style: props.style, 'data-disabled': props.disabled }, props.children)
        );

        export const Header = (props) => window.React.createElement('div', props, props.children);

        export const Trigger = window.React.forwardRef((props, ref) => {
          const accordionCtx = window.React.useContext(AccordionContext);
          const itemValue = window.React.useContext(AccordionItemContext);
          const open = !!(accordionCtx && accordionCtx.isOpen(itemValue));
          const handleClick = (e) => { if (accordionCtx) accordionCtx.toggle(itemValue); if (props.onClick) props.onClick(e); };
          return window.React.createElement('button', Object.assign({}, props, {
            ref: ref, type: 'button', 'data-state': open ? 'open' : 'closed', 'aria-expanded': open, onClick: handleClick,
          }));
        });

        export const Content = window.React.forwardRef((props, ref) => {
          const accordionCtx = window.React.useContext(AccordionContext);
          const itemValue = window.React.useContext(AccordionItemContext);
          const open = accordionCtx && accordionCtx.isOpen(itemValue);
          if (!open) return null;
          return window.React.createElement('div', Object.assign({}, props, { ref: ref, 'data-state': 'open' }));
        });
      `,
      'react-modal': `
        import { useEscapeKey } from '__waktiRadixCore';

        function ReactModal(props) {
          useEscapeKey(() => { if (props.onRequestClose) props.onRequestClose(); }, !!(props.isOpen && props.shouldCloseOnEsc !== false));
          if (!props.isOpen) return null;
          const overlayStyle = Object.assign({
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }, props.style && props.style.overlay);
          const contentStyle = Object.assign({
            position: 'relative', background: '#fff', borderRadius: '8px', padding: '20px', maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto',
          }, props.style && props.style.content);
          const handleOverlayClick = (e) => {
            if (e.target === e.currentTarget && props.shouldCloseOnOverlayClick !== false && props.onRequestClose) props.onRequestClose();
          };
          return window.React.createElement('div', { className: props.overlayClassName, style: overlayStyle, onClick: handleOverlayClick },
            window.React.createElement('div', { className: props.className, style: contentStyle, role: 'dialog', 'aria-label': props.contentLabel },
              props.children
            )
          );
        }
        ReactModal.setAppElement = function() {};
        ReactModal.defaultStyles = { overlay: {}, content: {} };
        export default ReactModal;
      `,
      'react-select': `
        import { useClickOutside } from '__waktiRadixCore';

        function Select(props) {
          const [open, setOpen] = window.React.useState(false);
          const [search, setSearch] = window.React.useState('');
          const containerRef = window.React.useRef(null);
          useClickOutside(containerRef, () => setOpen(false), open);

          const options = props.options || [];
          const isMulti = !!props.isMulti;
          const currentValue = props.value;

          const filtered = search
            ? options.filter((o) => String(o.label).toLowerCase().indexOf(search.toLowerCase()) !== -1)
            : options;

          const isSelected = (opt) => {
            if (isMulti) return Array.isArray(currentValue) && currentValue.some((v) => v && v.value === opt.value);
            return currentValue && currentValue.value === opt.value;
          };

          const selectOption = (opt) => {
            if (isMulti) {
              const arr = Array.isArray(currentValue) ? currentValue : [];
              const next = isSelected(opt) ? arr.filter((v) => v.value !== opt.value) : arr.concat([opt]);
              if (props.onChange) props.onChange(next);
            } else {
              if (props.onChange) props.onChange(opt);
              setOpen(false);
            }
            setSearch('');
          };

          const clearValue = (e) => {
            e.stopPropagation();
            if (props.onChange) props.onChange(isMulti ? [] : null);
          };

          const displayLabel = isMulti
            ? (Array.isArray(currentValue) && currentValue.length ? currentValue.map((v) => v.label).join(', ') : '')
            : (currentValue ? currentValue.label : '');

          return window.React.createElement('div', { ref: containerRef, className: props.className, style: { position: 'relative', minWidth: '160px' } },
            window.React.createElement('div', {
              onClick: () => setOpen(!open),
              style: { border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: '#fff' },
            },
              open && props.isSearchable !== false
                ? window.React.createElement('input', {
                    autoFocus: true, value: search, placeholder: displayLabel || props.placeholder || 'Select...',
                    onChange: (e) => setSearch(e.target.value),
                    style: { border: 'none', outline: 'none', width: '100%' },
                    onClick: (e) => e.stopPropagation(),
                  })
                : window.React.createElement('span', { style: { color: displayLabel ? 'inherit' : '#9ca3af' } }, displayLabel || props.placeholder || 'Select...'),
              window.React.createElement('span', { style: { display: 'flex', gap: '6px', alignItems: 'center' } },
                props.isClearable && displayLabel ? window.React.createElement('span', { onClick: clearValue, style: { cursor: 'pointer', opacity: 0.6 } }, '\\u00d7') : null,
                window.React.createElement('span', { style: { opacity: 0.5 } }, '\\u25be')
              )
            ),
            open ? window.React.createElement('div', {
              style: { position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', maxHeight: '220px', overflow: 'auto', zIndex: 50 },
            },
              filtered.length === 0
                ? window.React.createElement('div', { style: { padding: '8px 10px', color: '#9ca3af' } }, props.noOptionsMessage ? props.noOptionsMessage() : 'No options')
                : filtered.map((opt) => window.React.createElement('div', {
                    key: opt.value, onClick: () => selectOption(opt),
                    style: { padding: '8px 10px', cursor: 'pointer', background: isSelected(opt) ? '#f3f4f6' : 'transparent' },
                  }, opt.label))
            ) : null
          );
        }
        export default Select;
        export function createFilter() { return function() { return true; }; }
        export const components = {};
      `,
      '@dnd-kit/utilities': `
        export const CSS = {
          Transform: {
            toString: function(transform) {
              if (!transform) return undefined;
              const parts = [];
              if (transform.x != null || transform.y != null) parts.push('translate3d(' + (transform.x || 0) + 'px, ' + (transform.y || 0) + 'px, 0)');
              if (transform.scaleX != null || transform.scaleY != null) parts.push('scaleX(' + (transform.scaleX != null ? transform.scaleX : 1) + ') scaleY(' + (transform.scaleY != null ? transform.scaleY : 1) + ')');
              return parts.join(' ');
            },
          },
          Transition: {
            toString: function(transition) {
              if (!transition) return undefined;
              return (transition.property || 'transform') + ' ' + (transition.duration || 250) + 'ms ' + (transition.easing || 'ease');
            },
          },
        };
      `,
      '@dnd-kit/core': `
        const DndContext_ = window.React.createContext(null);

        export function DndContext(props) {
          const [active, setActive] = window.React.useState(null);
          const [activeDelta, setActiveDelta] = window.React.useState({ x: 0, y: 0 });
          const dropZonesRef = window.React.useRef({});
          const dragStateRef = window.React.useRef(null);

          const registerDropZone = (id, node, data) => { dropZonesRef.current[id] = { id: id, node: node, data: data }; };
          const unregisterDropZone = (id) => { delete dropZonesRef.current[id]; };

          const findOverZone = (clientX, clientY) => {
            const zones = Object.values(dropZonesRef.current);
            for (const zone of zones) {
              if (!zone.node) continue;
              const rect = zone.node.getBoundingClientRect();
              if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) return zone;
            }
            return null;
          };

          const startDrag = (id, data, event) => {
            const point = event.touches ? event.touches[0] : event;
            dragStateRef.current = { id: id, data: data, startX: point.clientX, startY: point.clientY };
            setActive({ id: id, data: data });
            setActiveDelta({ x: 0, y: 0 });
            if (props.onDragStart) props.onDragStart({ active: { id: id, data: { current: data } } });

            const handleMove = (moveEvent) => {
              const movePoint = moveEvent.touches ? moveEvent.touches[0] : moveEvent;
              const dx = movePoint.clientX - dragStateRef.current.startX;
              const dy = movePoint.clientY - dragStateRef.current.startY;
              dragStateRef.current.delta = { x: dx, y: dy };
              setActiveDelta({ x: dx, y: dy });
              const overZone = findOverZone(movePoint.clientX, movePoint.clientY);
              if (props.onDragOver) props.onDragOver({ active: { id: id, data: { current: data } }, over: overZone ? { id: overZone.id, data: { current: overZone.data } } : null });
            };

            const handleUp = (upEvent) => {
              const upPoint = upEvent.changedTouches ? upEvent.changedTouches[0] : upEvent;
              const overZone = findOverZone(upPoint.clientX, upPoint.clientY);
              const delta = dragStateRef.current ? (dragStateRef.current.delta || { x: 0, y: 0 }) : { x: 0, y: 0 };
              if (props.onDragEnd) {
                props.onDragEnd({
                  active: { id: id, data: { current: data } },
                  over: overZone ? { id: overZone.id, data: { current: overZone.data } } : null,
                  delta: delta,
                });
              }
              setActive(null);
              setActiveDelta({ x: 0, y: 0 });
              dragStateRef.current = null;
              document.removeEventListener('mousemove', handleMove);
              document.removeEventListener('mouseup', handleUp);
              document.removeEventListener('touchmove', handleMove);
              document.removeEventListener('touchend', handleUp);
            };

            document.addEventListener('mousemove', handleMove);
            document.addEventListener('mouseup', handleUp);
            document.addEventListener('touchmove', handleMove, { passive: false });
            document.addEventListener('touchend', handleUp);
          };

          const ctxValue = { active: active, activeDelta: activeDelta, startDrag: startDrag, registerDropZone: registerDropZone, unregisterDropZone: unregisterDropZone };
          return window.React.createElement(DndContext_.Provider, { value: ctxValue }, props.children);
        }

        export function useDraggable(options) {
          const ctx = window.React.useContext(DndContext_);
          const isDragging = !!(ctx && ctx.active && ctx.active.id === options.id);
          const handlePointerDown = (e) => { if (ctx) ctx.startDrag(options.id, options.data, e); };
          return {
            attributes: { role: 'button', tabIndex: 0 },
            listeners: { onMouseDown: handlePointerDown, onTouchStart: handlePointerDown },
            setNodeRef: function() {},
            transform: isDragging ? ctx.activeDelta : null,
            isDragging: isDragging,
          };
        }

        export function useDroppable(options) {
          const ctx = window.React.useContext(DndContext_);
          const nodeRef = window.React.useRef(null);
          const setNodeRef = (node) => {
            nodeRef.current = node;
            if (ctx) ctx.registerDropZone(options.id, node, options.data);
          };
          window.React.useEffect(() => {
            return () => { if (ctx) ctx.unregisterDropZone(options.id); };
          }, []);
          const isOver = !!(ctx && ctx.active);
          return { setNodeRef: setNodeRef, isOver: isOver };
        }

        export function DragOverlay(props) { return props.children || null; }

        export const PointerSensor = function() {};
        export const MouseSensor = function() {};
        export const TouchSensor = function() {};
        export function useSensor(sensor, options) { return { sensor: sensor, options: options }; }
        export function useSensors() { return Array.prototype.slice.call(arguments); }
        export const closestCenter = function() { return []; };
        export const closestCorners = function() { return []; };
      `,
      '@dnd-kit/sortable': `
        import { CSS } from '@dnd-kit/utilities';

        export function arrayMove(array, from, to) {
          const result = array.slice();
          const removed = result.splice(from, 1)[0];
          result.splice(to, 0, removed);
          return result;
        }

        const SortableContext_ = window.React.createContext(null);

        export function SortableContext(props) {
          return window.React.createElement(SortableContext_.Provider, { value: { items: props.items || [] } }, props.children);
        }

        export function useSortable(options) {
          const ctx = window.React.useContext(SortableContext_);
          const nodeRef = window.React.useRef(null);
          const items = (ctx && ctx.items) || [];
          const index = items.indexOf(options.id);
          return {
            attributes: { role: 'button', tabIndex: 0 },
            listeners: { onMouseDown: function() {}, onTouchStart: function() {} },
            setNodeRef: function(node) { nodeRef.current = node; },
            transform: null,
            transition: 'transform 200ms ease',
            isDragging: false,
            index: index,
          };
        }

        export const verticalListSortingStrategy = function() { return null; };
        export const horizontalListSortingStrategy = function() { return null; };
        export const rectSortingStrategy = function() { return null; };
        export { CSS };
      `,
      'react-slick': `
        function Slider(props) {
          const [index, setIndex] = window.React.useState(0);
          const children = window.React.Children.toArray(props.children);
          const count = children.length;
          const slidesToShow = props.slidesToShow || 1;
          const autoplay = props.autoplay;
          const autoplaySpeed = props.autoplaySpeed || 3000;

          window.React.useEffect(() => {
            if (!autoplay || count <= slidesToShow) return undefined;
            const timer = setInterval(() => { setIndex((i) => (i + 1) % count); }, autoplaySpeed);
            return () => clearInterval(timer);
          }, [autoplay, autoplaySpeed, count, slidesToShow]);

          const goTo = (i) => setIndex(((i % count) + count) % count);
          const next = () => goTo(index + 1);
          const prev = () => goTo(index - 1);

          return window.React.createElement('div', { className: props.className, style: { position: 'relative', overflow: 'hidden' } },
            window.React.createElement('div', {
              style: { display: 'flex', transform: 'translateX(-' + (index * (100 / slidesToShow)) + '%)', transition: 'transform 0.4s ease' },
            }, children.map((child, i) => window.React.createElement('div', { key: i, style: { flex: '0 0 ' + (100 / slidesToShow) + '%' } }, child))),
            props.arrows !== false ? window.React.createElement(window.React.Fragment, null,
              window.React.createElement('button', { type: 'button', onClick: prev, style: { position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', zIndex: 2, background: 'rgba(0,0,0,0.4)', color: '#fff', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' } }, '\\u2039'),
              window.React.createElement('button', { type: 'button', onClick: next, style: { position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', zIndex: 2, background: 'rgba(0,0,0,0.4)', color: '#fff', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' } }, '\\u203a')
            ) : null,
            props.dots ? window.React.createElement('div', { style: { display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '8px' } },
              children.map((_, i) => window.React.createElement('span', {
                key: i, onClick: () => goTo(i),
                style: { width: '8px', height: '8px', borderRadius: '50%', background: i === index ? '#333' : '#ccc', cursor: 'pointer' },
              }))
            ) : null
          );
        }
        export default Slider;
      `,
      'embla-carousel-react': `
        function useEmblaCarousel(options, plugins) {
          options = options || {};
          const viewportRef = window.React.useRef(null);
          const [selectedIndex, setSelectedIndex] = window.React.useState(0);
          const [, setSlideCount] = window.React.useState(0);
          const listenersRef = window.React.useRef({});

          const emit = (event) => { (listenersRef.current[event] || []).forEach(function(cb) { cb(api); }); };

          const measureSlides = () => {
            const viewport = viewportRef.current;
            if (!viewport) return 0;
            const container = viewport.firstElementChild;
            return container ? container.children.length : 0;
          };

          const scrollTo = (index) => {
            const count = measureSlides();
            if (count === 0) return;
            const next = ((index % count) + count) % count;
            setSelectedIndex(next);
            const viewport = viewportRef.current;
            if (viewport) {
              const container = viewport.firstElementChild;
              const slide = container && container.children[next];
              if (slide) viewport.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
            }
            emit('select');
          };

          const api = {
            scrollNext: () => scrollTo(selectedIndex + 1),
            scrollPrev: () => scrollTo(selectedIndex - 1),
            scrollTo: scrollTo,
            selectedScrollSnap: () => selectedIndex,
            scrollSnapList: () => { const c = measureSlides(); return Array.from({ length: c }, (_, i) => i); },
            canScrollNext: () => true,
            canScrollPrev: () => true,
            on: (event, cb) => { listenersRef.current[event] = (listenersRef.current[event] || []).concat([cb]); return api; },
            off: (event, cb) => { listenersRef.current[event] = (listenersRef.current[event] || []).filter((fn) => fn !== cb); return api; },
            reInit: () => { setSlideCount(measureSlides()); },
          };

          window.React.useEffect(() => {
            setSlideCount(measureSlides());
            const activePlugins = (plugins || []).map(function(p) { if (p && p.init) p.init(api); return p; });
            return function() { activePlugins.forEach(function(p) { if (p && p.destroy) p.destroy(); }); };
          }, []);

          return [viewportRef, api];
        }
        export default useEmblaCarousel;
        export { useEmblaCarousel };
      `,
      'embla-carousel-autoplay': `
        function Autoplay(options) {
          options = options || {};
          const plugin = {
            name: 'autoplay',
            options: options,
            _timer: null,
            init: function(embla) {
              const delay = options.delay || 4000;
              plugin._timer = setInterval(function() { embla.scrollNext(); }, delay);
            },
            destroy: function() { if (plugin._timer) clearInterval(plugin._timer); },
          };
          return plugin;
        }
        export default Autoplay;
      `,
      '@react-spring/web': `
        function useSpring(config) {
          config = typeof config === 'function' ? config() : (config || {});
          const to = config.to || config;
          const from = config.from || {};
          const [style, setStyle] = window.React.useState(Object.assign({}, from, to));
          window.React.useEffect(() => {
            const raf = window.requestAnimationFrame(() => setStyle(Object.assign({}, from, to)));
            return () => window.cancelAnimationFrame(raf);
          }, [JSON.stringify(to)]);
          const result = Object.assign({}, style);
          result.__waktiSpringConfig = config;
          return result;
        }

        function useSprings(count, configFn) {
          const results = [];
          for (let i = 0; i < count; i++) results.push(useSpring(typeof configFn === 'function' ? configFn(i) : configFn[i]));
          return results;
        }

        function useTransition(items, config) {
          return (items || []).map(function(item, i) { return [Object.assign({}, config && config.enter), item, i]; });
        }

        const animated = new Proxy({}, {
          get: function(_, tag) {
            return window.React.forwardRef(function(props, ref) {
              const style = Object.assign({}, props.style);
              const springConfig = style.__waktiSpringConfig;
              delete style.__waktiSpringConfig;
              const duration = (springConfig && springConfig.config && springConfig.config.duration) || 400;
              style.transition = style.transition || ('all ' + duration + 'ms ease');
              const rest = Object.assign({}, props, { style: style, ref: ref });
              return window.React.createElement(String(tag) || 'div', rest);
            });
          },
        });

        export { useSpring, useSprings, useTransition, animated };
        export const config = { default: { tension: 170, friction: 26 }, gentle: { tension: 120, friction: 14 }, wobbly: { tension: 180, friction: 12 }, stiff: { tension: 210, friction: 20 }, slow: { tension: 280, friction: 60 }, molasses: { tension: 280, friction: 120 } };
      `,
      'react-circular-progressbar': `
        function CircularProgressbar(props) {
          const value = props.value != null ? props.value : 0;
          const maxValue = props.maxValue != null ? props.maxValue : 100;
          const minValue = props.minValue != null ? props.minValue : 0;
          const pct = Math.max(0, Math.min(1, (value - minValue) / ((maxValue - minValue) || 1)));
          const radius = 40;
          const circumference = 2 * Math.PI * radius;
          const dashOffset = circumference * (1 - pct);
          const strokeWidth = props.strokeWidth || 8;
          const pathColor = (props.styles && props.styles.path && props.styles.path.stroke) || '#3b82f6';
          const trailColor = (props.styles && props.styles.trail && props.styles.trail.stroke) || '#e5e7eb';
          const textColor = (props.styles && props.styles.text && props.styles.text.fill) || '#111827';

          return window.React.createElement('svg', { viewBox: '0 0 100 100', className: props.className, style: { width: '100%', height: '100%' } },
            window.React.createElement('circle', { cx: 50, cy: 50, r: radius, fill: 'none', stroke: trailColor, strokeWidth: strokeWidth }),
            window.React.createElement('circle', {
              cx: 50, cy: 50, r: radius, fill: 'none', stroke: pathColor, strokeWidth: strokeWidth,
              strokeDasharray: circumference, strokeDashoffset: dashOffset, strokeLinecap: props.strokeLinecap || 'round',
              transform: 'rotate(-90 50 50)', style: { transition: 'stroke-dashoffset 0.5s ease' },
            }),
            props.text ? window.React.createElement('text', { x: 50, y: 54, textAnchor: 'middle', fontSize: 20, fill: textColor }, props.text) : null
          );
        }
        export const CircularProgressbarWithChildren = function(props) {
          return window.React.createElement('div', { style: { position: 'relative', display: 'inline-block' } },
            window.React.createElement(CircularProgressbar, props),
            window.React.createElement('div', { style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, props.children)
          );
        };
        export const buildStyles = function(styles) { return styles || {}; };
        export default CircularProgressbar;
      `,
      'react-day-picker': `
        const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

        function isSameDay(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

        function DayPicker(props) {
          const [month, setMonth] = window.React.useState(props.month || props.defaultMonth || new Date());
          const selected = props.selected;

          const year = month.getFullYear();
          const monthIndex = month.getMonth();
          const firstDay = new Date(year, monthIndex, 1);
          const startOffset = firstDay.getDay();
          const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

          const cells = [];
          for (let i = 0; i < startOffset; i++) cells.push(null);
          for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, monthIndex, d));

          const goPrev = () => setMonth(new Date(year, monthIndex - 1, 1));
          const goNext = () => setMonth(new Date(year, monthIndex + 1, 1));

          const isSelected = (date) => {
            if (!date || !selected) return false;
            if (Array.isArray(selected)) return selected.some((d) => isSameDay(d, date));
            if (selected instanceof Date) return isSameDay(selected, date);
            if (selected.from) return date >= selected.from && date <= (selected.to || selected.from);
            return false;
          };

          const handleSelect = (date) => {
            if (props.onSelect) props.onSelect(date);
            if (props.onDayClick) props.onDayClick(date);
          };

          return window.React.createElement('div', { className: props.className, style: { fontFamily: 'Inter, system-ui, sans-serif' } },
            window.React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' } },
              window.React.createElement('button', { type: 'button', onClick: goPrev, style: { border: 'none', background: 'transparent', cursor: 'pointer' } }, '\\u2039'),
              window.React.createElement('span', { style: { fontWeight: 600 } }, MONTH_NAMES[monthIndex] + ' ' + year),
              window.React.createElement('button', { type: 'button', onClick: goNext, style: { border: 'none', background: 'transparent', cursor: 'pointer' } }, '\\u203a')
            ),
            window.React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center', fontSize: '12px', opacity: 0.6, marginBottom: '4px' } },
              DAY_LABELS.map((label, i) => window.React.createElement('div', { key: i }, label))
            ),
            window.React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' } },
              cells.map((date, i) => date ? window.React.createElement('button', {
                key: i, type: 'button', onClick: () => handleSelect(date),
                style: {
                  padding: '6px 0', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px',
                  background: isSelected(date) ? '#3b82f6' : 'transparent',
                  color: isSelected(date) ? '#fff' : 'inherit',
                },
              }, date.getDate()) : window.React.createElement('div', { key: i }))
            )
          );
        }
        export { DayPicker };
        export default DayPicker;
      `,
      'react-colorful': `
        function hexToHsv(hex) {
          hex = (hex || '#000000').replace('#', '');
          if (hex.length === 3) hex = hex.split('').map(function(c) { return c + c; }).join('');
          const r = parseInt(hex.substring(0, 2), 16) / 255;
          const g = parseInt(hex.substring(2, 4), 16) / 255;
          const b = parseInt(hex.substring(4, 6), 16) / 255;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const d = max - min;
          let h = 0;
          if (d !== 0) {
            if (max === r) h = ((g - b) / d) % 6;
            else if (max === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
          }
          h = Math.round(h * 60);
          if (h < 0) h += 360;
          const s = max === 0 ? 0 : d / max;
          const v = max;
          return { h: h, s: s, v: v };
        }

        function hsvToHex(h, s, v) {
          const c = v * s;
          const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
          const m = v - c;
          let r = 0, g = 0, b = 0;
          if (h < 60) { r = c; g = x; b = 0; }
          else if (h < 120) { r = x; g = c; b = 0; }
          else if (h < 180) { r = 0; g = c; b = x; }
          else if (h < 240) { r = 0; g = x; b = c; }
          else if (h < 300) { r = x; g = 0; b = c; }
          else { r = c; g = 0; b = x; }
          const toHex = function(n) { return Math.round((n + m) * 255).toString(16).padStart(2, '0'); };
          return '#' + toHex(r) + toHex(g) + toHex(b);
        }

        function ColorPicker(props) {
          const hsv = hexToHsv(props.color);
          const areaRef = window.React.useRef(null);

          const updateFromArea = (e) => {
            const rect = areaRef.current.getBoundingClientRect();
            const point = e.touches ? e.touches[0] : e;
            const x = Math.max(0, Math.min(1, (point.clientX - rect.left) / rect.width));
            const y = Math.max(0, Math.min(1, (point.clientY - rect.top) / rect.height));
            const nextHex = hsvToHex(hsv.h, x, 1 - y);
            if (props.onChange) props.onChange(nextHex);
          };

          const handleAreaDown = (e) => {
            updateFromArea(e);
            const move = (ev) => updateFromArea(ev);
            const up = () => {
              document.removeEventListener('mousemove', move);
              document.removeEventListener('mouseup', up);
              document.removeEventListener('touchmove', move);
              document.removeEventListener('touchend', up);
            };
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
            document.addEventListener('touchmove', move);
            document.addEventListener('touchend', up);
          };

          const handleHueChange = (e) => {
            const nextHex = hsvToHex(Number(e.target.value), hsv.s, hsv.v);
            if (props.onChange) props.onChange(nextHex);
          };

          return window.React.createElement('div', { className: props.className, style: { width: '200px' } },
            window.React.createElement('div', {
              ref: areaRef, onMouseDown: handleAreaDown, onTouchStart: handleAreaDown,
              style: {
                position: 'relative', width: '100%', height: '150px', borderRadius: '8px', cursor: 'crosshair',
                background: 'linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, hsl(' + hsv.h + ',100%,50%))',
              },
            },
              window.React.createElement('div', {
                style: {
                  position: 'absolute', width: '12px', height: '12px', borderRadius: '50%', border: '2px solid #fff',
                  boxShadow: '0 0 2px rgba(0,0,0,0.5)', transform: 'translate(-50%, -50%)',
                  left: (hsv.s * 100) + '%', top: ((1 - hsv.v) * 100) + '%', pointerEvents: 'none',
                },
              })
            ),
            window.React.createElement('input', {
              type: 'range', min: 0, max: 360, value: hsv.h, onChange: handleHueChange,
              style: { width: '100%', marginTop: '8px' },
            })
          );
        }
        export const HexColorPicker = ColorPicker;
        export const RgbColorPicker = ColorPicker;
        export const HslColorPicker = ColorPicker;
        export const HsvColorPicker = ColorPicker;
        export function HexColorInput(props) {
          return window.React.createElement('input', Object.assign({}, props, {
            value: props.color || '', onChange: function(e) { if (props.onChange) props.onChange(e.target.value); },
          }));
        }
      `,
      '@tanstack/react-table': `
        function makeRow(original, index, table) {
          return {
            id: String(index), index: index, original: original,
            getValue: function(colId) {
              const col = table._columns.find(function(c) { return (c.id || c.accessorKey) === colId; });
              if (!col) return undefined;
              return col.accessorFn ? col.accessorFn(original) : original[col.accessorKey];
            },
            getVisibleCells: function() {
              const row = this;
              return table._columns.map(function(col, ci) {
                return {
                  id: index + '_' + (col.id || col.accessorKey || ci),
                  column: { id: col.id || col.accessorKey, columnDef: col },
                  getContext: function() { return { row: row, column: col, getValue: function() { return row.getValue(col.id || col.accessorKey); } }; },
                  renderValue: function() { return col.accessorFn ? col.accessorFn(original) : original[col.accessorKey]; },
                };
              });
            },
          };
        }

        function useReactTable(options) {
          const [sorting, setSorting] = window.React.useState((options.state && options.state.sorting) || []);
          const [pagination, setPagination] = window.React.useState((options.state && options.state.pagination) || { pageIndex: 0, pageSize: 10 });

          const columns = options.columns || [];
          const data = options.data || [];

          const table = {
            _columns: columns,
            _coreRows: function() { return data.map(function(row, i) { return makeRow(row, i, table); }); },
            _sortedRows: function() {
              const rows = table._coreRows();
              if (!sorting.length) return rows;
              return rows.slice().sort(function(a, b) {
                for (const s of sorting) {
                  const av = a.getValue(s.id);
                  const bv = b.getValue(s.id);
                  if (av === bv) continue;
                  const cmp = av > bv ? 1 : -1;
                  return s.desc ? -cmp : cmp;
                }
                return 0;
              });
            },
            getHeaderGroups: function() {
              return [{
                id: 'header-group-0',
                headers: columns.map(function(col, i) {
                  const colId = col.id || col.accessorKey || String(i);
                  return {
                    id: colId,
                    column: {
                      id: colId,
                      columnDef: col,
                      getIsSorted: function() { const s = sorting.find(function(x) { return x.id === colId; }); return s ? (s.desc ? 'desc' : 'asc') : false; },
                      getToggleSortingHandler: function() {
                        return function() {
                          setSorting(function(prev) {
                            const existing = prev.find(function(x) { return x.id === colId; });
                            if (!existing) return [{ id: colId, desc: false }];
                            if (!existing.desc) return [{ id: colId, desc: true }];
                            return [];
                          });
                        };
                      },
                    },
                    getContext: function() { return { column: this.column, header: this }; },
                    isPlaceholder: false,
                  };
                }),
              }];
            },
            getRowModel: function() {
              const sorted = table._sortedRows();
              if (!options.getPaginationRowModel) return { rows: sorted };
              const start = pagination.pageIndex * pagination.pageSize;
              return { rows: sorted.slice(start, start + pagination.pageSize) };
            },
            getState: function() { return { sorting: sorting, pagination: pagination }; },
            setPageIndex: function(i) { setPagination(function(p) { return Object.assign({}, p, { pageIndex: i }); }); },
            nextPage: function() { setPagination(function(p) { return Object.assign({}, p, { pageIndex: p.pageIndex + 1 }); }); },
            previousPage: function() { setPagination(function(p) { return Object.assign({}, p, { pageIndex: Math.max(0, p.pageIndex - 1) }); }); },
            getCanNextPage: function() { return (pagination.pageIndex + 1) * pagination.pageSize < data.length; },
            getCanPreviousPage: function() { return pagination.pageIndex > 0; },
            getPageCount: function() { return Math.ceil(data.length / pagination.pageSize); },
          };
          return table;
        }

        export { useReactTable };
        export function getCoreRowModel() { return function() {}; }
        export function getSortedRowModel() { return function() {}; }
        export function getPaginationRowModel() { return function() {}; }
        export function getFilteredRowModel() { return function() {}; }
        export function flexRender(component, props) {
          if (typeof component === 'function') return component(props);
          return component;
        }
        export function createColumnHelper() {
          return {
            accessor: function(key, config) { return Object.assign({ accessorKey: key }, config); },
            display: function(config) { return config; },
          };
        }
      `,
      'react-window': `
        function FixedSizeList(props) {
          const containerRef = window.React.useRef(null);
          const [scrollTop, setScrollTop] = window.React.useState(0);
          const itemCount = props.itemCount || 0;
          const itemSize = props.itemSize || 35;
          const height = props.height || 300;
          const overscan = props.overscanCount || 3;

          const startIndex = Math.max(0, Math.floor(scrollTop / itemSize) - overscan);
          const visibleCount = Math.ceil(height / itemSize) + overscan * 2;
          const endIndex = Math.min(itemCount - 1, startIndex + visibleCount);

          const handleScroll = (e) => setScrollTop(e.target.scrollTop);

          const items = [];
          for (let i = startIndex; i <= endIndex; i++) {
            items.push(window.React.createElement('div', {
              key: i, style: { position: 'absolute', top: i * itemSize, left: 0, right: 0, height: itemSize },
            }, props.children({ index: i, style: { height: itemSize }, data: props.itemData })));
          }

          return window.React.createElement('div', {
            ref: containerRef, onScroll: handleScroll, className: props.className,
            style: { height: height, width: props.width || '100%', overflow: 'auto', position: 'relative' },
          },
            window.React.createElement('div', { style: { height: itemCount * itemSize, position: 'relative' } }, items)
          );
        }
        export { FixedSizeList };
        export const VariableSizeList = FixedSizeList;
        export const FixedSizeGrid = FixedSizeList;
        export const VariableSizeGrid = FixedSizeList;
      `,
      'react-virtualized': `
        import { FixedSizeList } from 'react-window';

        function List(props) {
          return window.React.createElement(FixedSizeList, {
            height: props.height, width: props.width, itemCount: props.rowCount, itemSize: props.rowHeight || 30,
            children: function(args) { return props.rowRenderer({ index: args.index, key: args.index, style: args.style }); },
          });
        }
        export { List };

        export function AutoSizer(props) {
          const ref = window.React.useRef(null);
          const [size, setSize] = window.React.useState({ width: 300, height: 300 });
          window.React.useEffect(() => {
            const el = ref.current;
            if (!el) return undefined;
            const update = () => setSize({ width: el.offsetWidth, height: el.offsetHeight });
            update();
            if (typeof window.ResizeObserver !== 'undefined') {
              const observer = new window.ResizeObserver(update);
              observer.observe(el);
              return () => observer.disconnect();
            }
            window.addEventListener('resize', update);
            return () => window.removeEventListener('resize', update);
          }, []);
          return window.React.createElement('div', { ref: ref, style: { width: '100%', height: '100%' } }, props.children(size));
        }
        export const Grid = List;
        export const Table = List;
        export const Column = function() { return null; };
      `,
      'react-player': `
        function getYouTubeId(url) {
          const match = String(url || '').match(/(?:youtube\\.com\\/(?:watch\\?v=|embed\\/|shorts\\/)|youtu\\.be\\/)([\\w-]{6,})/);
          return match ? match[1] : null;
        }
        function getVimeoId(url) {
          const match = String(url || '').match(/vimeo\\.com\\/(\\d+)/);
          return match ? match[1] : null;
        }

        function ReactPlayer(props) {
          const url = props.url;
          const width = props.width || '100%';
          const height = props.height || '360px';
          const youTubeId = getYouTubeId(url);
          const vimeoId = getVimeoId(url);

          if (youTubeId) {
            return window.React.createElement('iframe', {
              src: 'https://www.youtube.com/embed/' + youTubeId + (props.playing ? '?autoplay=1' : ''),
              width: width, height: height, style: { border: 'none' }, allow: 'autoplay; fullscreen',
              allowFullScreen: true,
            });
          }
          if (vimeoId) {
            return window.React.createElement('iframe', {
              src: 'https://player.vimeo.com/video/' + vimeoId + (props.playing ? '?autoplay=1' : ''),
              width: width, height: height, style: { border: 'none' }, allow: 'autoplay; fullscreen',
              allowFullScreen: true,
            });
          }
          const isAudio = /\\.(mp3|wav|ogg|m4a)($|\\?)/i.test(String(url || ''));
          return window.React.createElement(isAudio ? 'audio' : 'video', {
            src: url, controls: props.controls !== false, autoPlay: !!props.playing, loop: !!props.loop, muted: !!props.muted,
            width: isAudio ? undefined : width, height: isAudio ? undefined : height,
            onEnded: props.onEnded, onPlay: props.onPlay, onPause: props.onPause,
            style: { width: width, height: isAudio ? 'auto' : height },
          });
        }
        export default ReactPlayer;
      `,
      'react-markdown': `
        function escapeHtml(s) {
          return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        function renderInline(text) {
          let html = escapeHtml(text);
          html = html.replace(/\\!\\[([^\\]]*)\\]\\(([^)]+)\\)/g, '<img alt="$1" src="$2" style="max-width:100%" />');
          html = html.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
          html = html.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
          html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
          html = html.replace(/\\*([^*]+)\\*/g, '<em>$1</em>');
          html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
          html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
          html = html.replace(/\\x60([^\\x60]+)\\x60/g, '<code>$1</code>');
          return html;
        }

        function parseMarkdown(md) {
          const lines = String(md || '').replace(/\\r\\n/g, '\\n').split('\\n');
          const blocks = [];
          let i = 0;
          while (i < lines.length) {
            const line = lines[i];
            if (/^\\x60\\x60\\x60/.test(line)) {
              const lang = line.replace(/^\\x60\\x60\\x60/, '').trim();
              const codeLines = [];
              i++;
              while (i < lines.length && !/^\\x60\\x60\\x60/.test(lines[i])) { codeLines.push(lines[i]); i++; }
              i++;
              blocks.push({ type: 'code', lang: lang, content: codeLines.join('\\n') });
              continue;
            }
            if (/^\\|.+\\|$/.test(line.trim()) && lines[i + 1] && /^\\|?[\\s:-]+\\|[\\s:|-]+$/.test(lines[i + 1].trim())) {
              const headerCells = line.trim().replace(/^\\||\\|$/g, '').split('|').map(function(c) { return c.trim(); });
              i += 2;
              const rows = [];
              while (i < lines.length && /^\\|.+\\|$/.test(lines[i].trim())) {
                rows.push(lines[i].trim().replace(/^\\||\\|$/g, '').split('|').map(function(c) { return c.trim(); }));
                i++;
              }
              blocks.push({ type: 'table', header: headerCells, rows: rows });
              continue;
            }
            if (/^#{1,6}\\s/.test(line)) {
              const level = line.match(/^#{1,6}/)[0].length;
              blocks.push({ type: 'heading', level: level, text: line.replace(/^#{1,6}\\s/, '') });
              i++;
              continue;
            }
            if (/^>\\s?/.test(line)) {
              const quoteLines = [];
              while (i < lines.length && /^>\\s?/.test(lines[i])) { quoteLines.push(lines[i].replace(/^>\\s?/, '')); i++; }
              blocks.push({ type: 'blockquote', text: quoteLines.join(' ') });
              continue;
            }
            if (/^(-{3,}|\\*{3,})$/.test(line.trim())) {
              blocks.push({ type: 'hr' });
              i++;
              continue;
            }
            if (/^\\s*([-*+])\\s/.test(line)) {
              const items = [];
              while (i < lines.length && /^\\s*([-*+])\\s/.test(lines[i])) { items.push(lines[i].replace(/^\\s*([-*+])\\s/, '')); i++; }
              blocks.push({ type: 'ul', items: items });
              continue;
            }
            if (/^\\s*\\d+\\.\\s/.test(line)) {
              const items = [];
              while (i < lines.length && /^\\s*\\d+\\.\\s/.test(lines[i])) { items.push(lines[i].replace(/^\\s*\\d+\\.\\s/, '')); i++; }
              blocks.push({ type: 'ol', items: items });
              continue;
            }
            if (line.trim() === '') { i++; continue; }
            const paraLines = [];
            while (i < lines.length && lines[i].trim() !== '' && !/^#{1,6}\\s/.test(lines[i]) && !/^\\x60\\x60\\x60/.test(lines[i])) { paraLines.push(lines[i]); i++; }
            blocks.push({ type: 'p', text: paraLines.join(' ') });
          }
          return blocks;
        }

        function ReactMarkdown(props) {
          const blocks = parseMarkdown(props.children);
          const nodes = blocks.map(function(block, i) {
            if (block.type === 'heading') {
              const Tag = 'h' + block.level;
              return window.React.createElement(Tag, { key: i, dangerouslySetInnerHTML: { __html: renderInline(block.text) } });
            }
            if (block.type === 'code') {
              return window.React.createElement('pre', { key: i, style: { background: '#1e1e1e', color: '#d4d4d4', padding: '12px', borderRadius: '6px', overflow: 'auto' } },
                window.React.createElement('code', null, block.content)
              );
            }
            if (block.type === 'table') {
              return window.React.createElement('table', { key: i, style: { borderCollapse: 'collapse', width: '100%' } },
                window.React.createElement('thead', null, window.React.createElement('tr', null, block.header.map(function(h, j) {
                  return window.React.createElement('th', { key: j, style: { border: '1px solid #ccc', padding: '6px', textAlign: 'left' }, dangerouslySetInnerHTML: { __html: renderInline(h) } });
                }))),
                window.React.createElement('tbody', null, block.rows.map(function(row, ri) {
                  return window.React.createElement('tr', { key: ri }, row.map(function(cell, ci) {
                    return window.React.createElement('td', { key: ci, style: { border: '1px solid #ccc', padding: '6px' }, dangerouslySetInnerHTML: { __html: renderInline(cell) } });
                  }));
                }))
              );
            }
            if (block.type === 'blockquote') {
              return window.React.createElement('blockquote', { key: i, style: { borderLeft: '3px solid #ccc', paddingLeft: '12px', opacity: 0.85 }, dangerouslySetInnerHTML: { __html: renderInline(block.text) } });
            }
            if (block.type === 'hr') return window.React.createElement('hr', { key: i });
            if (block.type === 'ul') return window.React.createElement('ul', { key: i }, block.items.map(function(item, j) { return window.React.createElement('li', { key: j, dangerouslySetInnerHTML: { __html: renderInline(item) } }); }));
            if (block.type === 'ol') return window.React.createElement('ol', { key: i }, block.items.map(function(item, j) { return window.React.createElement('li', { key: j, dangerouslySetInnerHTML: { __html: renderInline(item) } }); }));
            return window.React.createElement('p', { key: i, dangerouslySetInnerHTML: { __html: renderInline(block.text) } });
          });
          return window.React.createElement('div', { className: props.className }, nodes);
        }
        export default ReactMarkdown;
      `,
      'remark-gfm': `
        export default function remarkGfm() { return function() {}; }
      `,
      'prismjs': `
        const Prism = {
          highlight: function(code) { return String(code); },
          highlightAll: function() {},
          highlightElement: function() {},
          languages: new Proxy({}, { get: function() { return {}; } }),
          plugins: {},
        };
        export default Prism;
      `,
      'react-syntax-highlighter': `
        function SyntaxHighlighter(props) {
          return window.React.createElement('pre', {
            className: props.className,
            style: Object.assign({ background: '#1e1e1e', color: '#d4d4d4', padding: '14px', borderRadius: '8px', overflow: 'auto', fontSize: '13px', lineHeight: 1.5 }, props.customStyle),
          }, window.React.createElement('code', null, props.children));
        }
        export default SyntaxHighlighter;
        export { SyntaxHighlighter as Prism };
        export { SyntaxHighlighter as Light };
      `,
      'leaflet': `
        function Icon(options) { return { options: options || {} }; }
        Icon.Default = function(options) { return new Icon(options); };
        function LatLng(lat, lng) { return { lat: lat, lng: lng }; }
        const L = {
          Icon: Icon,
          icon: function(options) { return new Icon(options); },
          latLng: LatLng,
          marker: function(latlng, options) { return { latlng: latlng, options: options || {} }; },
          map: function() { return { setView: function() { return this; }, on: function() { return this; }, remove: function() {} }; },
          tileLayer: function() { return { addTo: function() { return this; } }; },
        };
        export default L;
        export { Icon, LatLng };
      `,
      'react-leaflet': `
        const MapCenterContext = window.React.createContext(null);

        export function MapContainer(props) {
          const center = props.center || [0, 0];
          const zoom = props.zoom || 13;
          const markersRef = window.React.useRef([]);
          const [, forceUpdate] = window.React.useState(0);

          const registerMarker = (position) => {
            markersRef.current = markersRef.current.concat([position]);
            forceUpdate((n) => n + 1);
            return () => {
              markersRef.current = markersRef.current.filter((m) => m !== position);
              forceUpdate((n) => n + 1);
            };
          };

          const lat = center[0];
          const lng = center[1];
          const delta = 0.02 * (21 - zoom > 0 ? 21 - zoom : 1);
          const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join(',');
          const markerParams = markersRef.current.map((m) => '&marker=' + m[0] + ',' + m[1]).join('');
          const src = 'https://www.openstreetmap.org/export/embed.html?bbox=' + bbox + markerParams;

          return window.React.createElement(MapCenterContext.Provider, { value: { registerMarker: registerMarker } },
            window.React.createElement('div', { className: props.className, style: Object.assign({ position: 'relative' }, props.style) },
              window.React.createElement('iframe', { src: src, style: { width: '100%', height: '100%', border: 'none' }, title: 'Map' }),
              window.React.createElement('div', { style: { display: 'none' } }, props.children)
            )
          );
        }

        export function TileLayer() { return null; }

        export function Marker(props) {
          const ctx = window.React.useContext(MapCenterContext);
          window.React.useEffect(() => {
            if (ctx && ctx.registerMarker) return ctx.registerMarker(props.position);
            return undefined;
          }, [JSON.stringify(props.position)]);
          return window.React.createElement('div', { style: { display: 'none' } }, props.children);
        }

        export function Popup(props) { return window.React.createElement('div', { style: { display: 'none' } }, props.children); }
        export function useMap() { return { setView: function() { return this; }, flyTo: function() { return this; } }; }
        export function useMapEvents() { return null; }
        export function Circle() { return null; }
        export function Polygon() { return null; }
        export function Polyline() { return null; }
      `,
      '@react-pdf/renderer': `
        export function Document(props) {
          return window.React.createElement('div', { className: 'wakti-pdf-document', style: { background: '#fff', color: '#000' } }, props.children);
        }
        export function Page(props) {
          const size = props.size || 'A4';
          const sizes = { A4: { width: '210mm', minHeight: '297mm' }, LETTER: { width: '216mm', minHeight: '279mm' } };
          const dims = sizes[size] || sizes.A4;
          return window.React.createElement('div', {
            style: Object.assign({ width: dims.width, minHeight: dims.minHeight, padding: '20mm', margin: '0 auto 12px', background: '#fff', boxShadow: '0 0 8px rgba(0,0,0,0.15)', pageBreakAfter: 'always' }, props.style),
          }, props.children);
        }
        export function View(props) { return window.React.createElement('div', { style: props.style }, props.children); }
        export function Text(props) { return window.React.createElement('span', { style: Object.assign({ display: 'block' }, props.style) }, props.children); }
        export function Image(props) { return window.React.createElement('img', { src: props.src, style: props.style }); }
        export function Link(props) { return window.React.createElement('a', { href: props.src, style: props.style }, props.children); }
        export function Font() { return { register: function() {} }; }
        export const StyleSheet = { create: function(styles) { return styles; } };

        export function PDFDownloadLink(props) {
          const handleClick = (e) => {
            e.preventDefault();
            const printWindow = window.open('', '_blank');
            const content = document.createElement('div');
            const root = window.ReactDOM.createRoot(content);
            root.render(props.document);
            setTimeout(function() {
              printWindow.document.write('<html><head><title>' + (props.fileName || 'document') + '</title></head><body>' + content.innerHTML + '</body></html>');
              printWindow.document.close();
              printWindow.focus();
              printWindow.print();
            }, 100);
          };
          if (typeof props.children === 'function') {
            return window.React.createElement('span', { onClick: handleClick, style: { cursor: 'pointer' } }, props.children({ loading: false, error: null }));
          }
          return window.React.createElement('a', { href: '#', onClick: handleClick }, props.children || 'Download PDF');
        }

        export function PDFViewer(props) {
          return window.React.createElement('div', { style: Object.assign({ width: '100%', height: '600px', overflow: 'auto', border: '1px solid #ddd' }, props.style) }, props.children);
        }

        export function pdf() {
          return {
            toBlob: function() { return Promise.resolve(new Blob(['PDF generation requires the print dialog - use PDFDownloadLink instead.'], { type: 'text/plain' })); },
            toBuffer: function() { return Promise.resolve(new Uint8Array()); },
          };
        }
      `,
      'qrcode.react': `
        function buildQrUrl(value, size) {
          return 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&data=' + encodeURIComponent(String(value || ''));
        }
        export function QRCodeSVG(props) {
          const size = props.size || 128;
          return window.React.createElement('img', {
            src: buildQrUrl(props.value, size), width: size, height: size,
            style: Object.assign({ background: props.bgColor || '#fff' }, props.style), alt: 'QR code',
          });
        }
        export const QRCodeCanvas = QRCodeSVG;
        export default QRCodeSVG;
      `,
      'lodash': `
        function debounce(fn, wait) {
          wait = wait || 0;
          let timer = null;
          const debounced = function(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), wait);
          };
          debounced.cancel = function() { clearTimeout(timer); };
          return debounced;
        }

        function throttle(fn, wait) {
          wait = wait || 0;
          let last = 0;
          let timer = null;
          return function(...args) {
            const now = Date.now();
            const remaining = wait - (now - last);
            if (remaining <= 0) {
              last = now;
              fn.apply(this, args);
            } else {
              clearTimeout(timer);
              timer = setTimeout(() => { last = Date.now(); fn.apply(this, args); }, remaining);
            }
          };
        }

        function cloneDeep(value) {
          if (value === null || typeof value !== 'object') return value;
          if (Array.isArray(value)) return value.map(cloneDeep);
          if (value instanceof Date) return new Date(value.getTime());
          const result = {};
          Object.keys(value).forEach(function(key) { result[key] = cloneDeep(value[key]); });
          return result;
        }

        function isEqual(a, b) {
          if (a === b) return true;
          if (typeof a !== typeof b) return false;
          if (a && b && typeof a === 'object') {
            const aKeys = Object.keys(a);
            const bKeys = Object.keys(b);
            if (aKeys.length !== bKeys.length) return false;
            return aKeys.every(function(key) { return isEqual(a[key], b[key]); });
          }
          return false;
        }

        function get(obj, path, defaultValue) {
          const parts = Array.isArray(path) ? path : String(path).replace(/\\[(\\d+)\\]/g, '.$1').split('.');
          let current = obj;
          for (const part of parts) {
            if (current == null) return defaultValue;
            current = current[part];
          }
          return current === undefined ? defaultValue : current;
        }

        function set(obj, path, value) {
          const parts = Array.isArray(path) ? path : String(path).replace(/\\[(\\d+)\\]/g, '.$1').split('.');
          let current = obj;
          for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (current[part] == null || typeof current[part] !== 'object') current[part] = {};
            current = current[part];
          }
          current[parts[parts.length - 1]] = value;
          return obj;
        }

        function pick(obj, keys) {
          const result = {};
          (keys || []).forEach(function(key) { if (obj && Object.prototype.hasOwnProperty.call(obj, key)) result[key] = obj[key]; });
          return result;
        }

        function omit(obj, keys) {
          const result = Object.assign({}, obj);
          (keys || []).forEach(function(key) { delete result[key]; });
          return result;
        }

        function merge(target) {
          for (let i = 1; i < arguments.length; i++) {
            const source = arguments[i];
            if (!source) continue;
            Object.keys(source).forEach(function(key) {
              if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && target[key] && typeof target[key] === 'object') {
                merge(target[key], source[key]);
              } else {
                target[key] = source[key];
              }
            });
          }
          return target;
        }

        function groupBy(collection, iteratee) {
          const result = {};
          (collection || []).forEach(function(item) {
            const key = typeof iteratee === 'function' ? iteratee(item) : item[iteratee];
            if (!result[key]) result[key] = [];
            result[key].push(item);
          });
          return result;
        }

        function keyBy(collection, iteratee) {
          const result = {};
          (collection || []).forEach(function(item) {
            const key = typeof iteratee === 'function' ? iteratee(item) : item[iteratee];
            result[key] = item;
          });
          return result;
        }

        function sortBy(collection, iteratee) {
          const getVal = typeof iteratee === 'function' ? iteratee : function(item) { return item[iteratee]; };
          return (collection || []).slice().sort(function(a, b) {
            const av = getVal(a), bv = getVal(b);
            return av > bv ? 1 : av < bv ? -1 : 0;
          });
        }

        function orderBy(collection, iteratees, orders) {
          const keys = Array.isArray(iteratees) ? iteratees : [iteratees];
          const dirs = Array.isArray(orders) ? orders : [orders];
          return (collection || []).slice().sort(function(a, b) {
            for (let i = 0; i < keys.length; i++) {
              const key = keys[i];
              const getVal = typeof key === 'function' ? key : function(item) { return item[key]; };
              const av = getVal(a), bv = getVal(b);
              if (av === bv) continue;
              const cmp = av > bv ? 1 : -1;
              return (dirs[i] === 'desc') ? -cmp : cmp;
            }
            return 0;
          });
        }

        function uniq(array) { return Array.from(new Set(array || [])); }
        function uniqBy(array, iteratee) {
          const seen = new Set();
          const getVal = typeof iteratee === 'function' ? iteratee : function(item) { return item[iteratee]; };
          return (array || []).filter(function(item) {
            const key = getVal(item);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        }

        function chunk(array, size) {
          size = size || 1;
          const result = [];
          for (let i = 0; i < (array || []).length; i += size) result.push(array.slice(i, i + size));
          return result;
        }

        function flatten(array) { return [].concat(...(array || [])); }
        function flattenDeep(array) {
          return (array || []).reduce(function(acc, item) { return acc.concat(Array.isArray(item) ? flattenDeep(item) : item); }, []);
        }

        function isEmpty(value) {
          if (value == null) return true;
          if (Array.isArray(value) || typeof value === 'string') return value.length === 0;
          if (typeof value === 'object') return Object.keys(value).length === 0;
          return false;
        }

        function isObject(value) { return value !== null && typeof value === 'object'; }
        function isFunction(value) { return typeof value === 'function'; }
        function isString(value) { return typeof value === 'string'; }
        function isNumber(value) { return typeof value === 'number'; }
        function isNil(value) { return value === null || value === undefined; }

        function capitalize(str) { str = String(str || ''); return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase(); }
        function camelCase(str) {
          return String(str || '').replace(/[-_\\s]+(.)?/g, function(_, c) { return c ? c.toUpperCase() : ''; }).replace(/^./, function(c) { return c.toLowerCase(); });
        }
        function kebabCase(str) {
          return String(str || '').replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\\s_]+/g, '-').toLowerCase();
        }
        function snakeCase(str) {
          return String(str || '').replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[\\s-]+/g, '_').toLowerCase();
        }

        function range(start, end, step) {
          if (end === undefined) { end = start; start = 0; }
          step = step || 1;
          const result = [];
          for (let i = start; step > 0 ? i < end : i > end; i += step) result.push(i);
          return result;
        }

        function sum(array) { return (array || []).reduce(function(a, b) { return a + b; }, 0); }
        function sumBy(array, iteratee) {
          const getVal = typeof iteratee === 'function' ? iteratee : function(item) { return item[iteratee]; };
          return (array || []).reduce(function(a, item) { return a + getVal(item); }, 0);
        }
        function maxBy(array, iteratee) {
          const getVal = typeof iteratee === 'function' ? iteratee : function(item) { return item[iteratee]; };
          return (array || []).reduce(function(best, item) { return best === undefined || getVal(item) > getVal(best) ? item : best; }, undefined);
        }
        function minBy(array, iteratee) {
          const getVal = typeof iteratee === 'function' ? iteratee : function(item) { return item[iteratee]; };
          return (array || []).reduce(function(best, item) { return best === undefined || getVal(item) < getVal(best) ? item : best; }, undefined);
        }
        function max(array) { return (array || []).reduce(function(a, b) { return b > a ? b : a; }, (array || [])[0]); }
        function min(array) { return (array || []).reduce(function(a, b) { return b < a ? b : a; }, (array || [])[0]); }

        function shuffle(array) {
          const result = (array || []).slice();
          for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = result[i]; result[i] = result[j]; result[j] = tmp;
          }
          return result;
        }
        function sample(array) { return (array || [])[Math.floor(Math.random() * (array || []).length)]; }
        function compact(array) { return (array || []).filter(Boolean); }
        function difference(array, values) { return (array || []).filter(function(item) { return (values || []).indexOf(item) === -1; }); }
        function intersection(array, values) { return (array || []).filter(function(item) { return (values || []).indexOf(item) !== -1; }); }
        function union() { const sets = Array.prototype.slice.call(arguments); return uniq([].concat(...sets)); }
        function without(array) { const rest = Array.prototype.slice.call(arguments, 1); return (array || []).filter(function(item) { return rest.indexOf(item) === -1; }); }
        function clamp(value, lower, upper) { if (upper === undefined) { upper = lower; lower = undefined; } if (lower !== undefined) value = Math.max(value, lower); return Math.min(value, upper); }
        function random(lower, upper, floating) {
          if (upper === undefined) { upper = lower; lower = 0; }
          if (floating) return lower + Math.random() * (upper - lower);
          return Math.floor(lower + Math.random() * (upper - lower + 1));
        }
        function times(n, fn) { const result = []; for (let i = 0; i < n; i++) result.push(fn ? fn(i) : i); return result; }
        function noop() {}
        function identity(value) { return value; }

        const _ = {
          debounce: debounce, throttle: throttle, cloneDeep: cloneDeep, isEqual: isEqual, get: get, set: set, pick: pick, omit: omit, merge: merge, groupBy: groupBy, keyBy: keyBy, sortBy: sortBy, orderBy: orderBy,
          uniq: uniq, uniqBy: uniqBy, chunk: chunk, flatten: flatten, flattenDeep: flattenDeep, isEmpty: isEmpty, isObject: isObject, isFunction: isFunction, isString: isString, isNumber: isNumber, isNil: isNil,
          capitalize: capitalize, camelCase: camelCase, kebabCase: kebabCase, snakeCase: snakeCase, range: range, sum: sum, sumBy: sumBy, max: max, maxBy: maxBy, min: min, minBy: minBy, shuffle: shuffle, sample: sample,
          compact: compact, difference: difference, intersection: intersection, union: union, without: without, clamp: clamp, random: random, times: times, noop: noop, identity: identity,
          isArray: Array.isArray,
        };

        export default _;
        export {
          debounce, throttle, cloneDeep, isEqual, get, set, pick, omit, merge, groupBy, keyBy, sortBy, orderBy,
          uniq, uniqBy, chunk, flatten, flattenDeep, isEmpty, isObject, isFunction, isString, isNumber, isNil,
          capitalize, camelCase, kebabCase, snakeCase, range, sum, sumBy, max, maxBy, min, minBy, shuffle, sample,
          compact, difference, intersection, union, without, clamp, random, times, noop, identity,
        };
      `
    };

    // Create a virtual file system plugin for esbuild
    const virtualFsPlugin: esbuild.Plugin = {
      name: "virtual-fs",
      setup(build) {
        // Resolve all imports
        build.onResolve({ filter: /.*/ }, (args) => {
          // External URLs (fonts, external CSS/JS assets) should be marked as external
          if (args.path.startsWith('http://') || args.path.startsWith('https://') || args.path.startsWith('//')) {
            return { path: args.path, external: true };
          }

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

          const transformedContent = loader === 'json' || loader === 'css'
            ? content
            : transformLucideReactImports(content);

          return { contents: transformedContent, loader };
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
      outfile: 'bundle.js', // CRITICAL: Required so esbuild knows where/how to name CSS and JS chunks when write: false is set
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

    // PHASE 1 FIX: Extract JS and CSS from esbuild outputFiles
    // esbuild only includes CSS that was ACTUALLY IMPORTED by the JS entry point
    // This matches Sandpack's behavior - unused CSS files are NOT bundled
    let bundledJs = '';
    const importedCssChunks: string[] = [];
    
    for (const outputFile of (result.outputFiles || [])) {
      if (outputFile.path.endsWith('.js')) {
        bundledJs = outputFile.text;
      } else if (outputFile.path.endsWith('.css')) {
        // This CSS was imported by JS - clean it and include
        let css = outputFile.text;
        // Remove @tailwind directives (we use CDN)
        css = css.replace(/@tailwind\s+[^;]+;/g, '');
        css = css.replace(/@import\s+url\([^)]+\);?/g, '');
        importedCssChunks.push(css);
      }
    }
    
    // PHASE 2 FIX: esbuild only sees CSS reachable from `entryPoint` (usually
    // App.js). Some projects keep the global CSS import in a separate
    // bootstrap file (e.g. index.js imports "./styles.css" while App.js is
    // the chosen entry for extracting the App component), which silently
    // drops that stylesheet - including :root theme variables - from the
    // published bundle. Recover any CSS imported anywhere in the project
    // that esbuild's dependency graph (rooted at entryPoint) didn't capture.
    const cssImportPattern = /import\s+(?:[^'";]*?\s+from\s+)?["'](\.[^'"]+\.css)["']/g;
    for (const [filePath, fileContent] of Object.entries(files)) {
      if (!/\.(js|jsx|ts|tsx)$/.test(filePath)) continue;
      cssImportPattern.lastIndex = 0;
      let cssMatch: RegExpExecArray | null;
      while ((cssMatch = cssImportPattern.exec(fileContent)) !== null) {
        const resolvedCssPath = resolvePath(cssMatch[1], filePath);
        const rawCss = files[resolvedCssPath];
        if (!rawCss) continue;
        const cleanedCss = rawCss
          .replace(/@tailwind\s+[^;]+;/g, '')
          .replace(/@import\s+url\([^)]+\);?/g, '');
        const trimmedCss = cleanedCss.trim();
        if (trimmedCss && !importedCssChunks.some((chunk) => chunk.includes(trimmedCss.slice(0, 100)))) {
          importedCssChunks.push(cleanedCss);
        }
      }
    }

    // If no JS output found, use the first output as fallback
    if (!bundledJs && result.outputFiles?.[0]) {
      bundledJs = result.outputFiles[0].text;
    }
    
    const importedCss = importedCssChunks.join('\n\n');
    console.log(`esbuild output: ${bundledJs.length} bytes JS, ${importedCss.length} bytes imported CSS (${importedCssChunks.length} chunks)`);

    // Extract all Tailwind class names from the bundled JS for safelist injection
    const safelist = extractTailwindClasses(bundledJs);
    console.log(`Tailwind safelist: ${safelist.length} unique classes extracted from bundle`);

    // Build the final bundle with ONLY imported CSS
    const finalBundle = buildFinalBundle(bundledJs, importedCss, safelist);

    const buildTime = Date.now() - startTime;
    console.log(`Build successful in ${buildTime}ms: ${finalBundle.js.length} bytes JS, ${finalBundle.css.length} bytes CSS, ${safelist.length} safelisted classes`);

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
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function extractTailwindClasses(bundledJs: string): string[] {
  const classSet = new Set<string>();

  // Helper: split a string value into individual class tokens and add valid ones
  function addClasses(value: string) {
    for (const cls of value.split(/\s+/)) {
      const trimmed = cls.trim();
      if (trimmed && /^[a-z0-9:!_\-\/\.\[\]#%]+$/i.test(trimmed) && trimmed.length < 100) {
        classSet.add(trimmed);
      }
    }
  }

  // Strategy 1: All string literals in the entire bundle (catches everything — className values,
  // cn() args, clsx() args, ternary branches, concatenated parts, template literal segments)
  // This is the most powerful approach: just extract ALL quoted strings and filter to valid Tailwind tokens
  const allStrings = [
    /["'`]([^"'`\n\r]{1,200})["'`]/g,
  ];
  for (const pattern of allStrings) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(bundledJs)) !== null) {
      addClasses(match[1]);
    }
  }

  return Array.from(classSet);
}

function buildFinalBundle(bundledJs: string, css: string, safelist: string[] = []): { js: string; css: string; safelist: string[] } {
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

  return { js: wrappedJs, css, safelist };
}

function getReactRouterShim(): string {
  return `
const RouterContext = window.React.createContext({
  location: { pathname: window.location.pathname || '/', search: window.location.search || '', hash: window.location.hash || '' },
  params: {},
  outlet: null,
  navigate: () => {},
});

const normalizePathname = (value) => {
  const raw = typeof value === 'string' && value.length > 0 ? value : '/';
  const noQuery = raw.split('?')[0].split('#')[0] || '/';
  const withLeadingSlash = noQuery.startsWith('/') ? noQuery : '/' + noQuery;
  const collapsed = withLeadingSlash.replace(/\/+/g, '/');
  if (collapsed.length > 1 && collapsed.endsWith('/')) {
    return collapsed.slice(0, -1);
  }
  return collapsed || '/';
};

const currentLocation = () => ({
  pathname: normalizePathname(window.location.pathname || '/'),
  search: window.location.search || '',
  hash: window.location.hash || '',
});

const createHref = (to, location) => {
  const fallbackLocation = location || currentLocation();
  if (typeof to === 'string') return to || fallbackLocation.pathname;
  if (!to || typeof to !== 'object') return fallbackLocation.pathname + (fallbackLocation.search || '') + (fallbackLocation.hash || '');
  const pathname = typeof to.pathname === 'string' ? to.pathname : fallbackLocation.pathname;
  const search = to.search ? (String(to.search).startsWith('?') ? String(to.search) : '?' + String(to.search)) : '';
  const hash = to.hash ? (String(to.hash).startsWith('#') ? String(to.hash) : '#' + String(to.hash)) : '';
  return pathname + search + hash;
};

const navigateTo = (to, options) => {
  const opts = options || {};
  const href = createHref(to, currentLocation());
  if (opts.replace) {
    window.history.replaceState({}, '', href);
  } else {
    window.history.pushState({}, '', href);
  }
  window.dispatchEvent(new Event('wakti-router:navigate'));
};

const joinPaths = (base, path) => {
  if (!path) return normalizePathname(base || '/');
  if (path === '*') return '*';
  if (path.startsWith('/')) return normalizePathname(path);
  return normalizePathname((base || '/') + '/' + path);
};

const matchPathname = (pattern, pathname, allowPartial) => {
  const normalizedPattern = pattern === '*' ? '*' : normalizePathname(pattern || '/');
  const normalizedPathnameValue = normalizePathname(pathname || '/');
  if (normalizedPattern === '*') {
    return { matched: true, params: {}, matchedPath: normalizedPathnameValue };
  }
  const patternSegments = normalizedPattern === '/' ? [] : normalizedPattern.split('/').filter(Boolean);
  const pathSegments = normalizedPathnameValue === '/' ? [] : normalizedPathnameValue.split('/').filter(Boolean);
  const params = {};
  const consumed = [];
  for (let i = 0; i < patternSegments.length; i += 1) {
    const patternSegment = patternSegments[i];
    const pathSegment = pathSegments[i];
    if (patternSegment === '*') {
      params['*'] = pathSegments.slice(i).join('/');
      return {
        matched: true,
        params,
        matchedPath: '/' + pathSegments.join('/'),
      };
    }
    if (typeof pathSegment === 'undefined') {
      return { matched: false, params: {}, matchedPath: null };
    }
    if (patternSegment.startsWith(':')) {
      params[patternSegment.slice(1)] = decodeURIComponent(pathSegment);
      consumed.push(pathSegment);
      continue;
    }
    if (patternSegment !== pathSegment) {
      return { matched: false, params: {}, matchedPath: null };
    }
    consumed.push(pathSegment);
  }
  if (!allowPartial && patternSegments.length !== pathSegments.length) {
    return { matched: false, params: {}, matchedPath: null };
  }
  return {
    matched: true,
    params,
    matchedPath: consumed.length > 0 ? '/' + consumed.join('/') : '/',
  };
};

const renderMatchedRoutes = (routeNodes, pathname, basePath, inheritedParams, location) => {
  const routes = window.React.Children.toArray(routeNodes);
  for (let i = 0; i < routes.length; i += 1) {
    const route = routes[i];
    if (!window.React.isValidElement(route)) continue;
    const props = route.props || {};
    const childRoutes = window.React.Children.toArray(props.children);
    const hasChildren = childRoutes.length > 0;
    const isIndex = props.index === true;
    const routePath = typeof props.path === 'string' ? props.path : '';
    const fullPattern = isIndex
      ? normalizePathname(basePath || '/')
      : routePath
        ? joinPaths(basePath || '/', routePath)
        : normalizePathname(basePath || '/');
    const match = isIndex
      ? {
          matched: normalizePathname(pathname || '/') === normalizePathname(basePath || '/'),
          params: {},
          matchedPath: normalizePathname(basePath || '/'),
        }
      : matchPathname(fullPattern, pathname, hasChildren || routePath === '*' || !props.element);
    if (!match.matched) continue;
    const params = Object.assign({}, inheritedParams || {}, match.params || {});
    const outlet = hasChildren
      ? renderMatchedRoutes(childRoutes, pathname, match.matchedPath || fullPattern, params, location)
      : null;
    const contextValue = {
      location,
      params,
      outlet,
      navigate: navigateTo,
    };
    if (props.element) {
      return window.React.createElement(RouterContext.Provider, { value: contextValue }, props.element);
    }
    if (outlet) {
      return window.React.createElement(RouterContext.Provider, { value: contextValue }, outlet);
    }
  }
  return null;
};

const BrowserRouter = ({ children }) => {
  const [location, setLocation] = window.React.useState(currentLocation());
  window.React.useEffect(() => {
    const handleChange = () => setLocation(currentLocation());
    window.addEventListener('popstate', handleChange);
    window.addEventListener('wakti-router:navigate', handleChange);
    return () => {
      window.removeEventListener('popstate', handleChange);
      window.removeEventListener('wakti-router:navigate', handleChange);
    };
  }, []);
  const contextValue = window.React.useMemo(() => ({
    location,
    params: {},
    outlet: null,
    navigate: navigateTo,
  }), [location]);
  return window.React.createElement(RouterContext.Provider, { value: contextValue }, children);
};

const HashRouter = BrowserRouter;
const MemoryRouter = BrowserRouter;
const Router = BrowserRouter;
const Route = () => null;

const Routes = ({ children }) => {
  const context = window.React.useContext(RouterContext);
  const location = context.location || currentLocation();
  return renderMatchedRoutes(children, location.pathname, '/', context.params || {}, location);
};

const Outlet = () => {
  const context = window.React.useContext(RouterContext);
  return context.outlet || null;
};

const useNavigate = () => navigateTo;
const useLocation = () => {
  const context = window.React.useContext(RouterContext);
  return context.location || currentLocation();
};
const useParams = () => {
  const context = window.React.useContext(RouterContext);
  return context.params || {};
};
const useHref = (to) => createHref(to, useLocation());
const useResolvedPath = (to) => {
  const href = createHref(to, useLocation());
  return {
    pathname: normalizePathname(href),
    search: typeof to === 'object' && to && to.search ? String(to.search) : '',
    hash: typeof to === 'object' && to && to.hash ? String(to.hash) : '',
  };
};
const createSearchParams = (init) => new URLSearchParams(init || '');
const useSearchParams = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = window.React.useMemo(() => new URLSearchParams(location.search || ''), [location.search]);
  const setSearchParams = (nextInit, options) => {
    const nextParams = nextInit instanceof URLSearchParams
      ? nextInit
      : new URLSearchParams(nextInit || '');
    navigate({ pathname: location.pathname, search: '?' + nextParams.toString() }, options || {});
  };
  return [searchParams, setSearchParams];
};
const useMatch = (pattern) => matchPathname(typeof pattern === 'string' ? pattern : pattern && pattern.path ? pattern.path : '/', useLocation().pathname, false);
const useOutlet = () => {
  const context = window.React.useContext(RouterContext);
  return context.outlet || null;
};
const useInRouterContext = () => true;
const useNavigationType = () => 'POP';

const Link = window.React.forwardRef(({ onClick, replace, to, children, ...rest }, ref) => {
  const location = useLocation();
  const href = createHref(to, location);
  const handleClick = (event) => {
    if (typeof onClick === 'function') onClick(event);
    if (event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;
    const target = event.currentTarget.getAttribute('target');
    if (target && target !== '_self') return;
    event.preventDefault();
    navigateTo(to, { replace: !!replace });
  };
  return window.React.createElement('a', Object.assign({}, rest, { href, onClick: handleClick, ref }), children);
});

const NavLink = window.React.forwardRef(({ className, style, end, to, ...rest }, ref) => {
  const location = useLocation();
  const href = createHref(to, location);
  const currentPath = normalizePathname(location.pathname || '/');
  const targetPath = normalizePathname(href || '/');
  const isActive = end ? currentPath === targetPath : (targetPath === '/' ? currentPath === '/' : currentPath === targetPath || currentPath.startsWith(targetPath + '/'));
  const resolvedClassName = typeof className === 'function' ? className({ isActive, isPending: false }) : className;
  const resolvedStyle = typeof style === 'function' ? style({ isActive, isPending: false }) : style;
  return window.React.createElement(Link, Object.assign({}, rest, { ref, to, className: resolvedClassName, style: resolvedStyle }), rest.children);
});

const Navigate = ({ to, replace }) => {
  const navigate = useNavigate();
  window.React.useEffect(() => {
    navigate(to, { replace: !!replace });
  }, [to, replace]);
  return null;
};

const RouterProvider = ({ children }) => children;
const createBrowserRouter = () => ({});
const createHashRouter = () => ({});
const createRoutesFromElements = (elements) => elements;

export {
  BrowserRouter,
  HashRouter,
  MemoryRouter,
  Router,
  RouterProvider,
  Routes,
  Route,
  Outlet,
  Navigate,
  Link,
  NavLink,
  createBrowserRouter,
  createHashRouter,
  createRoutesFromElements,
  createSearchParams,
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
  useHref,
  useResolvedPath,
  useMatch,
  useOutlet,
  useInRouterContext,
  useNavigationType,
};

export default {
  BrowserRouter,
  HashRouter,
  MemoryRouter,
  Router,
  RouterProvider,
  Routes,
  Route,
  Outlet,
  Navigate,
  Link,
  NavLink,
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
};
`;
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
    const iconDef = lucideLib[iconName];
    
    if (!iconDef) {
      // Return a placeholder span instead of null to avoid React error #130
      console.warn('[Lucide] Icon "' + iconName + '" not found in lucide library. Available:', Object.keys(lucideLib).slice(0, 5).join(', ') + '...');
      return window.React.createElement('span', {
        ref,
        className: className,
        style: { display: 'inline-block', width: size, height: size }
      });
    }
    
    // CRITICAL FIX: Handle Lucide UMD icon format correctly
    // Lucide UMD format: [tagName, defaultAttrs, [[childTag, childAttrs], ...]]
    // Example: Heart = ["svg", {xmlns:..., viewBox:...}, [["path", {d:"M..."}]]]
    
    let children = [];
    
    // Check if iconDef is an array (UMD format) or function (React component)
    if (typeof iconDef === 'function') {
      // It's already a React component - use it directly
      return window.React.createElement(iconDef, { ref, size, color, strokeWidth, className, ...rest });
    }
    
    if (Array.isArray(iconDef)) {
      // UMD format: [tagName, attrs, children] where children = [[tag, attrs], ...]
      const iconChildren = iconDef[2] || iconDef; // children array or the whole thing
      
      // Handle the children array
      const childArray = Array.isArray(iconChildren) ? iconChildren : [];
      
      for (var i = 0; i < childArray.length; i++) {
        var item = childArray[i];
        if (Array.isArray(item) && item.length >= 2) {
          // Format: [tagName, attributes]
          children.push(window.React.createElement(item[0], Object.assign({ key: 'path-' + i }, item[1])));
        }
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
// NOTE: MessageSquare is already exported earlier in this shim.
export const MessageSquarePlus = createLazyIconComponent('MessageSquarePlus');
export const MessageSquareDashed = createLazyIconComponent('MessageSquareDashed');
export const MessageSquareWarning = createLazyIconComponent('MessageSquareWarning');
export const MessageSquareX = createLazyIconComponent('MessageSquareX');
export const MessageSquareQuote = createLazyIconComponent('MessageSquareQuote');
export const MessageSquareText = createLazyIconComponent('MessageSquareText');
export const MessageSquareHeart = createLazyIconComponent('MessageSquareHeart');
export const MessageSquareCode = createLazyIconComponent('MessageSquareCode');
export const MessageSquareDot = createLazyIconComponent('MessageSquareDot');
export const MessageSquareMore = createLazyIconComponent('MessageSquareMore');
export const MessageSquareReply = createLazyIconComponent('MessageSquareReply');
export const MessageSquareShare = createLazyIconComponent('MessageSquareShare');
export const MessageSquareOff = createLazyIconComponent('MessageSquareOff');
// NOTE: MessageCircle is already exported earlier in this shim.
export const MessageCirclePlus = createLazyIconComponent('MessageCirclePlus');
export const MessageCircleWarning = createLazyIconComponent('MessageCircleWarning');
export const MessageCircleX = createLazyIconComponent('MessageCircleX');
export const MessageCircleCode = createLazyIconComponent('MessageCircleCode');
export const MessageCircleDashed = createLazyIconComponent('MessageCircleDashed');
export const MessageCircleHeart = createLazyIconComponent('MessageCircleHeart');
export const MessageCircleMore = createLazyIconComponent('MessageCircleMore');
export const MessageCircleOff = createLazyIconComponent('MessageCircleOff');
export const MessageCircleQuestion = createLazyIconComponent('MessageCircleQuestion');
export const MessageCircleReply = createLazyIconComponent('MessageCircleReply');
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
