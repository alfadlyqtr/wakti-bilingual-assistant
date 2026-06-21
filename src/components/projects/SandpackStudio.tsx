import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { 
  SandpackProvider, 
  SandpackCodeEditor, 
  SandpackPreview,
  useSandpack,
  type SandpackPreviewRef,
} from "@codesandbox/sandpack-react";
import { SandpackErrorBoundary } from "./SandpackErrorBoundary";
import { PREVIEW_ERROR_CAPTURE_SCRIPT, SandpackErrorListener } from "./SandpackErrorListener";
import { SandpackConsolePanel } from "./SandpackConsolePanel";
import { CollapsibleFileTree } from "./CollapsibleFileTree";
import { atomDark } from "@codesandbox/sandpack-themes";
import { Code2, Eye, FileCode, FileJson, FileType, CheckCircle2, Monitor, Tablet, Smartphone, ExternalLink, RefreshCw, Download, Upload, Loader2, Settings, Share2, Save, Terminal, PanelLeftClose, PanelLeft } from "lucide-react";
import { SandpackSkeleton } from '@/pages/ProjectDetail/components/PreviewPanel/SandpackSkeleton';
import { useIncrementalFileUpdater } from '@/pages/ProjectDetail/hooks/useIncrementalFileUpdater';
import { useSandpackFiles } from '@/pages/ProjectDetail/hooks/useSandpackFiles';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { clsx } from "clsx";
import { INSPECTOR_SCRIPT } from "@/utils/visualInspector";
import sandpackI18nBundle from "@/assets/sandpack-i18n-bundle.mjs?raw";
import { SANDPACK_DEPENDENCIES, assertSandpackPackagesInSync, rootPackageName } from "@/config/sandpackPackages";
import { SANDPACK_EFFECTIVE_BUNDLER_URL, SANDPACK_START_ROUTE } from "@/config/sandpackBundler";

const SANDPACK_COMPANION_DEPENDENCIES: Record<string, string[]> = {
  "framer-motion": ["@emotion/is-prop-valid"],
  "react-leaflet": ["leaflet"],
  "react-slick": ["slick-carousel"],
  "@hookform/resolvers": ["react-hook-form"],
};


// --- 2. SELECTED ELEMENT INFO TYPE ---
interface SelectedElementInfo {
  tagName: string;
  className: string;
  id: string;
  innerText: string;
  openingTag: string;
  computedStyle?: {
    color: string;
    backgroundColor: string;
    fontSize: string;
  };
}

type PreviewHealthState = 'loading' | 'ready' | 'recovering' | 'failed';

const WAKTI_VISUAL_ELEMENT_SELECTED_EVENT = 'wakti:visual-element-selected';
const STOCK_IMAGE_HELPER_PATHS = [
  '/utils/stockImages.js',
  '/utils/stockImages.ts',
  '/src/utils/stockImages.js',
  '/src/utils/stockImages.ts',
] as const;
const RUNTIME_ENTRY_CANDIDATES = [
  '/index.js',
  '/index.jsx',
  '/index.tsx',
  '/src/index.js',
  '/src/index.jsx',
  '/src/index.tsx',
  '/src/main.js',
  '/src/main.jsx',
  '/src/main.tsx',
  '/wakti_entry.js',
  '/wakti_entry.jsx',
  '/wakti_entry.tsx',
  '/src/wakti_entry.js',
  '/src/wakti_entry.jsx',
  '/src/wakti_entry.tsx',
] as const;
const VISUAL_PREVIEW_READY_TIMEOUT_MS = 130000;
const VISUAL_INSPECTOR_MARKER = 'wakti-visual-inspector-v1';
const APP_COMPONENT_ENTRY_CANDIDATES = [
  '/App.tsx',
  '/App.jsx',
  '/App.js',
  '/src/App.tsx',
  '/src/App.jsx',
  '/src/App.js',
] as const;

