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

          const register = useCallback((name, opts = {}) => ({
            name,
            onChange: (e) => {
              const v = e && e.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
              setValues(prev => ({...prev, [name]: v}));
              setIsDirty(true);
              if (errors[name]) setErrors(prev => { const n={...prev}; delete n[name]; return n; });
            },
            onBlur: () => { touchedRef.current[name] = true; },
            ref: () => {},
          }), [errors]);

          const handleSubmit = useCallback((onValid, onInvalid) => async (e) => {
            if (e && e.preventDefault) e.preventDefault();
            if (e && e.stopPropagation) e.stopPropagation();
            setIsSubmitting(true);
            try { await onValid({...values}); } 
            catch(err) { if (onInvalid) onInvalid(err); }
            finally { setIsSubmitting(false); }
          }, [values]);

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
