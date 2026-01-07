import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  SandpackProvider, 
  SandpackLayout, 
  SandpackCodeEditor, 
  SandpackPreview,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { SandpackErrorListener } from "./SandpackErrorListener";
import { atomDark } from "@codesandbox/sandpack-themes";
import { Code2, Eye, FileCode, FileJson, FileType, CheckCircle2, MousePointer2 } from "lucide-react";
import { clsx } from "clsx";
import { INSPECTOR_SCRIPT } from "@/utils/visualInspector";

// --- 1. CUSTOM FILE EXPLORER (The Google Look) ---
const CustomFileSidebar = () => {
  const { sandpack } = useSandpack();
  const { files, activeFile, openFile } = sandpack;

  return (
    <div className="w-48 md:w-64 h-full border-r border-white/10 bg-[#0f172a]/50 flex flex-col shrink-0">
      <div className="p-3 md:p-4 border-b border-white/10">
        <h3 className="text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider">Project Files</h3>
      </div>
      <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {Object.keys(files)
          .sort((a, b) => {
             // Sort: App.js first, then folders, then others
             if (a === '/App.js') return -1;
             if (b === '/App.js') return 1;
             return a.localeCompare(b);
          })
          .map((fileName) => (
          <button
            key={fileName}
            onClick={() => openFile(fileName)}
            className={clsx(
              "w-full flex items-center gap-2 px-3 md:px-4 py-2 text-xs md:text-sm transition-colors border-l-2",
              activeFile === fileName 
                ? "bg-amber-500/10 text-amber-400 border-amber-500" 
                : "text-gray-400 hover:text-white border-transparent hover:bg-white/5"
            )}
          >
            {fileName.endsWith('.js') || fileName.endsWith('.jsx') ? <FileCode className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" /> : 
             fileName.endsWith('.css') ? <FileType className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" /> : 
             <FileJson className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />}
            <span className="truncate text-left">{fileName.replace('/', '')}</span>
            {activeFile === fileName && <CheckCircle2 className="w-3 h-3 ml-auto opacity-50 hidden md:block" />}
          </button>
        ))}
      </div>
    </div>
  );
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

// --- 4. MAIN STUDIO COMPONENT ---
interface SandpackStudioProps {
  files: Record<string, string>;
  onRuntimeError?: (error: string) => void;
  elementSelectMode?: boolean;
  onElementSelect?: (elementRef: string, elementInfo?: SelectedElementInfo) => void;
  isLoading?: boolean; // Show loading overlay while AI is generating
}

export default function SandpackStudio({ files, onRuntimeError, elementSelectMode, onElementSelect, isLoading }: SandpackStudioProps) {
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [selectedElement, setSelectedElement] = useState<SelectedElementInfo | null>(null);
  
  // Check if we have valid files (not just empty or placeholder)
  // Enhanced validation to catch HTML error pages and malformed responses
  const hasValidFiles = useMemo(() => {
    if (Object.keys(files).length === 0) return false;
    const appJs = files["/App.js"];
    if (!appJs || appJs.length < 50) return false;
    // Reject HTML error pages
    if (appJs.includes("<!DOCTYPE") || appJs.includes("<html")) return false;
    // Reject obvious non-React content
    if (appJs.startsWith("{") && appJs.includes('"error"')) return false;
    // Must have React-like content
    if (!appJs.includes("import") && !appJs.includes("export") && !appJs.includes("function")) return false;
    return true;
  }, [files]);

  // Listen for element selection messages from the iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data.type === 'WAKTI_ELEMENT_SELECTED' && e.data.payload) {
        const info = e.data.payload as SelectedElementInfo;
        setSelectedElement(info);
        
        // Build a natural language reference
        let ref = `the ${info.tagName}`;
        if (info.innerText) ref += ` "${info.innerText.substring(0, 40)}${info.innerText.length > 40 ? '...' : ''}"`;
        if (info.className) {
          const firstClass = info.className.split(' ').filter(Boolean)[0];
          if (firstClass) ref += ` (.${firstClass})`;
        }
        
        onElementSelect?.(ref, info);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementSelect]);

  // Toggle inspect mode in iframe when elementSelectMode changes
  useEffect(() => {
    const iframe = document.querySelector('.sp-preview-iframe') as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ 
        type: 'WAKTI_TOGGLE_INSPECT', 
        enabled: elementSelectMode 
      }, '*');
    }
  }, [elementSelectMode]);

  // Fix files for Sandpack - ensure proper React 18 entry point
  const formattedFiles: Record<string, string> = {};
  
  // Copy all files, fixing paths if needed
  Object.entries(files).forEach(([path, content]) => {
    // Ensure path starts with /
    const fixedPath = path.startsWith('/') ? path : `/${path}`;
    formattedFiles[fixedPath] = content;
  });
  
  // Add index.js entry point if not present (React 18 style)
  if (!formattedFiles["/index.js"]) {
    formattedFiles["/index.js"] = `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const root = createRoot(document.getElementById("root"));
root.render(<App />);`;
  }
  
  // Add styles.css if not present
  if (!formattedFiles["/styles.css"]) {
    formattedFiles["/styles.css"] = "@tailwind base;\n@tailwind components;\n@tailwind utilities;";
  }
  
  // Always set index.html with the Visual Inspector script injected
  formattedFiles["/public/index.html"] = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Wakti Preview</title>
    <script src="https://cdn.tailwindcss.com"><\/script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:wght@400;500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script>${INSPECTOR_SCRIPT}<\/script>
  </body>
