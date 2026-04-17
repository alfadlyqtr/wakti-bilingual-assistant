/**
 * ============================================================================
 * SANDPACK PACKAGES — SINGLE SOURCE OF TRUTH (FRONTEND)
 * ============================================================================
 *
 * This file defines EVERY package available inside the Sandpack preview.
 * It is used by:
 *   - `src/components/projects/SandpackStudio.tsx` → `customSetup.dependencies`
 *   - (Indirectly) the AI Coder prompt via the edge-function mirror:
 *     `supabase/functions/_shared/sandpackPackages.ts`
 *
 * ⚠️ KEEP IN SYNC with `supabase/functions/_shared/sandpackPackages.ts`.
 *    Both files must contain the IDENTICAL list.
 *
 *    If you add or remove a package here, update the mirror in the same commit.
 *    A runtime drift check is enforced in dev (see `assertSandpackPackagesInSync`).
 *
 * HOW TO ADD A PACKAGE:
 *   1. Add an entry below with { name, version, category }.
 *   2. Copy the same entry into the edge-function mirror.
 *   3. Commit both files together.
 *   4. Redeploy the edge function (`supabase functions deploy projects-generate`).
 *
 * ============================================================================
 */

export type SandpackCategory =
  | 'core'
  | 'icons'
  | 'animation'
  | 'i18n'
  | 'date'
  | 'charts'
  | 'carousel'
  | 'dnd'
  | 'forms'
  | 'ui'
  | 'toast'
  | 'utilities'
  | 'data'
  | 'routing'
  | 'http'
  | 'games'
  | 'media'
  | 'markdown'
  | 'syntax'
  | 'supabase'
  | 'maps'
  | 'pdf'
  | 'qr'
  | 'tables'
  | 'virtualization'
  | 'misc';

export interface SandpackPackage {
  name: string;
  version: string;
  category: SandpackCategory;
  note?: string;
}

