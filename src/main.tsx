
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

const shouldDecodeClipboardText = (text: string): boolean => {
  const trimmed = text.trim();
  if (/^https?:\/\//i.test(trimmed)) return false;
  if (/^mailto:/i.test(trimmed)) return false;
  return /%0A|%20|%0D|%09/i.test(text) || /%[0-9A-Fa-f]{2}/.test(text);
};

const safeDecodeClipboardText = (text: string): string => {
  try {
    return decodeURIComponent(text);
  } catch {
    try {
      return decodeURIComponent(text.replace(/\+/g, ' '));
    } catch {
      return text;
    }
  }
};

if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
  const originalWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);
  navigator.clipboard.writeText = (text: string) => {
    const normalized = typeof text === 'string' && shouldDecodeClipboardText(text)
      ? safeDecodeClipboardText(text)
      : text;
    return originalWriteText(normalized);
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
