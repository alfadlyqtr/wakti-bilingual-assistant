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
import { Code2, Eye, FileCode, FileJson, FileType, CheckCircle2, MousePointer2, Monitor, Tablet, Smartphone, ExternalLink, RefreshCw, Download, Upload, Loader2, Settings, Share2, Save, Terminal, PanelLeftClose, PanelLeft, Github, X } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
import { SANDPACK_DEPENDENCIES, rootPackageName } from "@/config/sandpackPackages";

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
  const [fileTreeCollapsed, setFileTreeCollapsed] = useState(() => window.innerWidth < 768);
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [githubPat, setGithubPat] = useState('');
  const [githubRepoName, setGithubRepoName] = useState('');
  const [isExportingToGithub, setIsExportingToGithub] = useState(false);

  const handleGitHubExport = async () => {
    if (!githubPat.trim() || !githubRepoName.trim()) return;
    try {
      setIsExportingToGithub(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Session expired'); return; }

      toast.loading('Pushing to GitHub...', { id: 'gh-export' });

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github-export`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            projectId,
            repoName: githubRepoName.trim().replace(/[^a-zA-Z0-9_.-]/g, '-'),
            githubToken: githubPat.trim(),
            createNew: true,
          }),
        }
      );

      const result = await res.json();
      toast.dismiss('gh-export');

      if (!res.ok || !result.success) {
        toast.error(result.error || 'GitHub export failed');
        return;
      }

      toast.success(`Pushed ${result.fileCount} files to GitHub ✓`);
      setShowGithubModal(false);
      setGithubPat('');
      // Open the repo in a new tab
      window.open(result.repoUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      toast.dismiss('gh-export');
      toast.error(err?.message || 'An error occurred');
    } finally {
      setIsExportingToGithub(false);
    }
  };
  
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
  
  // Scan project files for actual import statements and return only used packages.
  // This prevents Sandpack from resolving all 50+ packages on every project load.
  const activeDependencies = useMemo<Record<string, string>>(() => {
    const allCode = Object.values(files).join('\n');
    // Match: import ... from 'pkg' / require('pkg') / from "pkg"
    const importRegex = /(?:from\s+['"]|require\s*\(\s*['"]|import\s+['"])(@?[a-z0-9][\w\-./]*)/g;
    const usedRoots = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = importRegex.exec(allCode)) !== null) {
      usedRoots.add(rootPackageName(m[1]));
    }
    // Always include core React packages
    const ALWAYS_INCLUDE = new Set(['react', 'react-dom']);
    const result: Record<string, string> = {};
    for (const [pkg, ver] of Object.entries(SANDPACK_DEPENDENCIES)) {
      if (ALWAYS_INCLUDE.has(rootPackageName(pkg)) || usedRoots.has(rootPackageName(pkg))) {
        result[pkg] = ver;
      }
    }
    return result;
  }, [files]);

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
              
              <DropdownMenuItem 
                onClick={() => setShowGithubModal(true)}
                className="flex items-center gap-2 cursor-pointer"
                disabled={!projectId}
              >
                <Github className="h-4 w-4" />
                <span>Push to GitHub</span>
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

    {/* GitHub Export Modal */}
    {showGithubModal && (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={() => setShowGithubModal(false)}
      >
        <div
          className="bg-[#0c0f14] border border-white/10 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Github className="h-5 w-5 text-white" />
              <h3 className="text-white font-semibold text-sm">{isRTL ? 'رفع إلى GitHub' : 'Push to GitHub'}</h3>
            </div>
            <button
              onClick={() => setShowGithubModal(false)}
              className="text-zinc-500 hover:text-white transition-colors"
              title={isRTL ? 'إغلاق' : 'Close'}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-400 block mb-1">{isRTL ? 'اسم المستودع' : 'Repository name'}</label>
              <input
                type="text"
                value={githubRepoName}
                onChange={(e) => setGithubRepoName(e.target.value)}
                placeholder="my-wakti-app"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">
                {isRTL ? 'GitHub Personal Access Token (repo scope)' : 'GitHub Personal Access Token (repo scope)'}
              </label>
              <input
                type="password"
                value={githubPat}
                onChange={(e) => setGithubPat(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleGitHubExport(); }}
                placeholder="ghp_..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 font-mono"
              />
              <a
                href="https://github.com/settings/tokens/new?scopes=repo&description=Wakti+AI+Coder"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-indigo-400 hover:text-indigo-300 mt-1 inline-block transition-colors"
              >
                {isRTL ? '← أنشئ token من هنا' : 'Generate a token ↗'}
              </a>
            </div>
          </div>

          <button
            onClick={handleGitHubExport}
            disabled={isExportingToGithub || !githubPat.trim() || !githubRepoName.trim()}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
          >
            {isExportingToGithub ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Github className="h-4 w-4" />
            )}
            {isRTL ? 'رفع المشروع' : 'Push project'}
          </button>
        </div>
      </div>
    )}
  </>);
}
