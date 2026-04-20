
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { runPreRenderSetup } from './bootstrap/preRender';
import './index.css';

// Item #8 Medium #5+#6: all module-scope side effects (admin body class,
// color-blind filter, text size, dev console filter, clipboard decoder) now
// live in a single explicit bootstrap step. See src/bootstrap/preRender.ts.
runPreRenderSetup();

const rootElement = document.getElementById("root");

if (!rootElement) {
  console.error("Root element not found");
} else {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
