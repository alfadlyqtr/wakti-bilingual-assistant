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
            "react": "^18.2.0",
            "react-dom": "^18.2.0",
            "lucide-react": "latest",
            "framer-motion": "latest",
            "clsx": "latest",
            "tailwind-merge": "latest",
            "i18next": "^23.7.6",
            "react-i18next": "^13.5.0",
            "date-fns": "^2.30.0",
            "recharts": "^2.10.3",
            "@tanstack/react-query": "^5.17.0"
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
