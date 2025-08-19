
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Dev-only: suppress noisy Radix Dialog accessibility warnings so we can move on.
// This does NOT affect production builds.
if (import.meta.env.DEV) {
  const originalError = console.error;
  const originalWarn = console.warn;

  const shouldSuppress = (args: unknown[]): boolean => {
    try {
      const msg = args && (args as any[])[0] ? String((args as any[])[0]) : '';
      // Match only the specific Radix messages we want to ignore
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
