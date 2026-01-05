import { useEffect, useRef } from "react";
import { useSandpack } from "@codesandbox/sandpack-react";

interface ErrorListenerProps {
  onErrorDetected: (errorMessage: string) => void;
}

export const SandpackErrorListener = ({ onErrorDetected }: ErrorListenerProps) => {
  const { sandpack } = useSandpack();
  const lastErrorRef = useRef<string | null>(null);

  useEffect(() => {
    // Check for bundler-level errors (like missing dependencies)
    // This catches errors like "Could not find dependency: 'react-router-dom'"
    if (sandpack.status === 'idle' && sandpack.error) {
      const errorMsg = sandpack.error.message || String(sandpack.error);
      
      // Only trigger if this is a new error (prevent loops)
      if (lastErrorRef.current !== errorMsg) {
        lastErrorRef.current = errorMsg;
        
        // Filter for critical errors we can fix
        if (
          errorMsg.includes("Module not found") || 
          errorMsg.includes("Could not find dependency") ||
          errorMsg.includes("is not defined") ||
          errorMsg.includes("Minified React error") ||
          errorMsg.includes("Cannot find module") ||
          errorMsg.includes("Unexpected token") ||
          errorMsg.includes("is not a function")
        ) {
          console.log("🔥 WAKTI DETECTED CRASH:", errorMsg);
          onErrorDetected(errorMsg);
        }
      }
    }
    
    // Clear last error when status becomes running (successful)
    if (sandpack.status === 'running') {
      lastErrorRef.current = null;
    }
  }, [sandpack.status, sandpack.error, onErrorDetected]);

  return null; // This component is invisible
};
