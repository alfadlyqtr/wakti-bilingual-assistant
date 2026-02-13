import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { 
  SandpackProvider, 
  SandpackCodeEditor, 
  SandpackPreview,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { SandpackErrorBoundary } from "./SandpackErrorBoundary";
import { SandpackErrorListener } from "./SandpackErrorListener";
import { SandpackConsolePanel } from "./SandpackConsolePanel";
import { CollapsibleFileTree } from "./CollapsibleFileTree";
import { atomDark } from "@codesandbox/sandpack-themes";
import { Code2, Eye, FileCode, FileJson, FileType, CheckCircle2, MousePointer2, Monitor, Tablet, Smartphone, ExternalLink, RefreshCw, Download, Upload, Loader2, Settings, Share2, Save, Terminal, PanelLeftClose, PanelLeft } from "lucide-react";
import { SandpackSkeleton } from '@/pages/ProjectDetail/components/PreviewPanel/SandpackSkeleton';
import { useIncrementalFileUpdater } from '@/pages/ProjectDetail/hooks/useIncrementalFileUpdater';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { clsx } from "clsx";
import { WAKTI_INSPECTOR_COMPONENT } from "@/utils/waktiInspectorComponent";
import sandpackI18nBundle from "@/assets/sandpack-i18n-bundle.mjs?raw";

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

// --- 3. INSPECTABLE PREVIEW COMPONENT ---
// Uses SandpackPreview ref to directly access the iframe for reliable postMessage communication
const InspectablePreview = ({ 
  elementSelectMode, 
  onElementSelect 
}: { 
  elementSelectMode?: boolean;
  onElementSelect?: (elementRef: string, elementInfo?: SelectedElementInfo) => void;
}) => {
  const { sandpack } = useSandpack();
  const previewRef = useRef<{ clientId: string; getClient: () => any } | null>(null);
  const [inspectorReady, setInspectorReady] = useState(false);
  const [modeAckReceived, setModeAckReceived] = useState(false);
  const retryRef = useRef<NodeJS.Timeout | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Find the iframe in the DOM (fallback method)
  const findIframe = useCallback((): HTMLIFrameElement | null => {
    // Method 1: Via previewRef
    const client = previewRef.current?.getClient?.();
    if (client?.iframe) {
      return client.iframe;
    }
    
    // Method 2: Via sandpack.clients
    const clients = Object.values(sandpack.clients);
    for (const c of clients) {
      const anyClient = c as any;
      if (anyClient.iframe) {
        return anyClient.iframe;
      }
    }
    
    // Method 3: Direct DOM query
    const iframe = document.querySelector('.sp-preview-container iframe') as HTMLIFrameElement;
    return iframe || null;
  }, [sandpack.clients]);

  // Send inspect mode toggle with retry logic
  const sendToggleMessage = useCallback((enabled: boolean) => {
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
        iframeRef.current = iframe;
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
  }, [findIframe]);

  // Listen for inspector ready, mode ack, and element selection
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      // Inspector loaded confirmation
      if (e.data.type === 'WAKTI_INSPECTOR_READY') {
        console.log('[InspectablePreview] Inspector ready received');
        setInspectorReady(true);
        // If inspect mode is already on, re-send the toggle
        sendToggleMessage(!!elementSelectMode);
      }

      // Mode change acknowledgment
      if (e.data.type === 'WAKTI_INSPECT_MODE_CHANGED') {
        console.log('[InspectablePreview] Mode ACK received:', e.data.payload);
        setModeAckReceived(true);
      }

      // Pong response for debugging
      if (e.data.type === 'WAKTI_INSPECTOR_PONG') {
        console.log('[InspectablePreview] Pong received - connection confirmed');
      }

      // Element selected
      if (e.data.type === 'WAKTI_ELEMENT_SELECTED' && e.data.payload) {
        console.log('[InspectablePreview] Element selected:', e.data.payload);
        const info = e.data.payload as SelectedElementInfo;
        let ref = `the ${info.tagName}`;
        if (info.innerText) {
          ref += ` "${info.innerText.substring(0, 40)}${info.innerText.length > 40 ? '...' : ''}"`;
        }
        if (info.className) {
          const firstClass = info.className.split(' ').filter(Boolean)[0];
          if (firstClass) ref += ` (.${firstClass})`;
        }
        onElementSelect?.(ref, info);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [onElementSelect, elementSelectMode, sendToggleMessage]);

  // Send toggle when mode changes
  useEffect(() => {
    sendToggleMessage(!!elementSelectMode);
  }, [elementSelectMode, sendToggleMessage]);

  // Reset inspector ready state when sandpack restarts
  useEffect(() => {
    if (sandpack.status === 'initial' || sandpack.status === 'idle') {
      setInspectorReady(false);
      setModeAckReceived(false);
    }
  }, [sandpack.status]);

  // Debug: Log status when mode is enabled but not working
  useEffect(() => {
    if (elementSelectMode && !modeAckReceived) {
      const timeout = setTimeout(() => {
        if (!modeAckReceived) {
          console.warn('[InspectablePreview] Visual Edit mode enabled but no ACK received after 3s');
          console.log('[InspectablePreview] Status - inspectorReady:', inspectorReady, 'modeAckReceived:', modeAckReceived);
        }
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [elementSelectMode, modeAckReceived, inspectorReady]);

  return (
    <SandpackPreview 
      ref={previewRef as any}
      showNavigator={false} 
      showOpenInCodeSandbox={false}
      showSandpackErrorOverlay={false}
      showRefreshButton={false}
      style={{ height: '100%' }} 
    />
  );
};

// --- 4. INCREMENTAL FILE UPDATER COMPONENT ---
// Uses the hook inside SandpackProvider context to enable incremental updates
const IncrementalFileUpdaterComponent = ({ files }: { files: Record<string, string> }) => {
  useIncrementalFileUpdater(files);
  return null; // This component only runs the hook, renders nothing
};

// --- 5. MAIN STUDIO COMPONENT ---
interface SandpackStudioProps {
  files: Record<string, string>;
  projectId?: string; // Used for stable key to prevent full rebuilds
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
  const [selectedElement, setSelectedElement] = useState<SelectedElementInfo | null>(null);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [fileTreeCollapsed, setFileTreeCollapsed] = useState(false);
  
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
  
  // Check if we have valid files (not just empty or placeholder)
  // Enhanced validation to catch HTML error pages and malformed responses
  const hasValidFiles = useMemo(() => {
    if (Object.keys(files).length === 0) return false;
    const appJs =
      files["/App.js"] ??
      files["/src/App.js"] ??
      files["/src/App.jsx"] ??
      files["/src/App.tsx"];
    if (!appJs || appJs.length < 50) return false;
    // Reject HTML error pages
    if (appJs.includes("<!DOCTYPE") || appJs.includes("<html")) return false;
    // Reject obvious non-React content
    if (appJs.startsWith("{") && appJs.includes('"error"')) return false;
    // Must have React-like content
    if (!appJs.includes("import") && !appJs.includes("export") && !appJs.includes("function")) return false;
    return true;
  }, [files]);

  // Element selection is now handled by InspectablePreview component

  // Build Sandpack files. Memoized to prevent SandpackProvider from re-initializing on every render.
  const formattedFiles: Record<string, string> = useMemo(() => {
    const next: Record<string, string> = {};

    // Copy all files, fixing paths if needed
    Object.entries(files).forEach(([path, content]) => {
      // Ensure path starts with /
      const fixedPath = path.startsWith('/') ? path : `/${path}`;
      next[fixedPath] = content;
    });

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

    // Ensure /App.js exists so Sandpack always has a default entry file to open in Code view.
    // Many generated projects place App under /src, which would leave Sandpack with no obvious active file.
    if (!next["/App.js"]) {
      if (next["/src/App.js"] || next["/src/App.jsx"] || next["/src/App.tsx"]) {
        next["/App.js"] = "export { default } from './src/App';\n";
      }
    }

    // ALWAYS inject our custom index.js with the WaktiInspector component
    // This ensures the inspector runs inside the Sandpack iframe as a React component
    next["/index.js"] = `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

${WAKTI_INSPECTOR_COMPONENT}

const root = createRoot(document.getElementById("root"));
root.render(
  <>
    <App />
    <WaktiInspector />
  </>
);`;

    // Add styles.css if not present
    if (!next["/styles.css"]) {
      next["/styles.css"] = "/* Tailwind loaded via CDN */";
    }

    // Strip @tailwind directives and @apply rules from all CSS files
    // Tailwind is loaded via CDN script tag, so these directives crash Sandpack's bundler
    for (const [path, content] of Object.entries(next)) {
      if (path.endsWith('.css') && typeof content === 'string') {
        let cleaned = content;
        // Remove @tailwind directives
        cleaned = cleaned.replace(/@tailwind\s+(base|components|utilities)\s*;?\s*/g, '');
        // Replace @apply with plain comment (can't be processed without PostCSS)
        cleaned = cleaned.replace(/@apply\s+[^;]+;/g, '/* @apply removed - use inline classes */');
        if (cleaned !== content) {
          next[path] = cleaned;
        }
      }
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
    
    // Set index.html (no script injection needed - inspector is now a React component)
    const indexHtmlContent = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Wakti Preview</title>
    <script src="https://cdn.tailwindcss.com"><\/script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/slick-carousel/1.8.1/slick.min.css" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/slick-carousel/1.8.1/slick-theme.min.css" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

    next["/public/index.html"] = indexHtmlContent;
    next["/index.html"] = indexHtmlContent;

    return next;
  }, [files, sandpackI18nBundle]);

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
              <DropdownMenuItem onClick={onRefresh} className="flex items-center gap-2 cursor-pointer">
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

  return (
    <SandpackProvider
      template="react"
      theme={atomDark}
      files={formattedFiles}
      options={{
        externalResources: ["https://cdn.tailwindcss.com"],
        activeFile: "/App.js",
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
        dependencies: {
          // Core React
          "react": "^18.2.0",
          "react-dom": "^18.2.0",
          // UI/Icons
          "lucide-react": "^0.462.0",
          "clsx": "^2.1.1",
          "tailwind-merge": "^2.5.2",
          // Animation
          "framer-motion": "^12.0.0",
          "@emotion/is-prop-valid": "^1.2.1",
          // Internationalization
          "i18next": "^23.7.6",
          "react-i18next": "^13.5.0",
          "i18next-browser-languagedetector": "^7.2.0",
          // Date/Time
          "date-fns": "^3.6.0",
          "react-day-picker": "^8.10.1",
          // Charts & Data Viz
          "recharts": "^2.12.7",
          "chart.js": "^4.5.0",
          "react-chartjs-2": "^5.2.0",
          "react-circular-progressbar": "^2.2.0",
          // Carousel/Slider
          "react-slick": "^0.30.2",
          "slick-carousel": "^1.8.1",
          "embla-carousel-react": "^8.0.0",
          "embla-carousel-autoplay": "^8.0.0",
          // Drag and Drop
          "@dnd-kit/core": "^6.1.0",
          "@dnd-kit/sortable": "^8.0.0",
          "@dnd-kit/utilities": "^3.2.2",
          // Forms
          "react-hook-form": "^7.53.0",
          "@hookform/resolvers": "^3.9.0",
          "zod": "^3.23.8",
          // UI Components (Radix)
          "@radix-ui/react-dialog": "^1.1.2",
          "@radix-ui/react-dropdown-menu": "^2.1.15",
          "@radix-ui/react-popover": "^1.1.1",
          "@radix-ui/react-select": "^2.1.1",
          "@radix-ui/react-tabs": "^1.1.0",
          "@radix-ui/react-tooltip": "^1.1.4",
          "@radix-ui/react-checkbox": "^1.1.1",
          "@radix-ui/react-switch": "^1.1.0",
          "@radix-ui/react-slider": "^1.2.0",
          "@radix-ui/react-progress": "^1.1.0",
          "@radix-ui/react-avatar": "^1.1.0",
          "@radix-ui/react-accordion": "^1.2.0",
          "@radix-ui/react-slot": "^1.1.0",
          // Toast/Notifications
          "sonner": "^1.5.0",
          // Utilities
          "canvas-confetti": "^1.9.4",
          "uuid": "^11.1.0",
          // Data Fetching
          "@tanstack/react-query": "^5.56.2",
          // Gaming/Graphics
          "chess.js": "^1.0.0-beta.6",
          "react-chessboard": "^4.7.3",
          "pixi.js": "^8.10.2",
          // Routing
          "react-router-dom": "^6.22.0",
          // HTTP/Data
          "axios": "^1.6.7",
          "swr": "^2.2.5",
          // Utilities
          "lodash": "^4.17.21",
          "dayjs": "^1.11.10",
          "moment": "^2.30.1",
          // Additional Icons
          "react-icons": "^5.0.1",
          // Animation
          "@react-spring/web": "^9.7.3",
          // Toast/Notifications
          "react-toastify": "^10.0.4",
          "react-hot-toast": "^2.4.1",
          // Modals/Dialogs
          "react-modal": "^3.16.1",
          // Select/Dropdowns
          "react-select": "^5.8.0",
          // Tables
          "@tanstack/react-table": "^8.13.2",
          // Virtualization
          "react-window": "^1.8.10",
          "react-virtualized": "^9.22.5",
          // Media
          "react-player": "^2.14.1",
          // Markdown
          "react-markdown": "^9.0.1",
          "remark-gfm": "^4.0.0",
          // Code Highlighting
          "prismjs": "^1.29.0",
          "react-syntax-highlighter": "^15.5.0",
          // Supabase
          "@supabase/supabase-js": "^2.39.7",
          // Maps
          "leaflet": "^1.9.4",
          "react-leaflet": "^4.2.1",
          // PDF
          "@react-pdf/renderer": "^3.4.2",
          // QR Code
          "qrcode.react": "^3.1.0",
          // Copy to Clipboard
          "react-copy-to-clipboard": "^5.1.0",
          // Masonry Layout
          "react-masonry-css": "^1.0.16",
          // Infinite Scroll
          "react-infinite-scroll-component": "^6.1.0",
          // Skeleton Loading
          "react-loading-skeleton": "^3.4.0",
          // Color Picker
          "react-colorful": "^5.6.1",
          // Intersection Observer
          "react-intersection-observer": "^9.10.2"
        }
      }}
      style={{ height: '100%', width: '100%' }}
    >
      <div className="h-full w-full flex flex-col bg-[#0c0f14] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
        {/* HEADER - STICKY */}
        <Header />

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
                    .sp-stack .sp-error-message,
                    .sp-stack .sp-error-list,
                    .sp-preview-container .sp-bridge-frame,
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
                    /* Hide Sandpack loading spinner/indicator */
                    .sp-loading,
                    .sp-cube-wrapper,
                    .sp-preview-loading,
                    [class*="sp-loading"],
                    [class*="sp-cube"],
                    .sp-overlay {
                      display: none !important;
                      opacity: 0 !important;
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
                  
                  {/* Error Boundary to prevent entire app crash from broken components */}
                  <SandpackErrorBoundary
                    onError={(error) => {
                      console.error('[SandpackStudio] React Error Boundary caught error:', error);
                      onRuntimeError?.(error.message);
                    }}
                  >
                    <InspectablePreview 
                      elementSelectMode={elementSelectMode}
                      onElementSelect={onElementSelect}
                    />
                  </SandpackErrorBoundary>

                  {/* Visual Mode Indicator removed - now handled in ProjectDetail.tsx */}
          </div>

          {/* INCREMENTAL FILE UPDATER - Prevents full rebuilds on code changes */}
          <IncrementalFileUpdaterComponent files={formattedFiles} />

          {/* ERROR LISTENER - Invisible component that detects crashes */}
          {onRuntimeError && (
            <SandpackErrorListener onErrorDetected={onRuntimeError} />
          )}
        </div>

        {/* CONSOLE PANEL - Integrated at bottom */}
        {viewMode === 'preview' && (
          <SandpackConsolePanel 
            isOpen={consoleOpen}
            onToggle={() => setConsoleOpen(prev => !prev)}
            maxHeight={180}
          />
        )}
      </div>
    </SandpackProvider>
  );
}
