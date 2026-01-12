import { useEffect, useRef } from "react";
import { useSandpack } from "@codesandbox/sandpack-react";
import { useDebugContextSafe } from "@/hooks/useDebugContext";

interface ErrorListenerProps {
  onErrorDetected: (errorMessage: string) => void;
}

// ============================================================================
// ENHANCED SANDPACK ERROR LISTENER
// Now captures:
// - Bundler errors (missing deps, syntax errors)
// - Runtime errors (component crashes, undefined errors)
// - Console errors from the preview iframe
// - React error boundaries (component stack)
// ============================================================================

export const SandpackErrorListener = ({ onErrorDetected }: ErrorListenerProps) => {
  const { sandpack } = useSandpack();
  const lastErrorRef = useRef<string | null>(null);
  const debugContext = useDebugContextSafe();

  // Listen for messages from the preview iframe (console errors, React errors)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Sandpack internal error messages
      if (event.data?.type === 'console' && event.data?.log?.method === 'error') {
        const errorMessage = event.data.log.data?.join(' ') || 'Unknown console error';
        
        if (debugContext) {
          debugContext.captureError({
            type: 'console',
            message: errorMessage,
            metadata: { source: 'iframe-console' }
          });
        }
      }
      
      // React error boundary errors from our injected script
      if (event.data?.type === 'WAKTI_REACT_ERROR') {
        const { message, stack, componentStack } = event.data.payload || {};
        
        if (debugContext && message) {
          debugContext.captureError({
            type: 'render',
            message: message,
            stack: stack,
            componentStack: componentStack,
            metadata: { source: 'react-error-boundary' }
          });
        }
        
        // Also trigger the legacy callback
        if (message) {
          onErrorDetected(message);
        }
      }
      
      // Network errors from the preview
      if (event.data?.type === 'WAKTI_NETWORK_ERROR') {
        const { url, method, status, statusText, responseBody } = event.data.payload || {};
        
        if (debugContext && url) {
          debugContext.captureNetworkError({
            url,
            method: method || 'GET',
            status: status || 0,
            statusText: statusText || 'Network Error',
            responseBody: responseBody?.substring(0, 500)
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onErrorDetected, debugContext]);

  // Monitor Sandpack bundler/runtime status
  useEffect(() => {
    // Check for bundler-level errors (like missing dependencies)
    // This catches errors like "Could not find dependency: 'react-router-dom'"
    if (sandpack.status === 'idle' && sandpack.error) {
      const errorMsg = sandpack.error.message || String(sandpack.error);
      
      // Only trigger if this is a new error (prevent loops)
      if (lastErrorRef.current !== errorMsg) {
        lastErrorRef.current = errorMsg;
        
        // Determine error type
        let errorType: 'build' | 'syntax' | 'runtime' = 'runtime';
        if (errorMsg.includes("Module not found") || errorMsg.includes("Could not find dependency")) {
          errorType = 'build';
        } else if (errorMsg.includes("Unexpected token") || errorMsg.includes("SyntaxError")) {
          errorType = 'syntax';
        }
        
        // Parse file and line info if available
        let file: string | undefined;
        let line: number | undefined;
        let column: number | undefined;
        
        // Try to extract file path from error message
        const fileMatch = errorMsg.match(/(?:in|at)\s+([\/\w.-]+\.(?:js|jsx|ts|tsx))/i);
        if (fileMatch) file = fileMatch[1];
        
        // Try to extract line number
        const lineMatch = errorMsg.match(/:(\d+)(?::(\d+))?/);
        if (lineMatch) {
          line = parseInt(lineMatch[1], 10);
          if (lineMatch[2]) column = parseInt(lineMatch[2], 10);
        }
        
        // Capture to debug context if available
        if (debugContext) {
          debugContext.captureError({
            type: errorType,
            message: errorMsg,
            file,
            line,
            column,
            stack: (sandpack.error as any).stack,
            metadata: { 
              sandpackStatus: sandpack.status,
              source: 'sandpack-bundler'
            }
          });
        }
        
        // Filter for critical errors we can fix
        if (
          errorMsg.includes("Module not found") || 
          errorMsg.includes("Could not find dependency") ||
          errorMsg.includes("is not defined") ||
          errorMsg.includes("Minified React error") ||
          errorMsg.includes("Cannot find module") ||
          errorMsg.includes("Unexpected token") ||
          errorMsg.includes("is not a function") ||
          errorMsg.includes("Cannot read properties") ||
          errorMsg.includes("TypeError") ||
          errorMsg.includes("ReferenceError") ||
          errorMsg.includes("SyntaxError")
        ) {
          console.log("🔥 WAKTI DETECTED CRASH:", errorMsg);
          onErrorDetected(errorMsg);
        }
      }
    }
    
    // Clear last error when status becomes running (successful)
    if (sandpack.status === 'running') {
      lastErrorRef.current = null;
      
      // If we have a debug context, mark that the preview is now healthy
      if (debugContext?.session?.status === 'auto-fixing') {
        console.log('[SandpackErrorListener] Preview now running - fix may have worked!');
      }
    }
  }, [sandpack.status, sandpack.error, onErrorDetected, debugContext]);

  return null; // This component is invisible
};

// ============================================================================
// INJECTABLE SCRIPT FOR PREVIEW IFRAME
// This captures React errors and network failures from inside the preview
// ============================================================================
export const PREVIEW_ERROR_CAPTURE_SCRIPT = `
(function() {
  // Capture uncaught errors
  window.addEventListener('error', function(event) {
    window.parent.postMessage({
      type: 'WAKTI_REACT_ERROR',
      payload: {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      }
    }, '*');
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', function(event) {
    window.parent.postMessage({
      type: 'WAKTI_REACT_ERROR',
      payload: {
        message: 'Unhandled Promise Rejection: ' + (event.reason?.message || String(event.reason)),
        stack: event.reason?.stack
      }
    }, '*');
  });

  // Intercept fetch to capture network errors
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    try {
      const response = await originalFetch.apply(this, args);
      if (!response.ok && response.status >= 400) {
        let responseBody = '';
        try {
          responseBody = await response.clone().text();
        } catch {}
        window.parent.postMessage({
          type: 'WAKTI_NETWORK_ERROR',
          payload: {
            url: typeof args[0] === 'string' ? args[0] : args[0]?.url,
            method: args[1]?.method || 'GET',
            status: response.status,
            statusText: response.statusText,
            responseBody: responseBody
          }
        }, '*');
      }
      return response;
    } catch (error) {
      window.parent.postMessage({
        type: 'WAKTI_NETWORK_ERROR',
        payload: {
          url: typeof args[0] === 'string' ? args[0] : args[0]?.url,
          method: args[1]?.method || 'GET',
          status: 0,
          statusText: error.message
        }
      }, '*');
      throw error;
    }
  };

  // Capture React error boundaries (requires React 16+)
  // This is automatically handled by React's error boundary mechanism
  // We listen for the window error event which catches most React errors
  
  console.log('[WAKTI Debug] Error capture script initialized');
})();
`;
