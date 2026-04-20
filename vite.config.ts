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

// ─── Chunking strategy ───────────────────────────────────────────────────────
// We rely on Vite's default automatic vendor splitting. Previous manual
// chunking split React and Radix into separate chunks, which caused Radix to
// sometimes load before React and crash with "Cannot read properties of
// undefined (reading 'forwardRef')" — white screen of death. Vite's default
// handles React/Radix interdependencies correctly out of the box.

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
    },
  };
});