function hasReactMountCode(source: string): boolean {
  if (typeof source !== 'string') return false;
  return /createRoot\s*\(/.test(source) || /ReactDOM\.render\s*\(/.test(source) || /hydrateRoot\s*\(/.test(source);
}

function toImportPath(filePath: string): string {
  return filePath
    .replace(/^\//, './')
    .replace(/\.(tsx|ts|jsx|js)$/i, '');
}

function isLikelyPackageSpecifier(specifier: string): boolean {
  if (typeof specifier !== 'string') return false;
  const value = specifier.trim();
  if (!value) return false;

  if (
    value.startsWith('.') ||
    value.startsWith('/') ||
    value.startsWith('#') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('data:') ||
    value.startsWith('blob:') ||
    value.startsWith('@/') ||
    value.startsWith('~/')
  ) {
    return false;
  }

  if (value.startsWith('@')) {
    return /^@[a-z0-9][\w.-]*\/[a-z0-9][\w.-]*/i.test(value);
  }

  return /^[a-z0-9][\w.-]*/i.test(value);
}

function rewriteSandboxAliases(source: string): string {
  if (typeof source !== 'string' || source.length === 0) return source;

  return source
    .replace(/from\s+['"]@\/([^'"]+)['"]/g, 'from "/$1"')
    .replace(/from\s+['"]~\/([^'"]+)['"]/g, 'from "/$1"')
    .replace(/import\s+['"]@\/([^'"]+)['"]/g, 'import "/$1"')
    .replace(/import\s+['"]~\/([^'"]+)['"]/g, 'import "/$1"')
    .replace(/import\(\s*['"]@\/([^'"]+)['"]\s*\)/g, 'import("/$1")')
    .replace(/import\(\s*['"]~\/([^'"]+)['"]\s*\)/g, 'import("/$1")')
    .replace(/require\(\s*['"]@\/([^'"]+)['"]\s*\)/g, 'require("/$1")')
    .replace(/require\(\s*['"]~\/([^'"]+)['"]\s*\)/g, 'require("/$1")');
}

function ensureRootMountHtml(html: string): string {
  if (typeof html !== 'string' || html.trim().length === 0) {
    return '<!DOCTYPE html>\n<html><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head><body><div id="root"></div></body></html>';
  }

  if (/id=["']root["']/i.test(html)) {
    return html;
  }

  if (html.includes('</body>')) {
    return html.replace('</body>', '<div id="root"></div>\n</body>');
  }

  if (html.includes('</html>')) {
    return html.replace('</html>', '<body><div id="root"></div></body>\n</html>');
  }

  return `${html}\n<div id="root"></div>`;
}

function buildReactPreviewShell(html: string): string {
  const source = typeof html === 'string' ? html.trim() : '';
  if (!source) {
    return '<!DOCTYPE html>\n<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head><body><div id="root"></div></body></html>';
  }

  const htmlAttrsMatch = source.match(/<html([^>]*)>/i);
  const htmlAttrs = htmlAttrsMatch?.[1]?.trim() ? ` ${htmlAttrsMatch[1].trim()}` : ' lang="en"';
  const bodyAttrsMatch = source.match(/<body([^>]*)>/i);
  const bodyAttrs = bodyAttrsMatch?.[1]?.trim() ? ` ${bodyAttrsMatch[1].trim()}` : '';
  let headContent = source.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1]?.trim() || '';

  if (!/<meta[^>]+charset=/i.test(headContent)) {
    headContent = `<meta charset="UTF-8" />${headContent ? `\n${headContent}` : ''}`;
  }
  if (!/name=["']viewport["']/i.test(headContent)) {
    headContent = `${headContent}${headContent ? '\n' : ''}<meta name="viewport" content="width=device-width, initial-scale=1.0" />`;
  }

  return `<!DOCTYPE html>\n<html${htmlAttrs}>\n<head>\n${headContent}\n</head>\n<body${bodyAttrs}>\n<div id="root"></div>\n</body>\n</html>`;
}

function parseRequestUrl(input: unknown): URL | null {
  try {
    if (typeof input === 'string') {
      return new URL(input, window.location.href);
    }
    if (input instanceof URL) {
      return input;
    }
    if (input && typeof input === 'object' && 'url' in input) {
      const maybeUrl = (input as { url?: unknown }).url;
      if (typeof maybeUrl === 'string') {
        return new URL(maybeUrl, window.location.href);
      }
    }
  } catch {
    return null;
  }

  return null;
}

function isBlockedSandpackTelemetryRequest(input: unknown): boolean {
  const parsed = parseRequestUrl(input);
  if (!parsed) return false;
  return /(^|\.)csbops\.io$/i.test(parsed.hostname) && parsed.pathname.startsWith('/data/');
}

function createNoopTelemetryResponse(): Promise<Response> {
  return Promise.resolve(
    new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  );
}

const SAFE_STOCK_IMAGES_HELPER = `import { useEffect, useState } from "react";

const BACKEND_URL = "https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api";

function toLabel(query) {
  if (typeof query !== "string" || !query.trim()) return "stock image";
  return query.trim().split(/\\s+/).slice(0, 4).join(" ");
}

function toLimit(limit) {
  const n = Number(limit);
  if (!Number.isFinite(n)) return 5;
  return Math.max(1, Math.min(Math.floor(n), 20));
}

export function getStaticPlaceholder(query, width = 400, height = 300) {
  const w = Math.max(64, Number(width) || 400);
  const h = Math.max(64, Number(height) || 300);
  const text = encodeURIComponent(toLabel(query));
  return "https://placehold.co/" + w + "x" + h + "/1a1a2e/eaeaea?text=" + text;
}

function buildFallbackImages(query, limit) {
  const safeLimit = toLimit(limit);
  return Array.from({ length: safeLimit }, (_, index) =>
    getStaticPlaceholder(toLabel(query) + " " + (index + 1), 1200, 800)
  );
}

function extractUrls(payload) {
  if (!payload || typeof payload !== "object") return [];
  const maybeImages = payload.images;
  if (!Array.isArray(maybeImages)) return [];
  return maybeImages
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        return item.url || item.thumbnail || "";
      }
      return "";
    })
    .filter((value) => typeof value === "string" && value.trim().length > 0);
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function postWithTimeout(url, init, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchStockImages(query, limit = 5, options = {}) {
  const normalizedQuery = typeof query === "string" ? query.trim() : "";
  const safeLimit = toLimit(limit);
  const fallback = buildFallbackImages(normalizedQuery || "stock image", safeLimit);

  if (!normalizedQuery) {
    return fallback;
  }

  const projectId = typeof options.projectId === "string" && options.projectId.trim()
    ? options.projectId.trim()
    : "preview";

  if (projectId === "preview") {
    return fallback;
  }

  try {
    const response = await postWithTimeout(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        action: "freepik/images",
        data: { query: normalizedQuery, limit: safeLimit },
      }),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      console.warn("[stockImages] backend error", response.status, details.slice(0, 180));
      return fallback;
    }

    const payload = await safeJson(response);
    const urls = extractUrls(payload).slice(0, safeLimit);
    return urls.length > 0 ? urls : fallback;
  } catch (error) {
    console.warn("[stockImages] falling back to placeholder images", error);
    return fallback;
  }
}

export function useStockImage(query, options = {}) {
  const [image, setImage] = useState(() => getStaticPlaceholder(query, 1200, 800));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchStockImages(query, 1, options)
      .then((urls) => {
        if (cancelled) return;
        setImage(urls[0] || getStaticPlaceholder(query, 1200, 800));
      })
      .catch(() => {
        if (cancelled) return;
        setImage(getStaticPlaceholder(query, 1200, 800));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query, options.projectId]);

  return { image, loading };
}
`;

const PREVIEW_ERROR_CAPTURE_MARKER = 'WAKTI_PREVIEW_ERROR_CAPTURE_SCRIPT';
const SANDBOX_NETWORK_GUARD_MARKER = 'WAKTI_SANDBOX_NETWORK_GUARD_SCRIPT';
const SANDBOX_NETWORK_GUARD_SCRIPT = `
(() => {
  const parseUrl = (input) => {
    try {
      if (typeof input === "string") {
        return new URL(input, window.location.href);
      }
      if (input && typeof input === "object" && "url" in input) {
        return new URL(String(input.url), window.location.href);
      }
    } catch {
      return null;
    }
    return null;
  };

  const isBlockedSandpackAnalytics = (input) => {
    const url = parseUrl(input);
    if (!url) return false;
    return /(^|\.)csbops\.io$/i.test(url.hostname) && url.pathname.startsWith("/data/");
  };

  const okJsonResponse = () =>
    Promise.resolve(
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

  if (typeof window.fetch === "function") {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (isBlockedSandpackAnalytics(input)) {
        return okJsonResponse();
      }
      return originalFetch(input, init).catch((error) => {
        if (isBlockedSandpackAnalytics(input)) {
          return okJsonResponse();
        }
        throw error;
      });
    };
  }

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const originalSendBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => {
      if (isBlockedSandpackAnalytics(url)) {
        return true;
      }
      return originalSendBeacon(url, data);
    };
  }
})();
`;

function injectSandboxNetworkGuardScript(html: string): string {
  if (!html || html.includes(SANDBOX_NETWORK_GUARD_MARKER)) {
    return html;
  }

  const scriptTag = `<script>\n/* ${SANDBOX_NETWORK_GUARD_MARKER} */\n${SANDBOX_NETWORK_GUARD_SCRIPT}\n</script>`;

  if (html.includes('</head>')) {
    return html.replace('</head>', `${scriptTag}\n</head>`);
  }

  if (html.includes('</body>')) {
    return html.replace('</body>', `${scriptTag}\n</body>`);
  }

  return `${html}\n${scriptTag}`;
}

function injectVisualInspectorScript(html: string): string {
  if (!html || html.includes(VISUAL_INSPECTOR_MARKER)) {
    return html;
  }

  const scriptTag = `<script>\n/* ${VISUAL_INSPECTOR_MARKER} */\n${INSPECTOR_SCRIPT}\n</script>`;

  if (html.includes('</body>')) {
    return html.replace('</body>', `${scriptTag}\n</body>`);
  }

  if (html.includes('</head>')) {
    return html.replace('</head>', `${scriptTag}\n</head>`);
  }

  return `${html}\n${scriptTag}`;
}

function injectPreviewErrorCaptureScript(html: string): string {
  if (!html || html.includes(PREVIEW_ERROR_CAPTURE_MARKER)) {
    return html;
  }

  const scriptTag = `<script>\n/* ${PREVIEW_ERROR_CAPTURE_MARKER} */\n${PREVIEW_ERROR_CAPTURE_SCRIPT}\n</script>`;

  if (html.includes('</body>')) {
    return html.replace('</body>', `${scriptTag}\n</body>`);
  }

  if (html.includes('</head>')) {
    return html.replace('</head>', `${scriptTag}\n</head>`);
  }

  return `${html}\n${scriptTag}`;
}

// --- 3. INSPECTABLE PREVIEW COMPONENT ---
// Uses the official SandpackPreview + ref approach as documented by CodeSandbox.
// The ref gives us the live client for postMessage while SandpackPreview
// handles bundler boot, externalResources, hot-reload, and origin correctly.
const InspectablePreview = ({ 
  elementSelectMode, 
  onElementSelect,
  inspectorEnabled = true,
  watchdogEnabled = true,
  onPreviewReady,
  onPreviewFailure,
}: { 
  elementSelectMode?: boolean;
  onElementSelect?: (elementRef: string, elementInfo?: SelectedElementInfo) => void;
  inspectorEnabled?: boolean;
  watchdogEnabled?: boolean;
  onPreviewReady?: () => void;
  onPreviewFailure?: (reason: string) => void;
}) => {
  const { sandpack } = useSandpack();
  const previewRef = useRef<SandpackPreviewRef>(null);
  const [inspectorReady, setInspectorReady] = useState(false);
  const [modeAckReceived, setModeAckReceived] = useState(false);
  const retryRef = useRef<NodeJS.Timeout | null>(null);
  const pingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const healthcheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPongAtRef = useRef(0);
  const failureReportedRef = useRef(false);

  const reportPreviewFailure = useCallback((reason: string) => {
    if (failureReportedRef.current) return;
    failureReportedRef.current = true;
    console.warn('[InspectablePreview] Preview health check failed:', reason);
    onPreviewFailure?.(reason);
  }, [onPreviewFailure]);

  // Find the iframe via the SandpackPreview ref, then fall back to DOM query
  const findIframe = useCallback((): HTMLIFrameElement | null => {
    // Official approach: get client from ref, then find its iframe
    const client = previewRef.current?.getClient();
    if (client) {
      const clientId = previewRef.current?.clientId;
      if (clientId && sandpack.clients[clientId]) {
        // The client exists — find the iframe in the DOM that sandpack manages
        const spIframe = document.querySelector('.sp-preview-container iframe') as HTMLIFrameElement | null;
        if (spIframe) return spIframe;
      }
    }
    return document.querySelector('.sp-preview-container iframe') as HTMLIFrameElement | null;
  }, [sandpack.clients]);

  const getPreviewWindow = useCallback((): Window | null => {
    return findIframe()?.contentWindow || null;
  }, [findIframe]);

  const isPreviewMessage = useCallback((event: MessageEvent): boolean => {
    const previewWindow = getPreviewWindow();
    return !previewWindow || event.source === previewWindow;
  }, [getPreviewWindow]);

  const emitElementSelection = useCallback((info: SelectedElementInfo) => {
    let ref = `the ${info.tagName}`;
    if (info.innerText) {
      ref += ` "${info.innerText.substring(0, 40)}${info.innerText.length > 40 ? '...' : ''}"`;
    }
    if (info.className) {
      const firstClass = info.className.split(' ').filter(Boolean)[0];
      if (firstClass) ref += ` (.${firstClass})`;
    }

    onElementSelect?.(ref, info);
    window.dispatchEvent(new CustomEvent(WAKTI_VISUAL_ELEMENT_SELECTED_EVENT, {
      detail: { ref, info },
    }));
  }, [onElementSelect]);

  // Send inspect mode toggle with retry logic
  const sendToggleMessage = useCallback((enabled: boolean) => {
    if (!inspectorEnabled) {
      return;
    }

    // Clear any pending retry
    if (retryRef.current) {
      clearTimeout(retryRef.current);
      retryRef.current = null;
    }
    
    setModeAckReceived(false);

    const attemptSend = (attemptsLeft: number) => {
      const iframe = findIframe();
      
      if (iframe?.contentWindow) {
        console.log('[InspectablePreview] Sending WAKTI_TOGGLE_INSPECT:', enabled);
        iframe.contentWindow.postMessage({ type: 'WAKTI_TOGGLE_INSPECT', enabled }, '*');
        return;
      }

      // Retry if we have attempts left
      if (attemptsLeft > 0) {
        console.log('[InspectablePreview] Iframe not ready, retrying...', attemptsLeft);
        retryRef.current = setTimeout(() => attemptSend(attemptsLeft - 1), 200);
      } else {
        console.warn('[InspectablePreview] Could not find iframe after retries');
      }
    };

    attemptSend(15); // Try up to 15 times (3 seconds total)
  }, [findIframe, inspectorEnabled]);

  // Listen for inspector ready, mode ack, and element selection
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      const data = e.data;
      if (!data || typeof data !== 'object' || !("type" in data)) return;
      if (!isPreviewMessage(e)) return;

      // Inspector loaded confirmation
      if (inspectorEnabled && data.type === 'WAKTI_INSPECTOR_READY') {
        console.log('[InspectablePreview] Inspector ready received');
        setInspectorReady(true);
        lastPongAtRef.current = Date.now();
        failureReportedRef.current = false;
        onPreviewReady?.();
        // If inspect mode is already on, re-send the toggle
        sendToggleMessage(!!elementSelectMode);
      }

      // Mode change acknowledgment
      if (inspectorEnabled && data.type === 'WAKTI_INSPECT_MODE_CHANGED') {
        console.log('[InspectablePreview] Mode ACK received:', data.payload);
        setModeAckReceived(true);
      }

      // Pong response for debugging
      if (inspectorEnabled && data.type === 'WAKTI_INSPECTOR_PONG') {
        console.log('[InspectablePreview] Pong received - connection confirmed');
        lastPongAtRef.current = Date.now();
      }

      // Element selected
      if (inspectorEnabled && data.type === 'WAKTI_ELEMENT_SELECTED' && data.payload) {
        console.log('[InspectablePreview] Element selected:', data.payload);
        setModeAckReceived(true);
        const info = data.payload as SelectedElementInfo;
        emitElementSelection(info);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      if (retryRef.current) clearTimeout(retryRef.current);
      if (pingTimeoutRef.current) clearTimeout(pingTimeoutRef.current);
      if (healthcheckIntervalRef.current) clearInterval(healthcheckIntervalRef.current);
    };
  }, [elementSelectMode, emitElementSelection, inspectorEnabled, isPreviewMessage, onPreviewReady, sendToggleMessage]);

  useEffect(() => {
    if (!inspectorEnabled) {
      if (retryRef.current) {
        clearTimeout(retryRef.current);
        retryRef.current = null;
      }
      setInspectorReady(false);
      setModeAckReceived(false);
    }
  }, [inspectorEnabled]);

  // When not using inspector, signal preview ready once sandpack is running
  useEffect(() => {
    if (inspectorEnabled) return;
    if (sandpack.status !== 'running') return;
    failureReportedRef.current = false;
    onPreviewReady?.();
  }, [inspectorEnabled, onPreviewReady, sandpack.status]);

  // Send toggle when mode changes
  useEffect(() => {
    if (!inspectorEnabled) {
      return;
    }
    sendToggleMessage(!!elementSelectMode);
  }, [elementSelectMode, inspectorEnabled, sendToggleMessage]);

  // Reset inspector state when sandpack restarts
  useEffect(() => {
    if (sandpack.status === 'initial' || sandpack.status === 'idle') {
      setInspectorReady(false);
      setModeAckReceived(false);
      lastPongAtRef.current = 0;
      failureReportedRef.current = false;
    }
  }, [sandpack.status]);

  // Debug: Log status when mode is enabled but not working
  useEffect(() => {
    if (!inspectorEnabled) return;
    if (elementSelectMode && !modeAckReceived) {
      const timeout = setTimeout(() => {
        if (!modeAckReceived) {
          console.warn('[InspectablePreview] Visual Edit mode enabled but no ACK received after 3s');
          console.log('[InspectablePreview] Status - inspectorReady:', inspectorReady, 'modeAckReceived:', modeAckReceived);
        }
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [elementSelectMode, inspectorEnabled, modeAckReceived, inspectorReady]);

  const sandpackRunning = sandpack.status === 'running';
  useEffect(() => {
    if (!watchdogEnabled) return;
    if (inspectorEnabled ? inspectorReady : sandpackRunning) return;

    const timeout = setTimeout(() => {
      if (inspectorEnabled ? inspectorReady : sandpackRunning) return;
      const iframe = findIframe();
      const iframeSrc = iframe?.getAttribute('src') || '';
      reportPreviewFailure(
        iframeSrc
          ? `Preview did not become ready: ${iframeSrc}`
          : 'Preview iframe did not become ready.'
      );
    }, VISUAL_PREVIEW_READY_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [findIframe, inspectorEnabled, inspectorReady, reportPreviewFailure, sandpackRunning, watchdogEnabled]);

  useEffect(() => {
    if (!watchdogEnabled || !inspectorReady) return;

    const pingPreview = () => {
      const previewWindow = getPreviewWindow();
      if (!previewWindow) {
        reportPreviewFailure('Preview iframe became unavailable.');
        return;
      }

      try {
        previewWindow.postMessage({ type: 'WAKTI_INSPECTOR_PING' }, '*');
      } catch {
        reportPreviewFailure('Preview connection was lost.');
        return;
      }

      if (pingTimeoutRef.current) clearTimeout(pingTimeoutRef.current);
      pingTimeoutRef.current = setTimeout(() => {
        if (Date.now() - lastPongAtRef.current > 3000) {
          reportPreviewFailure('Preview stopped responding.');
        }
      }, 3000);
    };

    pingPreview();
    healthcheckIntervalRef.current = setInterval(pingPreview, 5000);

    return () => {
      if (pingTimeoutRef.current) clearTimeout(pingTimeoutRef.current);
      if (healthcheckIntervalRef.current) clearInterval(healthcheckIntervalRef.current);
    };
  }, [getPreviewWindow, inspectorReady, reportPreviewFailure, watchdogEnabled]);

  return (
    <SandpackPreview
      ref={previewRef}
      showNavigator={false}
      showOpenInCodeSandbox={false}
      showSandpackErrorOverlay={true}
      showRefreshButton={false}
      style={{ height: '100%', width: '100%' }}
      startRoute={SANDPACK_START_ROUTE}
    />
  );
};

// --- 4. INCREMENTAL FILE UPDATER COMPONENT ---
// Uses the hook inside SandpackProvider context to enable incremental updates
const IncrementalFileUpdaterComponent = ({ files }: { files: Record<string, string> }) => {
  useIncrementalFileUpdater(files);
  return null; // This component only runs the hook, renders nothing
};

const SandpackWorkspaceSync = ({
  activeFile,
  openTabs,
  onActiveFileChange,
  onOpenTabsChange,
  onSave,
}: {
  activeFile: string;
  openTabs: string[];
  onActiveFileChange: (path: string) => void;
  onOpenTabsChange: (paths: string[]) => void;
  onSave?: (files: Record<string, string>) => void;
}) => {
  const { sandpack } = useSandpack();

  const sandpackApi = sandpack as any;
  const sandpackActiveFile = sandpackApi.activeFile as string | undefined;
  const sandpackVisibleFiles = Array.isArray(sandpackApi.visibleFiles)
    ? sandpackApi.visibleFiles.filter((path: unknown): path is string => typeof path === 'string')
    : [];

  // Background Auto-Save on manual file editing
  const lastSavedRef = useRef<string>('');

  useEffect(() => {
    if (!onSave) return;

    const liveFiles: Record<string, string> = {};
    for (const [path, file] of Object.entries(sandpack.files)) {
      const anyFile = file as any;
      liveFiles[path] = anyFile?.code ?? anyFile?.content ?? '';
    }

    const currentFilesStr = JSON.stringify(liveFiles);

    // Initialize lastSavedRef on first load
    if (!lastSavedRef.current) {
      lastSavedRef.current = currentFilesStr;
      return;
    }

    if (currentFilesStr === lastSavedRef.current) return;

    const timer = setTimeout(() => {
      onSave(liveFiles);
      lastSavedRef.current = currentFilesStr;
    }, 2500);

    return () => clearTimeout(timer);
  }, [sandpack.files, onSave]);

  useEffect(() => {
    if (!activeFile) return;

    const availableFiles = Object.keys(sandpack.files || {});
    if (!availableFiles.includes(activeFile)) return;

    openTabs.forEach((path) => {
      if (availableFiles.includes(path) && !sandpackVisibleFiles.includes(path)) {
        sandpackApi.openFile?.(path);
      }
    });

    sandpackVisibleFiles
      .filter((path) => !openTabs.includes(path))
      .forEach((path) => {
        sandpackApi.closeFile?.(path);
      });

    if (sandpackActiveFile !== activeFile) {
      if (sandpackVisibleFiles.includes(activeFile)) {
        sandpackApi.setActiveFile?.(activeFile);
      } else {
        sandpackApi.openFile?.(activeFile);
      }
    }
  }, [activeFile, openTabs, sandpack.files, sandpackActiveFile, sandpackApi, sandpackVisibleFiles]);

  useEffect(() => {
    if (sandpackActiveFile && sandpackActiveFile !== activeFile) {
      onActiveFileChange(sandpackActiveFile);
    }

    if (
      sandpackVisibleFiles.length > 0 &&
      (sandpackVisibleFiles.length !== openTabs.length || sandpackVisibleFiles.some((path, index) => path !== openTabs[index]))
    ) {
      onOpenTabsChange(sandpackVisibleFiles);
    }
  }, [activeFile, onActiveFileChange, onOpenTabsChange, openTabs, sandpackActiveFile, sandpackVisibleFiles]);

  return null;
};

// --- 5. MAIN STUDIO COMPONENT ---
interface SandpackStudioProps {
  files: Record<string, string>;
  projectId?: string; // Used for stable key to prevent full rebuilds
  projectName?: string;
  onRuntimeError?: (error: string) => void;
  elementSelectMode?: boolean;
  onElementSelect?: (elementRef: string, elementInfo?: SelectedElementInfo) => void;
  isLoading?: boolean; // Show loading overlay while AI is generating
  onSave?: (files: Record<string, string>) => void;
  isSaving?: boolean;
  deviceView?: 'desktop' | 'tablet' | 'mobile';
  onDeviceViewChange?: (view: 'desktop' | 'tablet' | 'mobile') => void;
  onRefresh?: () => void;
  onDownload?: () => void;
  onPublish?: () => void;
  isPublishing?: boolean;
  isRTL?: boolean;
}

export default function SandpackStudio({ 
  files, 
  projectId,
  projectName,
  onRuntimeError, 
  elementSelectMode, 
  onElementSelect, 
  isLoading,
  onSave,
  isSaving = false,
  deviceView = 'desktop',
  onDeviceViewChange,
  onRefresh,
  onDownload,
  onPublish,
  isPublishing = false,
  isRTL = false
}: SandpackStudioProps) {
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [fileTreeCollapsed, setFileTreeCollapsed] = useState(() => window.innerWidth < 768);
  const [previewSessionKey, setPreviewSessionKey] = useState(0);
  const [previewHealth, setPreviewHealth] = useState<PreviewHealthState>('loading');
  const [previewFailureMessage, setPreviewFailureMessage] = useState('');
  const [forcedDependencyRoots, setForcedDependencyRoots] = useState<string[]>([]);
  const [forceAllDependencies, setForceAllDependencies] = useState(false);
  const [runtimeDependencies, setRuntimeDependencies] = useState<Record<string, string>>({});
  const autoRecoveryCountRef = useRef(0);

  const knownDependencyRoots = useMemo(() => {
    const roots = new Set<string>();
    Object.keys(SANDPACK_DEPENDENCIES).forEach((pkg) => {
      roots.add(rootPackageName(pkg));
    });
    Object.keys(runtimeDependencies).forEach((pkg) => {
      roots.add(rootPackageName(pkg));
    });
    return roots;
  }, [runtimeDependencies]);

  const extractMissingDependencyRoot = useCallback((errorMsg: string): string | null => {
    const missingDependencyPatterns = [
      /Cannot find module\s+['"]([^'"]+)['"]/i,
      /Could not find dependency:\s*['"]([^'"]+)['"]/i,
      /Module not found:.*?['"]([^'"]+)['"]/i,
    ];

    for (const pattern of missingDependencyPatterns) {
      const match = errorMsg.match(pattern);
      if (match?.[1]) {
        const specifier = match[1];
        if (!isLikelyPackageSpecifier(specifier)) {
          return null;
        }
        return rootPackageName(specifier);
      }
    }

    return null;
  }, []);

  const recoverFromMissingDependency = useCallback((errorMsg: string): boolean => {
    const missingRoot = extractMissingDependencyRoot(errorMsg);
    if (!missingRoot) return false;

    if (!knownDependencyRoots.has(missingRoot)) {
      if (!runtimeDependencies[missingRoot] && isLikelyPackageSpecifier(missingRoot)) {
        setRuntimeDependencies((prev) => ({
          ...prev,
          [missingRoot]: 'latest',
        }));
        setPreviewFailureMessage(`Adding package "${missingRoot}" and retrying preview...`);
        setPreviewHealth('recovering');
        setPreviewSessionKey(prev => prev + 1);
        return true;
      }

      if (forceAllDependencies) return false;

      setForceAllDependencies(true);
      setPreviewFailureMessage(`Missing package "${missingRoot}" detected. Retrying with compatibility mode...`);
      setPreviewHealth('recovering');
      setPreviewSessionKey(prev => prev + 1);
      return true;
    }

    if (!forcedDependencyRoots.includes(missingRoot)) {
      setForcedDependencyRoots((prev) => [...prev, missingRoot]);
      setPreviewFailureMessage(`Adding missing package "${missingRoot}" and retrying preview...`);
      setPreviewHealth('recovering');
      setPreviewSessionKey(prev => prev + 1);
      return true;
    }

    if (!forceAllDependencies) {
      setForceAllDependencies(true);
      setPreviewFailureMessage('Retrying preview with full dependency mode...');
      setPreviewHealth('recovering');
      setPreviewSessionKey(prev => prev + 1);
      return true;
    }

    return false;
  }, [extractMissingDependencyRoot, forceAllDependencies, forcedDependencyRoots, knownDependencyRoots, runtimeDependencies]);

  const handleSandpackError = useCallback((errorMsg: string) => {
    if (recoverFromMissingDependency(errorMsg)) {
      return;
    }
    onRuntimeError?.(errorMsg);
  }, [onRuntimeError, recoverFromMissingDependency]);

  useEffect(() => {
    let cancelled = false;

    assertSandpackPackagesInSync().catch((error) => {
      if (cancelled) return;

      const message = error instanceof Error
        ? error.message
        : 'Sandpack package sync check failed between frontend and edge mirror.';

      console.error('[SandpackStudio] Package sync check failed:', error);
      setPreviewFailureMessage(message);
      setPreviewHealth('failed');
      onRuntimeError?.(message);
    });

    return () => {
      cancelled = true;
    };
  }, [onRuntimeError]);

  useEffect(() => {
    const originalFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
    const originalSendBeacon = typeof navigator.sendBeacon === 'function'
      ? navigator.sendBeacon.bind(navigator)
      : null;

    if (originalFetch) {
      (window as typeof window & { fetch: typeof window.fetch }).fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        if (isBlockedSandpackTelemetryRequest(input)) {
          return createNoopTelemetryResponse();
        }

        return originalFetch(input, init).catch((error) => {
          if (isBlockedSandpackTelemetryRequest(input)) {
            return createNoopTelemetryResponse();
          }
          throw error;
        });
      }) as typeof window.fetch;
    }

    if (originalSendBeacon) {
      navigator.sendBeacon = ((url: string | URL, data?: BodyInit | null) => {
        if (isBlockedSandpackTelemetryRequest(url)) {
          return true;
        }
        return originalSendBeacon(url, data);
      }) as typeof navigator.sendBeacon;
    }

    return () => {
      if (originalFetch) {
        (window as typeof window & { fetch: typeof window.fetch }).fetch = originalFetch;
      }
      if (originalSendBeacon) {
        navigator.sendBeacon = originalSendBeacon;
      }
    };
  }, []);
  
  // Remove Sandpack resize handle - it causes issues in preview-only mode
  useEffect(() => {
    const removeResizeHandles = () => {
      // Target all possible resize handle elements
      const selectors = [
        '.sp-resize-handler',
        '[class*="sp-resize"]',
        '[class*="ResizeHandler"]',
        '[data-resize-handle]',
      ];
      
      selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          (el as HTMLElement).style.display = 'none';
          (el as HTMLElement).style.visibility = 'hidden';
          (el as HTMLElement).style.width = '0';
          (el as HTMLElement).style.height = '0';
          (el as HTMLElement).style.pointerEvents = 'none';
        });
      });
      
      // Also target by title attribute (Arabic: "اسحب لتغيير العرض")
      document.querySelectorAll('[title*="اسحب"], [title*="Drag"], [title*="resize"]').forEach(el => {
        (el as HTMLElement).style.display = 'none';
        (el as HTMLElement).style.visibility = 'hidden';
      });
    };
    
    // Run immediately and after a delay (for dynamic elements)
    removeResizeHandles();
    const timer1 = setTimeout(removeResizeHandles, 100);
    const timer2 = setTimeout(removeResizeHandles, 500);
    const timer3 = setTimeout(removeResizeHandles, 1000);
    
    // Also use MutationObserver to catch dynamically added elements
    const observer = new MutationObserver(removeResizeHandles);
    observer.observe(document.body, { childList: true, subtree: true });
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      observer.disconnect();
    };
  }, [viewMode]);

  const handlePreviewReady = useCallback(() => {
    autoRecoveryCountRef.current = 0;
    setPreviewFailureMessage('');
    setPreviewHealth('ready');
  }, []);

  useEffect(() => {
    setForcedDependencyRoots([]);
    setForceAllDependencies(false);
    setRuntimeDependencies({});
  }, [projectId]);

  const handleVisualPreviewFailure = useCallback((reason: string) => {
    if (autoRecoveryCountRef.current < 1) {
      autoRecoveryCountRef.current += 1;
      setPreviewFailureMessage(reason);
      setPreviewHealth('recovering');
      setPreviewSessionKey(prev => prev + 1);
      return;
    }

    setPreviewFailureMessage(reason);
    setPreviewHealth('failed');
  }, []);

  const handleManualPreviewReload = useCallback(() => {
    autoRecoveryCountRef.current = 0;
    setPreviewFailureMessage('');
    setPreviewHealth('loading');

    if (onRefresh) {
      onRefresh();
      return;
    }

    setPreviewSessionKey(prev => prev + 1);
  }, [onRefresh]);

  const normalizedProjectFiles = useMemo<Record<string, string>>(() => {
    const normalized: Record<string, string> = {};
    Object.entries(files).forEach(([path, content]) => {
      const fixedPath = path.startsWith('/') ? path : `/${path}`;
      if (/\.(jsx?|tsx?)$/i.test(fixedPath)) {
        normalized[fixedPath] = rewriteSandboxAliases(content);
      } else {
        normalized[fixedPath] = content;
      }
    });
    return normalized;
  }, [files]);
  
  // Scan project files for actual import statements and return only used packages.
  // This prevents Sandpack from resolving all 50+ packages on every project load.
  const activeDependencies = useMemo<Record<string, string>>(() => {
    if (forceAllDependencies) {
      return {
        ...SANDPACK_DEPENDENCIES,
        ...runtimeDependencies,
      };
    }

    const allCode = Object.values(normalizedProjectFiles).join('\n');
    // Match: import ... from 'pkg' / require('pkg') / from "pkg"
    const importRegex = /(?:from\s+['"]|require\s*\(\s*['"]|import\s+['"]|import\s*\(\s*['"])(@?[a-z0-9][\w\-./]*)/g;
    const rootsToInclude = new Set<string>(['react', 'react-dom']);
    let m: RegExpExecArray | null;
    while ((m = importRegex.exec(allCode)) !== null) {
      const specifier = m[1];
      if (!isLikelyPackageSpecifier(specifier)) continue;
      rootsToInclude.add(rootPackageName(specifier));
    }

    forcedDependencyRoots.forEach((pkg) => {
      rootsToInclude.add(rootPackageName(pkg));
    });

    const queue = Array.from(rootsToInclude);
    while (queue.length > 0) {
      const root = queue.shift();
      if (!root) continue;

      const companionPackages = SANDPACK_COMPANION_DEPENDENCIES[root] || [];
      for (const companionPkg of companionPackages) {
        const companionRoot = rootPackageName(companionPkg);
        if (!knownDependencyRoots.has(companionRoot)) continue;
        if (rootsToInclude.has(companionRoot)) continue;
        rootsToInclude.add(companionRoot);
        queue.push(companionRoot);
      }
    }

    const result: Record<string, string> = {};
    for (const [pkg, ver] of Object.entries(SANDPACK_DEPENDENCIES)) {
      if (rootsToInclude.has(rootPackageName(pkg))) {
        result[pkg] = ver;
      }
    }

    for (const [pkg, ver] of Object.entries(runtimeDependencies)) {
      result[pkg] = ver;
    }

    return result;
  }, [forceAllDependencies, forcedDependencyRoots, knownDependencyRoots, normalizedProjectFiles, runtimeDependencies]);

  const usesTypeScript = useMemo(
    () => Object.keys(files).some((path) => /\.(ts|tsx)$/.test(path)),
    [files]
  );

  // Check if we have valid files (not just empty or placeholder)
  // Enhanced validation to catch HTML error pages and malformed responses
  const hasValidFiles = useMemo(() => {
    if (Object.keys(normalizedProjectFiles).length === 0) return false;

    const entryCandidates = [
      '/App.js',
      '/App.jsx',
      '/App.tsx',
      '/src/App.js',
      '/src/App.jsx',
      '/src/App.tsx',
      '/src/main.js',
      '/src/main.jsx',
      '/src/main.tsx',
      '/index.js',
      '/index.jsx',
      '/index.tsx',
      '/src/index.js',
      '/src/index.jsx',
      '/src/index.tsx',
    ];

    const entryPath = entryCandidates.find((path) => typeof normalizedProjectFiles[path] === 'string')
      ?? Object.keys(normalizedProjectFiles).find((path) => /\.(js|jsx|ts|tsx)$/.test(path));

    if (!entryPath) return false;

    const entryCode = normalizedProjectFiles[entryPath];
    if (!entryCode || entryCode.length < 20) return false;
    // Reject HTML error pages
    if (entryCode.includes('<!DOCTYPE') || entryCode.includes('<html')) return false;
    // Reject obvious non-React content
    if (entryCode.startsWith('{') && entryCode.includes('"error"')) return false;
    // Must have executable JS/TS-like content
    if (!/(import|export|function|const|class|createRoot|React)/.test(entryCode)) return false;
    return true;
  }, [normalizedProjectFiles]);

  useEffect(() => {
    if (isLoading || !hasValidFiles) {
      autoRecoveryCountRef.current = 0;
      setPreviewFailureMessage('');
      setPreviewHealth('loading');
    }
  }, [hasValidFiles, isLoading, projectId]);

  // Element selection is now handled by InspectablePreview component

  // Build Sandpack files. Memoized to prevent SandpackProvider from re-initializing on every render.
  const formattedFiles: Record<string, string> = useMemo(() => {
    const next: Record<string, string> = {
      ...normalizedProjectFiles,
    };

    for (const helperPath of STOCK_IMAGE_HELPER_PATHS) {
      if (typeof next[helperPath] === 'string') {
        next[helperPath] = SAFE_STOCK_IMAGES_HELPER;
      }
    }

    // If no files are ready yet, provide a minimal App so Sandpack doesn't fall back
    // to its built-in default template (which shows "Hello world").
    if (Object.keys(next).length === 0) {
      next["/App.js"] = `import React from "react";

export default function App() {
  return (
    <div style={{ padding: 24, fontFamily: "Inter, system-ui, -apple-system" }}>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Loading project…</div>
      <div style={{ fontSize: 12, opacity: 0.7 }}>Please wait a moment.</div>
    </div>
  );
}
`;
    }

    const appEntryPath = APP_COMPONENT_ENTRY_CANDIDATES.find((path) => typeof next[path] === 'string');
    const hasMountingRuntimeEntry = RUNTIME_ENTRY_CANDIDATES.some((path) => {
      const source = next[path];
      return typeof source === 'string' && hasReactMountCode(source);
    });
    const hasRuntimeEntryFile = RUNTIME_ENTRY_CANDIDATES.some((path) => typeof next[path] === 'string');

    if (!hasMountingRuntimeEntry && appEntryPath) {
      const appImportPath = toImportPath(appEntryPath);

      next['/__wakti_entry.js'] = `import React from "react";
import { createRoot } from "react-dom/client";
import App from "${appImportPath}";

const root = createRoot(document.getElementById("root"));
root.render(<App />);
`;
    }

    // If project uses i18n, inject our pre-bundled version under the original package names
    // This way Sandpack resolves imports to our bundle instead of trying to fetch from npm
    if (next["/i18n.js"]) {
    // Create shim packages that re-export from our bundle
    const i18nShim = `// Pre-bundled i18n for Sandpack
${sandpackI18nBundle}
`;
    
    // i18next package shim
      next["/node_modules/i18next/package.json"] = JSON.stringify({
      name: "i18next",
      main: "./index.js",
      module: "./index.js"
    });
      next["/node_modules/i18next/index.js"] = `import { i18n } from './bundle.js';
export default i18n;
export * from './bundle.js';`;
      next["/node_modules/i18next/bundle.js"] = i18nShim;

    // react-i18next package shim  
      next["/node_modules/react-i18next/package.json"] = JSON.stringify({
      name: "react-i18next",
      main: "./index.js",
      module: "./index.js"
    });
      next["/node_modules/react-i18next/index.js"] = `export { useTranslation, Trans, I18nextProvider, initReactI18next } from '../i18next/bundle.js';`;

    // i18next-browser-languagedetector package shim
      next["/node_modules/i18next-browser-languagedetector/package.json"] = JSON.stringify({
      name: "i18next-browser-languagedetector",
      main: "./index.js",
      module: "./index.js"
    });
      next["/node_modules/i18next-browser-languagedetector/index.js"] = `export { LanguageDetector } from '../i18next/bundle.js';
export { LanguageDetector as default } from '../i18next/bundle.js';`;
    }
    
    // Ensure index.html exists (fallback only; never overwrite user html)
    const indexHtmlContent = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Wakti Preview</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/slick-carousel/1.8.1/slick.min.css" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/slick-carousel/1.8.1/slick-theme.min.css" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

    const shouldUseCleanReactShell = hasMountingRuntimeEntry || hasRuntimeEntryFile || !!appEntryPath;
    const indexHtmlSource = typeof next['/index.html'] === 'string'
      ? next['/index.html']
      : typeof next['/public/index.html'] === 'string'
        ? next['/public/index.html']
        : indexHtmlContent;
    const publicIndexHtmlSource = typeof next['/public/index.html'] === 'string'
      ? next['/public/index.html']
      : typeof next['/index.html'] === 'string'
        ? next['/index.html']
        : indexHtmlContent;

    if (!next['/index.html'] && !next['/public/index.html']) {
      next['/index.html'] = indexHtmlContent;
      next['/public/index.html'] = indexHtmlContent;
    } else if (!next['/index.html'] && next['/public/index.html']) {
      next['/index.html'] = next['/public/index.html'];
    } else if (!next['/public/index.html'] && next['/index.html']) {
      next['/public/index.html'] = next['/index.html'];
    }

    if (typeof next['/index.html'] === 'string') {
      next['/index.html'] = injectVisualInspectorScript(
        injectPreviewErrorCaptureScript(
          injectSandboxNetworkGuardScript(
            shouldUseCleanReactShell ? buildReactPreviewShell(indexHtmlSource) : ensureRootMountHtml(next['/index.html'])
          )
        )
      );
    }

    if (typeof next['/public/index.html'] === 'string') {
      next['/public/index.html'] = injectVisualInspectorScript(
        injectPreviewErrorCaptureScript(
          injectSandboxNetworkGuardScript(
            shouldUseCleanReactShell ? buildReactPreviewShell(publicIndexHtmlSource) : ensureRootMountHtml(next['/public/index.html'])
          )
        )
      );
    }

    return next;
  }, [normalizedProjectFiles]);

  const sandpackEntryFile = useMemo(() => {
    const mountedRuntimeEntry = RUNTIME_ENTRY_CANDIDATES.find((path) => {
      const source = formattedFiles[path];
      return typeof source === 'string' && hasReactMountCode(source);
    });

    if (mountedRuntimeEntry) {
      return mountedRuntimeEntry;
    }

    if (typeof formattedFiles['/__wakti_entry.js'] === 'string') {
      return '/__wakti_entry.js';
    }

    const existingRuntimeEntry = RUNTIME_ENTRY_CANDIDATES.find((path) => typeof formattedFiles[path] === 'string');
    if (existingRuntimeEntry) {
      return existingRuntimeEntry;
    }

    return APP_COMPONENT_ENTRY_CANDIDATES.find((path) => typeof formattedFiles[path] === 'string') || '/index.js';
  }, [formattedFiles]);

  const {
    activeFile,
    openTabs,
    setActiveFile,
    setOpenTabs,
  } = useSandpackFiles({
    projectId,
    files: formattedFiles,
  });

  const Header = () => {
    const { sandpack } = useSandpack();

    const handleSave = () => {
      if (!onSave) return;

      const liveFiles: Record<string, string> = {};
      for (const [path, file] of Object.entries(sandpack.files)) {
        const anyFile = file as any;
        liveFiles[path] = anyFile?.code ?? anyFile?.content ?? '';
      }
      onSave(liveFiles);
    };

    return (
      <div className="h-10 md:h-12 flex items-center justify-between px-3 md:px-4 border-b border-white/10 bg-[#0c0f14] shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className="w-3.5 h-3.5 md:w-4 md:h-4 text-indigo-500 shrink-0" />
          <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-gray-500 shrink-0">Editor</span>
          
          <div className="h-4 w-px bg-white/10 hidden xs:block" />
          
          {/* Device Switcher Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors shrink-0"
                title="Device view"
              >
                {deviceView === 'desktop' && <Monitor className="h-3.5 w-3.5" />}
                {deviceView === 'tablet' && <Tablet className="h-3.5 w-3.5" />}
                {deviceView === 'mobile' && <Smartphone className="h-3.5 w-3.5" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuItem 
                onClick={() => onDeviceViewChange?.('desktop')}
                className={clsx("flex items-center gap-2 cursor-pointer", deviceView === 'desktop' && "bg-indigo-500/20")}
              >
                <Monitor className="h-4 w-4" />
                <span>Desktop</span>
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={() => onDeviceViewChange?.('tablet')}
                className={clsx("flex items-center gap-2 cursor-pointer", deviceView === 'tablet' && "bg-indigo-500/20")}
              >
                <Tablet className="h-4 w-4" />
                <span>Tablet</span>
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={() => onDeviceViewChange?.('mobile')}
                className={clsx("flex items-center gap-2 cursor-pointer", deviceView === 'mobile' && "bg-indigo-500/20")}
              >
                <Smartphone className="h-4 w-4" />
                <span>Mobile</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-4 w-px bg-white/10 hidden xs:block" />
          
          <button 
            onClick={() => {
              const el = document.querySelector('.sandpack-preview-container');
              if (el) el.requestFullscreen?.();
            }}
            className="p-1.5 text-zinc-400 hover:text-white flex items-center gap-1 transition-colors shrink-0"
            title="Fullscreen"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          {/* Save (Code mode only) */}
          {viewMode === 'code' && onSave && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
              title="Save"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
            </button>
          )}

          {/* Actions Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                title="More actions"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handleManualPreviewReload} className="flex items-center gap-2 cursor-pointer">
                <RefreshCw className="h-4 w-4" />
                <span>Refresh</span>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem onClick={onDownload} className="flex items-center gap-2 cursor-pointer">
                <Download className="h-4 w-4" />
                <span>Download</span>
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={onPublish} 
                disabled={isPublishing}
                className="flex items-center gap-2 cursor-pointer"
              >
                {isPublishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                <span>Publish</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              
              <DropdownMenuItem className="flex items-center gap-2 cursor-pointer">
                <Share2 className="h-4 w-4" />
                <span>Share</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <div className="h-4 w-px bg-white/10 hidden xs:block" />
          
          {/* VIEW TOGGLE PILL */}
          <div className="flex bg-white/5 rounded-lg p-0.5 md:p-1 border border-white/5 shrink-0">
            {(['preview', 'code'] as const).map((mode) => (
              <button 
                key={mode}
                onClick={() => setViewMode(mode)}
                className={clsx(
                  "px-3 md:px-4 py-1 md:py-1.5 rounded-md text-[10px] md:text-xs font-medium transition-all capitalize flex items-center gap-1.5",
                  viewMode === mode ? "bg-white/10 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"
                )}
              >
                {mode === 'preview' && <Eye className="w-3 h-3" />}
                {mode === 'code' && <Code2 className="w-3 h-3" />}
                <span>{mode}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (<>
    <SandpackProvider
      key={`sandpack-provider-${projectId ?? 'local'}-${usesTypeScript ? 'ts' : 'js'}-${previewSessionKey}`}
      template={usesTypeScript ? "react-ts" : "react"}
      theme={atomDark}
      files={formattedFiles}
      options={{
        externalResources: ["https://cdn.tailwindcss.com"],
        bundlerURL: SANDPACK_EFFECTIVE_BUNDLER_URL,
        activeFile,
        visibleFiles: openTabs,
        classes: {
          "sp-wrapper": "h-full w-full block min-h-0",
          "sp-layout": "h-full w-full flex min-h-0",
          "sp-stack": "h-full w-full flex flex-col min-h-0",
          "sp-code-editor": "flex-1 overflow-auto min-h-0",
          "sp-preview": "flex-1 h-full min-h-0",
          "sp-preview-container": "h-full min-h-0",
          "sp-preview-iframe": "h-full min-h-0"
        },
      }}
      customSetup={{
        entry: sandpackEntryFile,
        // Dependencies are sourced from the Sandpack SSOT so the AI prompt
        // (via supabase/functions/_shared/sandpackPackages.ts) and the preview
        // sandbox can NEVER drift. Add/remove packages in
        // src/config/sandpackPackages.ts and keep the edge-function mirror in sync.
        dependencies: activeDependencies,
      }}
      style={{ height: '100%', width: '100%' }}
    >
      <div className="h-full w-full flex flex-col bg-[#0c0f14] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
        {/* HEADER - STICKY */}
        <Header />

        <SandpackWorkspaceSync
          activeFile={activeFile}
          openTabs={openTabs}
          onActiveFileChange={setActiveFile}
          onOpenTabsChange={setOpenTabs}
          onSave={onSave}
        />

        {/* SANDPACK ENGINE */}
        <div className="flex-1 relative min-h-0 overflow-hidden flex flex-col">
          {/* Global CSS for Sandpack height fixes */}
          <style dangerouslySetInnerHTML={{ __html: `
            /* Force all Sandpack elements to fill available height */
            .sp-layout, .sp-stack, .sp-wrapper, .sp-editor {
              height: 100% !important;
              min-height: 0 !important;
            }
            .sp-code-editor, .cm-editor, .cm-scroller {
              height: 100% !important;
              min-height: 0 !important;
            }
          `}} />
          
          {/* CODE MODE: Keep mounted; show/hide to avoid re-mounting the sandbox */}
          <div className={clsx(
            "absolute inset-0 flex flex-row bg-[#0c0f14] z-10",
            viewMode === 'code' ? "flex" : "hidden"
          )}>
            <CollapsibleFileTree 
              isCollapsed={fileTreeCollapsed}
              onToggleCollapse={() => setFileTreeCollapsed(prev => !prev)}
            />
            <div className="flex-1 h-full min-w-0 overflow-hidden">
              <SandpackCodeEditor 
                showTabs
                showLineNumbers 
                showInlineErrors 
                wrapContent={false}
                style={{ height: '100%', width: '100%' }} 
              />
            </div>
          </div>

          {/* PREVIEW MODE: Keep mounted; show/hide to avoid iframe blanking on toggle */}
          <div className={clsx(
            "absolute inset-0 h-full w-full min-w-0 relative bg-black overflow-hidden group",
            viewMode === 'preview' ? "block" : "hidden"
          )}>
                  {/* CSS to hide the default Sandpack error screen and fix scrollbar styling */}
                  <style dangerouslySetInnerHTML={{ __html: `
                    /* CRITICAL: Force Sandpack preview to fill full height */
                    .sp-preview,
                    .sp-preview-container,
                    .sp-stack,
                    .sp-wrapper {
                      height: 100% !important;
                      min-height: 0 !important;
                      flex: 1 1 0% !important;
                    }
                    .sp-preview-container iframe,
                    .sp-preview iframe {
                      height: 100% !important;
                      min-height: 0 !important;
                      width: 100% !important;
                    }
                    .sp-stack .sp-preview-actions,
                    .cm-diagnostic-error {
                      display: none !important;
                    }
                    .sp-preview-container iframe {
                      background-color: transparent !important;
                    }
                    /* AGGRESSIVE: Hide ALL Sandpack resize handles and drag elements */
                    .sp-resize-handler,
                    .sp-stack > .sp-resize-handler,
                    [class*="sp-resize"],
                    [class*="resize-handler"],
                    [class*="ResizeHandler"],
                    [data-resize-handle],
                    [draggable="true"],
                    .sp-layout > div[style*="cursor: col-resize"],
                    .sp-layout > div[style*="cursor: ew-resize"],
                    div[title*="اسحب"],
                    div[title*="Drag"],
                    div[title*="resize"],
                    div[title*="width"] {
                      display: none !important;
                      width: 0 !important;
                      height: 0 !important;
                      opacity: 0 !important;
                      visibility: hidden !important;
                      pointer-events: none !important;
                      position: absolute !important;
                      left: -9999px !important;
                    }
                    /* Hide any vertical dividers/separators */
                    .sp-layout > .sp-stack + .sp-stack::before,
                    .sp-layout .sp-separator,
                    .sp-stack .sp-separator {
                      display: none !important;
                    }
                    /* Hide refresh button */
                    .sp-button[title="Refresh"],
                    button[title="Refresh preview"] {
                      display: none !important;
                    }
                    /* Style scrollbars inside preview to be subtle */
                    .sp-preview-container::-webkit-scrollbar,
                    .sp-preview-iframe::-webkit-scrollbar {
                      width: 6px;
                      background: transparent;
                    }
                    .sp-preview-container::-webkit-scrollbar-thumb,
                    .sp-preview-iframe::-webkit-scrollbar-thumb {
                      background: rgba(100, 100, 100, 0.3);
                      border-radius: 3px;
                    }
                  `}} />

                  {/* LOADING OVERLAY - Uses SandpackSkeleton component */}
                  {viewMode === 'preview' && (isLoading || !hasValidFiles) && (
                    <SandpackSkeleton
                      isLoading={isLoading}
                      isError={!hasValidFiles && Object.keys(files).length > 0}
                      isRTL={isRTL}
                    />
                  )}

                  {viewMode === 'preview' && hasValidFiles && !isLoading && previewHealth === 'recovering' && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0c0f14]/70 backdrop-blur-sm p-4">
                      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0c0f14] px-5 py-4 text-center shadow-2xl">
                        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400">
                          <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                        <div className="text-sm font-semibold text-white">
                          {isRTL ? 'جارِ استرجاع المعاينة' : 'Recovering preview'}
                        </div>
                        <div className="mt-2 text-xs text-zinc-400">
                          {isRTL ? 'أحاول إعادة تشغيل المعاينة الحية الآن.' : 'Trying to restart the live preview now.'}
                        </div>
                      </div>
                    </div>
                  )}

                  {viewMode === 'preview' && hasValidFiles && !isLoading && previewHealth === 'failed' && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0c0f14]/80 backdrop-blur-sm p-4">
                      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0f14] p-6 text-center shadow-2xl">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
                          <RefreshCw className="h-5 w-5" />
                        </div>
                        <div className="text-lg font-semibold text-white">
                          {isRTL ? 'فشل تحميل المعاينة' : 'Preview connection failed'}
                        </div>
                        <div className="mt-2 text-sm text-zinc-400">
                          {isRTL ? 'المعاينة الحية لم تفتح بشكل صحيح. أعد تحميلها للمحاولة مرة أخرى.' : 'The live preview did not open correctly. Reload it to try again.'}
                        </div>
                        {previewFailureMessage && (
                          <div className="mt-3 break-words text-xs text-zinc-500">
                            {previewFailureMessage}
                          </div>
                        )}
                        <button
                          onClick={handleManualPreviewReload}
                          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-[#060541] transition-colors hover:bg-zinc-200"
                        >
                          <RefreshCw className="h-4 w-4" />
                          <span>{isRTL ? 'إعادة تحميل المعاينة' : 'Reload preview'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {viewMode === 'preview' && hasValidFiles && !isLoading && (
                    <SandpackErrorBoundary
                      onError={(error) => {
                        console.error('[SandpackStudio] React Error Boundary caught error:', error);
                        handleSandpackError(error.message);
                      }}
                    >
                      <InspectablePreview
                        key={`inspectable-preview-standard-${previewSessionKey}`}
                        elementSelectMode={elementSelectMode}
                        onElementSelect={onElementSelect}
                        inspectorEnabled={true}
                        watchdogEnabled={viewMode === 'preview' && !isLoading && hasValidFiles}
                        onPreviewReady={handlePreviewReady}
                        onPreviewFailure={handleVisualPreviewFailure}
                      />
                    </SandpackErrorBoundary>
                  )}

                  {/* Visual Mode Indicator removed - now handled in ProjectDetail.tsx */}
          </div>

          {/* INCREMENTAL FILE UPDATER - Prevents full rebuilds on code changes */}
          <IncrementalFileUpdaterComponent files={formattedFiles} />

          {/* ERROR LISTENER - Invisible component that detects crashes */}
          <SandpackErrorListener onErrorDetected={handleSandpackError} />
        </div>

        {/* CONSOLE PANEL - Integrated at bottom */}
        {viewMode === 'preview' && elementSelectMode && (
          <SandpackConsolePanel 
            isOpen={consoleOpen}
            onToggle={() => setConsoleOpen(prev => !prev)}
            maxHeight={180}
          />
        )}
      </div>
    </SandpackProvider>
  </>);
}
