/**
 * Pre-render bootstrap.
 *
 * These are the side-effects that MUST run before React mounts so the very
 * first frame has correct body classes, filters, and global shims in place.
 *
 * Previously these lived scattered across `main.tsx` (dev console filter,
 * clipboard decoder) and `App.tsx` module scope (color-blind filter, text size,
 * admin body tag). Centralizing them here:
 *   - makes the startup sequence easy to reason about (one place, one order)
 *   - makes `main.tsx` and `App.tsx` smaller and declarative
 *   - makes each step individually testable and trivially toggle-able
 *
 * Call `runPreRenderSetup()` exactly once from `main.tsx` before `createRoot`.
 */

import { STORAGE_KEY, applyColorBlindFilter, type ColorBlindMode } from '@/components/accessibility/ColorBlindFilters';
import { TEXT_SIZE_STORAGE_KEY, applyTextSize, type TextSize } from '@/hooks/useTextSize';

// ─── Admin body class ────────────────────────────────────────────────────────
// Tag <body class="admin-page"> when user lands on an admin route so global
// admin CSS applies from the first paint (rather than waiting for a useEffect
// that would cause a visual flicker).
const ADMIN_PATHS = ['/admindash', '/admin/', '/admin-setup', '/admin-settings', '/mqtr'];

function tagAdminBodyClass(): void {
  try {
    if (ADMIN_PATHS.some(p => window.location.pathname.startsWith(p))) {
      document.body.classList.add('admin-page');
    }
  } catch {
    // Non-browser env or missing body (SSR/tests) — skip silently.
  }
}

// ─── Accessibility preferences ───────────────────────────────────────────────
// Both of these read a value from localStorage and apply it synchronously so
// the initial paint matches the user's saved preference.

function restoreColorBlindFilter(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as ColorBlindMode | null;
    if (saved && saved !== 'none') applyColorBlindFilter(saved);
  } catch {
    // localStorage can throw in private / locked-down contexts — ignore.
  }
}

function restoreTextSize(): void {
  try {
    const savedSize = localStorage.getItem(TEXT_SIZE_STORAGE_KEY) as TextSize | null;
    if (savedSize && savedSize !== 'normal') applyTextSize(savedSize);
  } catch {
    // Same rationale as above.
  }
}

// ─── Dev-only Radix Dialog warning filter ────────────────────────────────────
// Radix logs a `DialogContent requires a DialogTitle` warning whenever a Dialog
// is used without an explicit title, plus a related description warning. These
// are noisy during development and are an accessibility concern that the app
// handles via `VisuallyHidden` titles where appropriate. Production builds are
// not affected (guard on `import.meta.env.DEV`).

function installDevConsoleFilter(): void {
  if (!import.meta.env.DEV) return;

  const originalError = console.error;
  const originalWarn = console.warn;

  const shouldSuppress = (args: unknown[]): boolean => {
    try {
      const msg = args && (args as any[])[0] ? String((args as any[])[0]) : '';
      const patterns = [
        '`DialogContent` requires a `DialogTitle`',
        'Missing `Description` or `aria-describedby',
      ];
      return msg.includes('DialogContent') && patterns.some((p) => msg.includes(p));
    } catch {
      return false;
    }
  };

  console.error = (...args: unknown[]) => {
    if (shouldSuppress(args)) return;
    originalError(...args);
  };
  console.warn = (...args: unknown[]) => {
    if (shouldSuppress(args)) return;
    originalWarn(...args);
  };
}

// ─── Clipboard decoder ───────────────────────────────────────────────────────
// Some parts of the app (notably deep-link generation) produce URL-encoded
// strings that end up in the clipboard. This shim decodes them back to their
// human-readable form when the text looks like it contains encoded whitespace
// or percent-escapes AND isn't a URL / mailto (which must stay encoded).

function shouldDecodeClipboardText(text: string): boolean {
  const trimmed = text.trim();
  if (/^https?:\/\//i.test(trimmed)) return false;
  if (/^mailto:/i.test(trimmed)) return false;
  return /%0A|%20|%0D|%09/i.test(text) || /%[0-9A-Fa-f]{2}/.test(text);
}

function safeDecodeClipboardText(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    try {
      return decodeURIComponent(text.replace(/\+/g, ' '));
    } catch {
      return text;
    }
  }
}

function installClipboardDecoder(): void {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;

  const originalWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);
  navigator.clipboard.writeText = (text: string) => {
    const normalized = typeof text === 'string' && shouldDecodeClipboardText(text)
      ? safeDecodeClipboardText(text)
      : text;
    return originalWriteText(normalized);
  };
}

// ─── Public entry point ──────────────────────────────────────────────────────
/**
 * Runs all pre-render setup steps in the correct order.
 * Idempotent enough that calling it twice is harmless (console filter wraps
 * the already-wrapped console; clipboard decoder wraps the already-wrapped
 * writeText). But it should be called exactly once from `main.tsx`.
 */
export function runPreRenderSetup(): void {
  tagAdminBodyClass();
  restoreColorBlindFilter();
  restoreTextSize();
  installDevConsoleFilter();
  installClipboardDecoder();
}
