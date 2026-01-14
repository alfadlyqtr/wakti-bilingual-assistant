import { useEffect, useRef, useCallback } from "react";
import { useSandpack } from "@codesandbox/sandpack-react";
import { useDebugContextSafe } from "@/hooks/useDebugContext";

interface ErrorListenerProps {
  onErrorDetected: (errorMessage: string) => void;
}

// ============================================================================
// ENHANCED SANDPACK ERROR LISTENER - SMART & PROACTIVE
// Now captures:
// - Bundler errors (missing deps, syntax errors)
// - Runtime errors (component crashes, undefined errors)
// - Console errors from the preview iframe
// - React error boundaries (component stack)
// - Proactive monitoring with debouncing
// ============================================================================

export const SandpackErrorListener = ({ onErrorDetected }: ErrorListenerProps) => {
  const { sandpack } = useSandpack();
  const lastErrorRef = useRef<string | null>(null);
  const lastErrorTimeRef = useRef<number>(0);
  const debugContext = useDebugContextSafe();
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced error handler to prevent spam
  const handleError = useCallback((errorMsg: string, source: string) => {
    const now = Date.now();
    // Debounce: ignore same error within 2 seconds
    if (lastErrorRef.current === errorMsg && now - lastErrorTimeRef.current < 2000) {
      return;
    }
    
    lastErrorRef.current = errorMsg;
    lastErrorTimeRef.current = now;
    
    console.log(`🔥 [SandpackErrorListener] Error from ${source}:`, errorMsg.substring(0, 100));
    onErrorDetected(errorMsg);
  }, [onErrorDetected]);

  // Listen for messages from the preview iframe (console errors, React errors)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Capture ALL console messages for agent mode (not just errors)
      if (event.data?.type === 'console' && event.data?.log) {
        const method = event.data.log.method || 'log';
        const message = event.data.log.data?.join(' ') || 'Unknown console message';
        
        if (debugContext) {
          debugContext.captureConsoleLog({
            level: method === 'error' ? 'error' : method === 'warn' ? 'warn' : method === 'info' ? 'info' : 'log',
            message: message,
            args: event.data.log.data
          });
        }
        
        // For errors, also trigger the callback
        if (method === 'error') {
          handleError(message, 'console');
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
        
        if (message) {
          handleError(message, 'react-error');
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
  }, [handleError, debugContext]);

  // Monitor Sandpack bundler/runtime status - PROACTIVE checking
  useEffect(() => {
    const checkForErrors = () => {
      // Check for bundler-level errors
      if (sandpack.error) {
        const errorMsg = sandpack.error.message || String(sandpack.error);
        
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
        
        const fileMatch = errorMsg.match(/(?:in|at)\s+([\/\w.-]+\.(?:js|jsx|ts|tsx))/i);
        if (fileMatch) file = fileMatch[1];
        
        const lineMatch = errorMsg.match(/:(\d+)(?::(\d+))?/);
        if (lineMatch) {
          line = parseInt(lineMatch[1], 10);
          if (lineMatch[2]) column = parseInt(lineMatch[2], 10);
        }
        
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
          errorMsg.includes("SyntaxError") ||
          errorMsg.includes("Error:") ||
          errorMsg.includes("failed to compile")
        ) {
          handleError(errorMsg, 'sandpack-bundler');
        }
      }
    };

    // Check immediately
    checkForErrors();

    // Also set up interval for proactive checking (every 500ms)
    checkIntervalRef.current = setInterval(checkForErrors, 500);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [sandpack.status, sandpack.error, handleError, debugContext]);

  // Clear last error when status becomes running (successful)
  useEffect(() => {
    if (sandpack.status === 'running' && !sandpack.error) {
      lastErrorRef.current = null;
      
      if (debugContext?.session?.status === 'auto-fixing') {
        console.log('[SandpackErrorListener] Preview now running - fix may have worked!');
      }
    }
  }, [sandpack.status, sandpack.error, debugContext]);

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