export const SANDPACK_PACKAGES: SandpackPackage[] = [
  // ── Core React ──────────────────────────────────────────────────────────
  { name: 'react',     version: '^18.2.0', category: 'core' },
  { name: 'react-dom', version: '^18.2.0', category: 'core' },

  // ── Icons ───────────────────────────────────────────────────────────────
  { name: 'lucide-react', version: '^0.462.0', category: 'icons', note: 'PRIMARY icon library — use this over react-icons' },
  { name: 'react-icons',  version: '^5.0.1',   category: 'icons', note: 'Fallback only; prefer lucide-react' },

  // ── Animation ───────────────────────────────────────────────────────────
  { name: 'framer-motion',            version: '^11.0.0', category: 'animation', note: 'Primary animation library' },
  { name: '@emotion/is-prop-valid',   version: '^1.2.1',  category: 'animation', note: 'Peer dependency of framer-motion' },
  { name: '@react-spring/web',        version: '^9.7.3',  category: 'animation' },

  // ── Internationalization ────────────────────────────────────────────────
  { name: 'i18next',                          version: '^23.7.6', category: 'i18n' },
  { name: 'react-i18next',                    version: '^13.5.0', category: 'i18n' },
  { name: 'i18next-browser-languagedetector', version: '^7.2.0',  category: 'i18n' },

  // ── Date / Time ─────────────────────────────────────────────────────────
  { name: 'date-fns',         version: '^3.6.0',   category: 'date', note: 'Modern, tree-shakeable date utility' },
  { name: 'dayjs',            version: '^1.11.10', category: 'date' },
  { name: 'moment',           version: '^2.30.1',  category: 'date', note: 'Legacy — prefer date-fns or dayjs' },
  { name: 'react-day-picker', version: '^8.10.1',  category: 'date' },

  // ── Charts & Data-viz ───────────────────────────────────────────────────
  { name: 'recharts',                  version: '^2.12.0', category: 'charts', note: 'Primary charting library' },
  { name: 'react-circular-progressbar', version: '^2.2.0', category: 'charts' },

  // ── Carousel / Slider ───────────────────────────────────────────────────
  { name: 'react-slick',             version: '^0.30.2', category: 'carousel' },
  { name: 'slick-carousel',          version: '^1.8.1',  category: 'carousel' },
  { name: 'embla-carousel-react',    version: '^8.0.0',  category: 'carousel' },
  { name: 'embla-carousel-autoplay', version: '^8.0.0',  category: 'carousel' },

  // ── Drag and Drop ───────────────────────────────────────────────────────
  { name: '@dnd-kit/core',      version: '^6.1.0', category: 'dnd' },
  { name: '@dnd-kit/sortable',  version: '^8.0.0', category: 'dnd' },
  { name: '@dnd-kit/utilities', version: '^3.2.2', category: 'dnd' },

  // ── Forms ───────────────────────────────────────────────────────────────
  { name: 'react-hook-form',      version: '^7.53.0', category: 'forms' },
  { name: '@hookform/resolvers',  version: '^3.9.0',  category: 'forms' },
  { name: 'zod',                  version: '^3.23.8', category: 'forms' },

  // ── UI Components (Radix) ───────────────────────────────────────────────
  { name: '@radix-ui/react-dialog',        version: '^1.1.2',  category: 'ui' },
  { name: '@radix-ui/react-dropdown-menu', version: '^2.1.15', category: 'ui' },
  { name: '@radix-ui/react-popover',       version: '^1.1.1',  category: 'ui' },
  { name: '@radix-ui/react-select',        version: '^2.1.1',  category: 'ui' },
  { name: '@radix-ui/react-tabs',          version: '^1.1.0',  category: 'ui' },
  { name: '@radix-ui/react-tooltip',       version: '^1.1.4',  category: 'ui' },
  { name: '@radix-ui/react-checkbox',      version: '^1.1.1',  category: 'ui' },
  { name: '@radix-ui/react-switch',        version: '^1.1.0',  category: 'ui' },
  { name: '@radix-ui/react-slider',        version: '^1.2.0',  category: 'ui' },
  { name: '@radix-ui/react-progress',      version: '^1.1.0',  category: 'ui' },
  { name: '@radix-ui/react-avatar',        version: '^1.1.0',  category: 'ui' },
  { name: '@radix-ui/react-accordion',     version: '^1.2.0',  category: 'ui' },
  { name: '@radix-ui/react-slot',          version: '^1.1.0',  category: 'ui' },
  { name: 'react-modal',                   version: '^3.16.1', category: 'ui' },
  { name: 'react-select',                  version: '^5.8.0',  category: 'ui' },

  // ── Toast / Notifications ───────────────────────────────────────────────
  { name: 'sonner',           version: '^1.5.0',  category: 'toast', note: 'Primary toast library' },
  { name: 'react-toastify',   version: '^10.0.4', category: 'toast' },
  { name: 'react-hot-toast',  version: '^2.4.1',  category: 'toast' },

  // ── Utilities ───────────────────────────────────────────────────────────
  { name: 'clsx',            version: '^2.1.0',   category: 'utilities', note: 'Conditional classNames — pair with tailwind-merge' },
  { name: 'tailwind-merge',  version: '^2.2.0',   category: 'utilities', note: 'Resolves Tailwind class conflicts' },
  { name: 'canvas-confetti', version: '^1.9.4',   category: 'utilities' },
  { name: 'uuid',            version: '^11.1.0',  category: 'utilities' },
  { name: 'lodash',          version: '^4.17.21', category: 'utilities' },

  // ── Data Fetching ───────────────────────────────────────────────────────
  { name: '@tanstack/react-query', version: '^5.56.2', category: 'data', note: 'Primary data-fetching library' },
  { name: 'swr',                    version: '^2.2.5',  category: 'data' },

  // ── Routing ─────────────────────────────────────────────────────────────
  { name: 'react-router-dom', version: '^6.22.0', category: 'routing' },

  // ── HTTP ────────────────────────────────────────────────────────────────
  { name: 'axios', version: '^1.6.7', category: 'http' },

  // ── Games / Graphics ────────────────────────────────────────────────────
  { name: 'chess.js',         version: '^1.0.0-beta.6', category: 'games' },
  { name: 'react-chessboard', version: '^4.7.3',        category: 'games' },
  { name: 'pixi.js',          version: '^8.10.2',       category: 'games' },

  // ── Media ───────────────────────────────────────────────────────────────
  { name: 'react-player', version: '^2.14.1', category: 'media' },

  // ── Markdown ────────────────────────────────────────────────────────────
  { name: 'react-markdown', version: '^9.0.1', category: 'markdown' },
  { name: 'remark-gfm',     version: '^4.0.0', category: 'markdown' },

  // ── Syntax Highlighting ─────────────────────────────────────────────────
  { name: 'prismjs',                  version: '^1.29.0',  category: 'syntax' },
  { name: 'react-syntax-highlighter', version: '^15.5.0',  category: 'syntax' },

  // ── Supabase ────────────────────────────────────────────────────────────
  { name: '@supabase/supabase-js', version: '^2.39.7', category: 'supabase' },

  // ── Maps ────────────────────────────────────────────────────────────────
  { name: 'leaflet',       version: '^1.9.4', category: 'maps' },
  { name: 'react-leaflet', version: '^4.2.1', category: 'maps' },

  // ── PDF ─────────────────────────────────────────────────────────────────
  { name: '@react-pdf/renderer', version: '^3.4.2', category: 'pdf' },

  // ── QR / Clipboard ──────────────────────────────────────────────────────
  { name: 'qrcode.react',             version: '^3.1.0', category: 'qr' },
  { name: 'react-copy-to-clipboard',  version: '^5.1.0', category: 'utilities' },

  // ── Tables ──────────────────────────────────────────────────────────────
  { name: '@tanstack/react-table', version: '^8.13.2', category: 'tables' },

  // ── Virtualization ──────────────────────────────────────────────────────
  { name: 'react-window',      version: '^1.8.10', category: 'virtualization' },
  { name: 'react-virtualized', version: '^9.22.5', category: 'virtualization' },

  // ── Misc Layout/UX ──────────────────────────────────────────────────────
  { name: 'react-masonry-css',               version: '^1.0.16', category: 'misc' },
  { name: 'react-infinite-scroll-component', version: '^6.1.0',  category: 'misc' },
  { name: 'react-loading-skeleton',          version: '^3.4.0',  category: 'misc' },
  { name: 'react-colorful',                  version: '^5.6.1',  category: 'misc' },
  { name: 'react-intersection-observer',     version: '^9.10.2', category: 'misc' },
];

