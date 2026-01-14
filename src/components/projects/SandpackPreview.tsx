import { 
  SandpackProvider, 
  SandpackCodeEditor, 
  SandpackPreview as SandpackPreviewComponent
} from "@codesandbox/sandpack-react";
import { atomDark } from "@codesandbox/sandpack-themes";

interface SandpackPreviewProps {
  code?: string;
  viewMode?: 'preview' | 'code' | 'both';
}

const DEFAULT_APP_CODE = `import React from "react";

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center text-white font-sans p-8">
      <div className="text-center space-y-6 max-w-md">
        <div className="w-20 h-20 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto shadow-[0_0_20px_rgba(251,191,36,0.3)]"></div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent">
            Generating Perfection
          </h1>
          <p className="text-gray-400 text-lg">Wakti AI is crafting your luxury interface...</p>
        </div>
      </div>
    </div>
  );
}`;

// Entry Point Trio - Required for Sandpack to work properly with React 18
const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Wakti Preview</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/slick-carousel/1.8.1/slick.min.css" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/slick-carousel/1.8.1/slick-theme.min.css" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Inter', sans-serif; }
    </style>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

const INDEX_JS = `import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const root = createRoot(document.getElementById("root"));
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);`;

export default function SandpackPreview({ code, viewMode = 'preview' }: SandpackPreviewProps) {
  // Clean and prepare code for Sandpack
  let appCode = DEFAULT_APP_CODE;
  
  if (code) {
    let cleanCode = code.trim();
    // Remove markdown code blocks if present
    cleanCode = cleanCode.replace(/^```(?:jsx?|tsx?|javascript|typescript)?\n?/gi, '');
    cleanCode = cleanCode.replace(/\n?```$/gi, '');
    cleanCode = cleanCode.trim();
    
    if (cleanCode && cleanCode.includes('export default')) {
      appCode = cleanCode;
    }
  }
  
  // Create unique key to force re-render when code changes
  const codeKey = `sandpack-${appCode.length}-${Date.now()}`;

  // Full file structure for proper React 18 rendering
  const files = {
    "/public/index.html": INDEX_HTML,
    "/src/index.js": INDEX_JS,
    "/src/App.js": appCode,
  };

  return (
    <div className="absolute inset-0 bg-[#151515] flex flex-col">
      <SandpackProvider
        key={codeKey}
        template="react"
        theme={atomDark}
        files={files}
        options={{
          activeFile: "/src/App.js",
          visibleFiles: ["/src/App.js"],
        }}
        customSetup={{
          entry: "/src/index.js",
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
            "pixi.js": "^8.10.2"
          },
        }}
      >
        <div className="flex-1 flex min-h-0">
          {/* Code Editor - shown when viewMode is 'code' or 'both' */}
          {(viewMode === 'code' || viewMode === 'both') && (
            <div 
              className="h-full overflow-hidden border-r border-zinc-800"
              style={{ width: viewMode === 'both' ? '50%' : '100%' }}
            >
              <SandpackCodeEditor 
                showLineNumbers 
                showTabs
                style={{ height: '100%' }}
              />
            </div>
          )}
          
          {/* Preview - shown when viewMode is 'preview' or 'both' */}
          {(viewMode === 'preview' || viewMode === 'both') && (
            <div className="flex-1 h-full overflow-hidden">
              <SandpackPreviewComponent 
                showNavigator={false}
                showRefreshButton={false}
                style={{ height: '100%' }}
              />
            </div>
          )}
        </div>
      </SandpackProvider>
    </div>
  );
}