</html>`;
  
  console.log('[SandpackStudio] Files:', Object.keys(formattedFiles));

  return (
    <div className="h-full w-full flex flex-col bg-[#0c0f14] border border-white/10 rounded-xl overflow-hidden shadow-2xl min-h-[500px] md:min-h-0">
      {/* HEADER */}
      <div className="h-10 md:h-12 flex items-center justify-between px-3 md:px-4 border-b border-white/10 bg-[#0c0f14] shrink-0">
        <div className="flex items-center gap-2">
           <FileCode className="w-3.5 h-3.5 md:w-4 md:h-4 text-indigo-500" />
           <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-gray-500">Editor</span>
        </div>
        
        {/* VIEW TOGGLE PILL */}
        <div className="flex bg-white/5 rounded-lg p-0.5 md:p-1 border border-white/5">
          {(['preview', 'code'] as const).map((mode) => (
             <button 
               key={mode}
               onClick={() => setViewMode(mode)}
               className={clsx(
                 "px-2 md:px-3 py-1 md:py-1.5 rounded-md text-[10px] md:text-xs font-medium transition-all capitalize flex items-center gap-1.5",
                 viewMode === mode ? "bg-white/10 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"
               )}
             >
               {mode === 'preview' && <Eye className="w-3 h-3" />}
               {mode === 'code' && <Code2 className="w-3 h-3" />}
               <span className="hidden xs:inline">{mode}</span>
             </button>
          ))}
        </div>
      </div>

      {/* SANDPACK ENGINE */}
      <div className="flex-1 relative min-h-0 overflow-hidden">
        <SandpackProvider
          template="react"
          theme={atomDark}
          files={formattedFiles}
          options={{
            externalResources: ["https://cdn.tailwindcss.com"],
            classes: {
              "sp-wrapper": "h-full w-full block",
              "sp-layout": "h-full w-full flex",
              "sp-stack": "h-full w-full flex flex-col",
              "sp-code-editor": "flex-1 overflow-auto",
              "sp-preview": "flex-1"
            },
          }}
          customSetup={{
            dependencies: {
              "lucide-react": "0.294.0",
              "framer-motion": "10.16.4",
              "@emotion/is-prop-valid": "^1.2.1",
              "clsx": "2.0.0",
              "tailwind-merge": "2.0.0",
              "i18next": "^23.7.6",
              "react-i18next": "^13.5.0",
              "date-fns": "^2.30.0",
              "recharts": "^2.10.3",
              "@tanstack/react-query": "^5.17.0"
            }
          }}
          style={{ height: '100%', width: '100%' }}
        >
          <SandpackLayout style={{ height: '100%', width: '100%', border: 'none', backgroundColor: '#0c0f14' }}>
            
            {/* LEFT SIDE: CUSTOM GOOGLE-STYLE EXPLORER */}
            {(viewMode === 'code') && (
               <CustomFileSidebar />
            )}

            {/* CENTER: CODE EDITOR */}
            {(viewMode === 'code') && (
              <div className="flex-1 h-full min-w-0 border-r border-white/10 overflow-hidden">
                <SandpackCodeEditor 
                  showTabs={false}
                  showLineNumbers 
                  showInlineErrors 
                  wrapContent={false}
                  style={{ height: '100%', overflow: 'auto' }} 
                />
              </div>
            )}

            {/* RIGHT: PREVIEW */}
            {(viewMode === 'preview') && (
              <div className="flex-1 h-full min-w-0 relative bg-black overflow-hidden group">
                {/* CSS to hide the default Sandpack error screen (the "pink" screen) */}
                <style dangerouslySetInnerHTML={{ __html: `
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
                `}} />

                {/* LOADING OVERLAY - Covers Sandpack while AI is generating */}
                {(isLoading || !hasValidFiles) && (
                  <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center">
                    {isLoading ? (
                      <>
                        <div className="relative">
                          {/* Animated rings */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-24 h-24 rounded-full border-2 border-indigo-500/30 animate-ping" />
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-16 h-16 rounded-full border-2 border-purple-500/50 animate-pulse" />
                          </div>
                          {/* Center icon */}
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <Code2 className="w-6 h-6 text-white animate-pulse" />
                          </div>
                        </div>
                        <p className="mt-6 text-sm text-gray-400 animate-pulse">Building your project...</p>
                        <p className="mt-2 text-xs text-gray-600">This may take up to 3 minutes</p>
                      </>
                    ) : !hasValidFiles && Object.keys(files).length > 0 ? (
                      <>
                        {/* Error state - invalid files received */}
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center shadow-lg shadow-red-500/30 mb-4">
                          <Code2 className="w-8 h-8 text-white" />
                        </div>
                        <p className="text-sm text-red-400 font-medium">Generation Error</p>
                        <p className="mt-2 text-xs text-gray-500 text-center max-w-xs px-4">
                          The AI returned invalid code. Please try again with a different prompt.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <Code2 className="w-6 h-6 text-white animate-pulse" />
                          </div>
                        </div>
                        <p className="mt-6 text-sm text-gray-400 animate-pulse">Waiting for code...</p>
                      </>
                    )}
                  </div>
                )}

                <SandpackPreview 
                  showNavigator={false} 
                  showOpenInCodeSandbox={false} 
                  style={{ height: '100%' }} 
                />
                
                {/* Visual Mode Indicator */}
                {elementSelectMode && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-2 rounded-full text-[10px] md:text-xs font-medium shadow-lg flex items-center gap-2 animate-pulse z-50 whitespace-nowrap">
                    <MousePointer2 className="w-3.5 h-3.5" />
                    Click to select
                  </div>
                )}
              </div>
            )}

            {/* ERROR LISTENER - Invisible component that detects crashes */}
            {onRuntimeError && (
              <SandpackErrorListener onErrorDetected={onRuntimeError} />
            )}

          </SandpackLayout>
        </SandpackProvider>
      </div>
    </div>
  );
}