/**
 * Map of { packageName: version } — plug directly into Sandpack's
 * `customSetup.dependencies`.
 */
export const SANDPACK_DEPENDENCIES: Record<string, string> = Object.fromEntries(
  SANDPACK_PACKAGES.map((p) => [p.name, p.version]),
);

/** Flat list of allowed package names (for prompt injection / validation). */
export const ALLOWED_PACKAGE_NAMES: string[] = SANDPACK_PACKAGES.map((p) => p.name);

/**
 * Returns the root package name from an import path.
 *   'lodash/debounce'        → 'lodash'
 *   '@tanstack/react-query'  → '@tanstack/react-query'
 *   '@dnd-kit/core/utils'    → '@dnd-kit/core'
 */
export function rootPackageName(importPath: string): string {
  if (importPath.startsWith('@')) {
    const parts = importPath.split('/');
    return parts.slice(0, 2).join('/');
  }
  return importPath.split('/')[0];
}

/** True if the given import path resolves to an allowed package. */
export function isPackageAllowed(importPath: string): boolean {
  return ALLOWED_PACKAGE_NAMES.includes(rootPackageName(importPath));
}

/**
 * Human-readable list grouped by category — injected into the AI system prompt
 * so the model knows exactly what it can import.
 */
export function formatPackagesForPrompt(): string {
  const byCategory: Record<string, SandpackPackage[]> = {};
  for (const pkg of SANDPACK_PACKAGES) {
    (byCategory[pkg.category] ||= []).push(pkg);
  }

  const order: SandpackCategory[] = [
    'core', 'icons', 'animation', 'i18n', 'date', 'charts', 'carousel',
    'dnd', 'forms', 'ui', 'toast', 'utilities', 'data', 'routing', 'http',
    'games', 'media', 'markdown', 'syntax', 'supabase', 'maps', 'pdf',
    'qr', 'tables', 'virtualization', 'misc',
  ];

  return order
    .filter((cat) => byCategory[cat])
    .map((cat) => {
      const names = byCategory[cat]
        .map((p) => (p.note ? `${p.name} (${p.note})` : p.name))
        .join(', ');
      return `- ${cat}: ${names}`;
    })
    .join('\n');
}
