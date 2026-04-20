import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { createRequire } from "module";

// Item #8 Batch A1: bundle analyzer is optional. Only activates when ANALYZE=true,
// so normal dev/build doesn't need the plugin installed. We use createRequire so
// the import is resolved at runtime (not at TS compile time), letting the config
// work even before `npm install` adds the dep.
const enableAnalyzer = process.env.ANALYZE === 'true';
const localRequire = createRequire(import.meta.url);

function buildVisualizerPlugin(): any {
  if (!enableAnalyzer) return null;
  try {
    const { visualizer } = localRequire('rollup-plugin-visualizer');
    return visualizer({
      open: true,
      filename: 'dist/stats.html',
      template: 'treemap',
      gzipSize: true,
      brotliSize: true,
    });
  } catch {
    console.warn('[vite.config] ANALYZE=true but rollup-plugin-visualizer is not installed. Run `npm install` first.');
    return null;
  }
}

// ─── Manual vendor chunking strategy ─────────────────────────────────────────
// Goal: keep the initial (landing-page) chunk small by splitting heavy libs into
// their own chunks. Dynamic-imported libs (pptxgenjs, @ffmpeg, tesseract) still
// get their own code-split chunk — manualChunks just gives those chunks
// predictable names and groups related packages together for better caching.
function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;
  const p = id.replace(/\\/g, '/');

  // Core runtime — shared by every page, keep tiny and bundled together.
  if (p.includes('/node_modules/react/') ||
      p.includes('/node_modules/react-dom/') ||
      p.includes('/node_modules/scheduler/')) return 'react-vendor';
  if (p.includes('/react-router')) return 'router';

  // Backend + data layer
  if (p.includes('/@supabase/')) return 'supabase';
  if (p.includes('/@tanstack/')) return 'query';

  // UI primitives used across the app
  if (p.includes('/@radix-ui/')) return 'radix';
  if (p.includes('/lucide-react/')) return 'icons';

  // i18n (used app-wide)
  if (p.includes('/i18next') || p.includes('/react-i18next')) return 'i18n';

  // ── Heavy, feature-specific libs (mostly dynamic-imported) ──
  if (p.includes('/pdfjs-dist/') || p.includes('/pdf-lib/') ||
      p.includes('/jspdf')) return 'pdf';
  if (p.includes('/pptxgenjs/') || p.includes('/mammoth/') ||
      p.includes('/arabic-reshaper/')) return 'office';
  if (p.includes('/@ffmpeg/') || p.includes('/html2canvas/') ||
      p.includes('/html-to-image/')) return 'media';
  if (p.includes('/pixi.js/') || p.includes('/ogl/')) return 'gl';
  if (p.includes('/@codesandbox/sandpack')) return 'sandpack';
  if (p.includes('/@walletpass/') || p.includes('/node-forge/')) return 'wallet';
  if (p.includes('/recharts/')) return 'charts';
  if (p.includes('/chess.js/') || p.includes('/react-chessboard/')) return 'games';
  if (p.includes('/tesseract.js/')) return 'ocr';
  if (p.includes('/@xyflow/react/')) return 'flow';
  if (p.includes('/framer-motion/')) return 'motion';
  if (p.includes('/@dnd-kit/')) return 'dnd';
  if (p.includes('/gridjs')) return 'grid';
  if (p.includes('/date-fns/')) return 'date';
  if (p.includes('/zod/')) return 'zod';

  // Everything else — small or infrequently-changed utilities
  return 'vendor';
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const plugins: any[] = [react()];
  const analyzer = buildVisualizerPlugin();
  if (analyzer) plugins.push(analyzer);

  return {
    server: {
      host: mode === 'development' ? "localhost" : "::",
      port: 8080,
      strictPort: true,
      open: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
      },
      // NOTE: COOP/COEP headers removed - they break Sandpack's bundler
      // FFmpeg.wasm may not work without these, but Sandpack requires their removal
    },
    plugins,
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      // Keep source maps off in production to avoid shipping them; dev still gets them via vite default.
      sourcemap: false,
      // Raise the default 500 KB warning only for chunks we deliberately allow to grow
      // (e.g., sandpack, pdf). Not a hard limit — just silences noise.
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: { manualChunks },
      },
    },
  };
});
